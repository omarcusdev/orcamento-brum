# FRE-22 — Avisar status de entrega no WhatsApp (design)

**Data:** 2026-06-04
**Issue:** FRE-22 (Freelas, projeto "WhatsApp Integration — ALFA Chopp")
**Status:** desenho aprovado nas decisões-chave; pendente revisão do spec escrito.

## Goal

Quando um pedido avança no fluxo de status, enviar automaticamente uma mensagem no WhatsApp do cliente — reaproveitando a camada de envio já existente (a mesma da confirmação de pedido, FRE-12). O dono liga/desliga a feature inteira, liga/desliga cada status individualmente e **edita o texto de cada mensagem** pelo painel admin.

Hoje o painel de Recursos declara explicitamente que o número *"NÃO avisa status de entrega"* — esta feature reverte isso.

## Escopo

**Status que disparam mensagem** (escolhidos pelo usuário):

| Status | Momento | Default da mensagem |
|---|---|---|
| `em_rota` | saiu para entrega / a caminho | `Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚` |
| `entregue` | pedido entregue | `Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento!` |
| `cancelado` | pedido cancelado | `Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante.` |
| `recolhido` | barril/equipamento recolhido | `Recolhemos tudo certinho! 🍺 Valeu demais pela parceria, {nome}. Bora repetir!` |

**Fora do escopo (não enviam):** `confirmado` (já coberto pela confirmação inicial — FRE-12), `enviar_para_entregador` e `pago` (transições internas, sem valor pro cliente).

**YAGNI / fora desta feature:** tokens além de `{nome}` e `{pedido}`; agendamento/retry; preview com dados reais no painel (mostra só o template); histórico de edições das mensagens.

## Arquitetura

### Onde engata o envio — `after()` nas server actions (abordagem A, aprovada)

As mudanças de status acontecem em 2 server actions auth-aware (`app/lib/admin-actions.ts`):

- `advanceOrderStatus(pedidoId, currentStatus)` → cobre `em_rota`, `entregue`, `recolhido` (e `pago`, que ignoramos).
- `cancelOrder(pedidoId)` → `cancelado`.

Em cada uma, **após** o update de status bem-sucedido, dispara:

```ts
after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, novoStatus))
```

Exatamente o padrão de `createOrder` (`after(() => sendCustomerWhatsAppConfirmation(pedido.id))`). Não bloqueia o retorno da action, não quebra a mudança de status se o envio falhar.

`dispatchToEntregador` (→ `enviar_para_entregador`) e `revertOrderStatus` (volta status) **não** disparam envio. Reverter nunca manda mensagem.

Rejeitadas: trigger no banco + pg_net/Edge Function (infra a mais, sofre com o double-log do revert, reenvia em revert→avança); listener realtime (precisa de processo long-running, incompatível com serverless).

### Módulo puro de status — `app/lib/whatsapp/status-messages.ts` (novo, NÃO `"use server"`)

Unidade isolada e testável, sem I/O. Fonte da verdade dos defaults e dos nomes de chave:

```ts
export const STATUS_NOTIFY_STATUSES = ["em_rota", "entregue", "cancelado", "recolhido"] as const
export type NotifyStatus = (typeof STATUS_NOTIFY_STATUSES)[number]

export const STATUS_LABELS: Record<NotifyStatus, string> = {
  em_rota: "A caminho (em rota)",
  entregue: "Entregue",
  cancelado: "Cancelado",
  recolhido: "Recolhido",
}

export const DEFAULT_STATUS_MESSAGES: Record<NotifyStatus, string> = {
  em_rota: "Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚",
  entregue: "Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento!",
  cancelado: "Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante.",
  recolhido: "Recolhemos tudo certinho! 🍺 Valeu demais pela parceria, {nome}. Bora repetir!",
}

export const isNotifyStatus = (s: string): s is NotifyStatus =>
  (STATUS_NOTIFY_STATUSES as readonly string[]).includes(s)

// chaves derivadas do status (nada hardcoded em string solta)
export const statusFlagKey = (s: NotifyStatus) => `whatsapp_status_${s}_ativo` as const
export const statusMsgKey = (s: NotifyStatus) => `whatsapp_status_${s}_msg` as const

// tokens suportados: {nome} (primeiro nome) e {pedido} (id curto, 8 chars)
export const renderStatusTemplate = (
  template: string,
  vars: { nome: string; pedido: string },
): string =>
  template.replaceAll("{nome}", vars.nome).replaceAll("{pedido}", vars.pedido)
```

### Envio — `sendCustomerWhatsAppStatusUpdate` em `app/lib/whatsapp/notificacoes.ts`

Espelha `sendCustomerWhatsAppConfirmation`. Responsabilidade única: dado um `pedidoId` + `novoStatus`, decidir e enviar.

Fluxo:

1. Se `!isNotifyStatus(novoStatus)` → return (status sem template).
2. Gate **master**: `if (!(await isWhatsappFeatureEnabled("whatsapp_status_entrega_ativo"))) return`.
3. Gate **por status**: lê `whatsapp_status_${novoStatus}_ativo` (mesma leitura fail-open); se desligado → return.
4. `createServiceClient()` → busca `clientes(nome, telefone)` do pedido (mesmo join da confirmação).
5. Sem telefone → loga e return.
6. **Dedupe:** consulta `mensagens_whatsapp` por `pedido_id = X AND tipo = 'status_<novoStatus>' AND status = 'enviada'`; se já existe → return (não reenvia o mesmo status 2x, mesmo após revert→avança).
7. Lê o template: config `whatsapp_status_${novoStatus}_msg`; se nulo/vazio → `DEFAULT_STATUS_MESSAGES[novoStatus]` (fallback robusto).
8. `mensagem = renderStatusTemplate(template, { nome: primeiroNome, pedido: pedidoId.slice(0, 8) })`.
9. `result = await sendWhatsAppMessage(telefone, mensagem)`.
10. `register_whatsapp_message({ p_pedido_id, p_tipo: 'status_<novoStatus>', p_status: result.ok ? 'enviada' : 'falha' })`.
11. Todo o corpo dentro de try/catch que só loga (nunca propaga).

> A leitura do gate por status pode reaproveitar `isWhatsappFeatureEnabled`, mas seu tipo aceita só `WhatsappFeatureKey`. Como as chaves `whatsapp_status_${s}_ativo` são derivadas e não fazem parte do union de features de 1ª classe, o plano vai extrair uma leitura genérica `readFlag(chave: string)` em `features.ts` (mesma lógica fail-open) e fazer `isWhatsappFeatureEnabled` delegar a ela. Assim o gate por status usa `readFlag(statusFlagKey(s))`.

### Feature flags e configs (migração 024)

Todas em `configuracoes` (tabela key-value, RLS: leitura pública / escrita admin). Default ligado/preenchido pra feature já nascer funcional:

```sql
-- master
('whatsapp_status_entrega_ativo', 'true'),
-- por status (4)
('whatsapp_status_em_rota_ativo',   'true'),
('whatsapp_status_entregue_ativo',  'true'),
('whatsapp_status_cancelado_ativo', 'true'),
('whatsapp_status_recolhido_ativo', 'true'),
-- mensagens (4) — seed com os defaults
('whatsapp_status_em_rota_msg',   '<default em_rota>'),
('whatsapp_status_entregue_msg',  '<default entregue>'),
('whatsapp_status_cancelado_msg', '<default cancelado>'),
('whatsapp_status_recolhido_msg', '<default recolhido>')
on conflict (chave) do nothing;
```

A mesma migração **relaxa o CHECK de `mensagens_whatsapp.tipo`** (hoje só `('confirmacao','lembrete')`) para incluir `status_em_rota`, `status_entregue`, `status_cancelado`, `status_recolhido`. Tipo por status = log legível + dedupe trivial.

`whatsapp_status_entrega_ativo` (o master) entra em `WHATSAPP_FEATURE_KEYS` (`features.ts`) como feature de 1ª classe, junto de confirmação/atendimento/alerta. Os 4 sub-flags e os 4 templates **não** entram nesse union — são um grupo parametrizado, acessado pelas helpers `statusFlagKey`/`statusMsgKey`.

### Server actions admin — `app/lib/whatsapp/admin-actions.ts`

- `getWhatsappStatusEntregaConfig()` (via `requireAdmin`): lê master + os 4 flags + os 4 templates de `configuracoes` numa query (`.in("chave", [...])`), com fallback dos templates pros defaults. Retorna shape tipado:
  ```ts
  type StatusEntregaConfig = {
    master: boolean
    porStatus: Record<NotifyStatus, { ativo: boolean; mensagem: string }>
  }
  ```
- `setWhatsappStatusFlag(status | "master", ativo)`: upsert do flag correspondente (mesmo padrão upsert+select de `setWhatsappFeature`). `revalidatePath("/admin/whatsapp")`.
- `setWhatsappStatusMessage(status, texto)`: upsert de `whatsapp_status_${status}_msg`. Valida `isNotifyStatus`. Texto vazio → permitido salvar? Não: trim vazio → grava o default (equivale a "restaurar padrão"). `revalidatePath`.

`setWhatsappFeature` existente cobre o master se ele estiver em `WHATSAPP_FEATURE_KEYS`; mas pra coesão o painel novo usa `setWhatsappStatusFlag("master", …)` que delega à mesma escrita. (Decisão de implementação detalhada no plano.)

### Painel — `app/components/admin/whatsapp-status-entrega-panel.tsx` (novo client component)

Renderizado na seção RECURSOS, logo abaixo do `WhatsappFeaturesPanel` atual. Isolado por ser mais complexo (master + 4 sub + textareas) — não polui o `ROWS.map` plano existente.

Layout:

```
☑ Avisar status de entrega                              [master ON/OFF]
   (quando ON, expande:)
   ☑ A caminho (em rota)   [textarea editável…]  Salvar · Restaurar padrão
   ☑ Entregue              [textarea editável…]  Salvar · Restaurar padrão
   ☑ Cancelado             [textarea editável…]  Salvar · Restaurar padrão
   ☑ Recolhido             [textarea editável…]  Salvar · Restaurar padrão
   dica: use {nome} e {pedido} nas mensagens
```

- Switches: primitivo `Switch` de `@/components/ui` (mesmo do painel atual), update otimista + rollback em erro (padrão existente).
- Textareas: primitivo `Textarea` de `@/components/ui`. Botão `Salvar` (primary) e link `Restaurar padrão` (ghost) por status; "Restaurar padrão" seta o textarea pro `DEFAULT_STATUS_MESSAGES[status]` e salva.
- Master OFF → sub-controles colapsados/escondidos.
- Dica dos tokens visível.

E atualiza o copy `NAO_FAZ` em `whatsapp-features-panel.tsx`: remove *"NÃO avisa status de entrega"* (agora avisa). Fica: `"Ele NÃO responde sozinho (sem robô) e NÃO traz o histórico antigo de conversas."`

### Página — `app/app/admin/(authenticated)/whatsapp/page.tsx`

Adiciona `getWhatsappStatusEntregaConfig()` ao `Promise.all`, passa pro novo painel dentro da seção RECURSOS.

## Fluxo de dados (envio)

```
admin avança status (advanceOrderStatus / cancelOrder)
  → update pedidos.status (trigger loga em pedido_status_log)
  → after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, novoStatus))
        → isNotifyStatus? master ON? sub-flag ON? (gates)
        → busca cliente (telefone, nome)  [createServiceClient]
        → dedupe: já enviou status_<x> p/ esse pedido? → pula
        → template (config ?? default) → renderStatusTemplate(tokens)
        → sendWhatsAppMessage(telefone, mensagem)   [port → baileys adapter]
        → register_whatsapp_message(tipo=status_<x>, status=enviada|falha)
```

## Tratamento de erro

- Tudo no envio roda em `after()` + try/catch → nunca quebra a mudança de status nem o retorno da action.
- Sem telefone, pedido não encontrado, feature/sub-flag off, status sem template → return silencioso (com log quando for anomalia).
- Falha no `sendWhatsAppMessage` → registra `status='falha'` em `mensagens_whatsapp` (auditoria), sem retry.
- Leitura de flag fail-open: erro de leitura não desliga a feature (consistente com o resto).

## Testes

- **Unit (módulo puro `status-messages.ts`):** `renderStatusTemplate` substitui `{nome}`/`{pedido}` (inclusive múltiplas ocorrências e ausência de token); `isNotifyStatus`; `statusFlagKey`/`statusMsgKey` derivam as chaves certas; defaults batem com o esperado.
- **Gating (`sendCustomerWhatsAppStatusUpdate`):** master off → não envia; sub off → não envia; status não-notificável → não envia; dedupe → segundo envio do mesmo status pulado. (Mockando o supabase service client + `sendWhatsAppMessage`.)
- **Server actions:** `setWhatsappStatusMessage` rejeita status inválido; texto vazio grava default; `setWhatsappStatusFlag` faz upsert correto. (Padrão de teste das actions existentes.)
- **E2E (manual, staging — fora desta feature, vai pra FRE-4 final):** criar pedido, avançar até em_rota/entregue/recolhido e cancelar outro → mensagens chegam, log `enviada`, dedupe segura; editar uma mensagem no painel → próximo envio usa o texto novo; desligar um sub-status → não envia; desligar master → nada envia.

## Arquivos

**Novos**
- `app/lib/whatsapp/status-messages.ts` — módulo puro (statuses, labels, defaults, helpers de chave, render de template).
- `app/components/admin/whatsapp-status-entrega-panel.tsx` — painel master + sub-toggles + textareas.
- `supabase/migrations/024_whatsapp_status_entrega.sql` — seed das 9 configs + relax do CHECK de `mensagens_whatsapp.tipo`.
- Testes: `app/lib/whatsapp/status-messages.test.ts` (+ teste do gating de `sendCustomerWhatsAppStatusUpdate`).

**Modificados**
- `app/lib/whatsapp/notificacoes.ts` — `sendCustomerWhatsAppStatusUpdate`.
- `app/lib/admin-actions.ts` — `after()` em `advanceOrderStatus` e `cancelOrder`.
- `app/lib/whatsapp/features.ts` — `whatsapp_status_entrega_ativo` em `WHATSAPP_FEATURE_KEYS`; extrair `readFlag(chave: string)` genérico.
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappStatusEntregaConfig`, `setWhatsappStatusFlag`, `setWhatsappStatusMessage`.
- `app/components/admin/whatsapp-features-panel.tsx` — copy `NAO_FAZ`.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — fetch + render do novo painel.

## Decisões travadas

1. Hook via `after()` nas server actions (não trigger/realtime). ✅
2. Dedupe por `(pedido, tipo=status_<x>, status=enviada)`. ✅
3. Master + 4 sub-flags + 4 mensagens editáveis, todos default ligados/preenchidos. ✅
4. Tom caloroso nos defaults; tokens `{nome}` e `{pedido}`. ✅
5. `confirmado`/`enviar_para_entregador`/`pago` fora do escopo. ✅
