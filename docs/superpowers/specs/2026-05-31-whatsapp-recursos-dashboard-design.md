# WhatsApp — Dashboard de Recursos (liga/desliga) — Design

**Data:** 2026-05-31
**Status:** Aprovado (3 decisões travadas) — pronto para plano de implementação

## Objetivo

Transformar o painel informativo **"O QUE ESTE NÚMERO FAZ"** (`whatsapp-status-panel.tsx`, hoje só texto ✅/❌) em um **mini-dashboard de recursos** com interruptores liga/desliga. Cada interruptor controla o recurso **de verdade** (não só a tela), e o estado fica salvo no banco.

## Contexto

Tela única `/admin/whatsapp` já consolida: painel informativo → Conexão | Alerta por e-mail → Conversas (inbox). A captura de inbound (`@lid`) foi confirmada E2E (commit `dc71201`). O usuário pediu que o painel deixe de ser "somente comunicativo" e vire um dashboard de controle, onde "exibir as mensagens no painel abaixo" é **um dos interruptores**.

## Decisões travadas

1. **Três interruptores:** (1) Confirmação automática de pedido, (2) Atendimento (receber + exibir mensagens), (3) Alerta por e-mail se a conexão cair.
2. **Atendimento DESLIGADO** = para de capturar (webhook descarta antes de gravar) **e** esconde o painel Conversas. Privacidade: nada é gravado enquanto desligado.
3. Tudo começa **ligado** (preserva o comportamento atual). Captura `@lid` já confirmada (pré-requisito fechado).

## Arquitetura

**Estado:** 3 flags booleanas na tabela `configuracoes` existente (`chave text PK, valor text`), valor `'true'`/`'false'`:

| Recurso | chave | Gate (onde "morde") |
|---|---|---|
| Confirmação automática | `whatsapp_confirmacao_ativo` | `sendCustomerWhatsAppConfirmation` (`app/lib/whatsapp/notificacoes.ts`) |
| Atendimento (inbound + inbox) | `whatsapp_atendimento_ativo` | webhook `app/app/api/whatsapp/inbound/route.ts` (antes do RPC) + render de Conversas |
| Alerta por e-mail | `whatsapp_alerta_ativo` | `app/app/api/whatsapp/alert/route.ts` (antes de enviar) + estado do card de e-mail |

**Princípio fail-open:** se a flag não existir ou a leitura falhar, trata como **LIGADO** (nunca quebra o comportamento atual por causa de leitura de config). Seed via migração garante as 3 linhas com `'true'`.

**Dois caminhos de leitura** (cada um no seu contexto):
- **UI admin (página):** `getWhatsappFeatures()` — auth-aware via `requireAdmin()` (igual a `getWhatsappAlertEmail`). Retorna `{ confirmacao, atendimento, alerta }`.
- **Gates server-to-server** (webhook/notificações/alerta — rodam sem sessão de admin): `isWhatsappFeatureEnabled(chave)` — lê via `createServiceClient` (service role, ignora RLS), fail-open.

Toda a lógica é **app-side**. O servidor EC2/Baileys **não muda** — ele continua encaminhando inbound; quem decide gravar ou descartar é o webhook do app.

## Modelo de dados

**Migração `supabase/migrations/023_whatsapp_feature_flags.sql`** (idempotente):

```sql
insert into configuracoes (chave, valor) values
  ('whatsapp_confirmacao_ativo', 'true'),
  ('whatsapp_atendimento_ativo', 'true'),
  ('whatsapp_alerta_ativo', 'true')
on conflict (chave) do nothing;
```

Aplicar em **staging** (`iwyijyxpkchibdryzkpn`) primeiro. Prod (`rhuqttionnpfnftkmvmq`) só na promoção.

## Componentes e arquivos

**Criar:**
- `app/components/ui/switch.tsx` — primitivo `Switch` (trilho + bolinha, `brand-yellow` quando ligado). Espelha o padrão peer/acessível do `Checkbox`. Props: `checked`, `onChange`/`onCheckedChange`, `disabled`, `label?`, `description?`, `id`.
- `app/lib/whatsapp/features.ts` (NÃO `"use server"`) — `WHATSAPP_FEATURE_KEYS` (const), `parseFlag(valor): boolean` (puro: `valor === 'true'`, default true se null), `isWhatsappFeatureEnabled(chave): Promise<boolean>` (service client, fail-open). Importável por route handlers e server actions.
- `app/components/admin/whatsapp-features-panel.tsx` (client) — o dashboard. Props: `initial: { confirmacao, atendimento, alerta }`, `me: string | null`. Renderiza 3 linhas com `Switch` + um rodapé "o que ele NÃO faz" (migrado do status-panel: não responde sozinho, não traz histórico antigo, não avisa status de entrega). Toggle = otimista com rollback em erro; chama `setWhatsappFeature`.

**Modificar:**
- `app/components/ui/index.ts` — exportar `Switch`.
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappFeatures()` (leitura auth-aware das 3 flags via `requireAdmin`, usando `parseFlag`) + `setWhatsappFeature(chave, ativo): Promise<{ok}>` (valida chave contra `WHATSAPP_FEATURE_KEYS`, **upsert** `{chave, valor, updated_at}`, `revalidatePath("/admin/whatsapp")`).
- `app/lib/whatsapp/notificacoes.ts` — no topo de `sendCustomerWhatsAppConfirmation`: `if (!(await isWhatsappFeatureEnabled('whatsapp_confirmacao_ativo'))) return` (bail antes de montar/enviar).
- `app/app/api/whatsapp/inbound/route.ts` — antes do RPC `register_inbound_whatsapp`: se atendimento OFF, `return NextResponse.json({ ok: true, skipped: true })` (200, pra EC2 não re-tentar; nada gravado).
- `app/app/api/whatsapp/alert/route.ts` — antes de `sendWhatsAppDownAlert(reason)`: se alerta OFF, `return NextResponse.json({ ok: true, skipped: true })`.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — adicionar `getWhatsappFeatures()` ao `Promise.all`; trocar `WhatsappStatusPanel` por `WhatsappFeaturesPanel`; **gate de render**: Conversas só aparece se `atendimento` ligado (senão, placeholder "Atendimento desligado — ligue o recurso acima para receber e ver mensagens"); card de Alerta fica esmaecido/desabilitado se `alerta` desligado.
- `app/components/admin/whatsapp-alert-email.tsx` — aceitar prop `disabled?: boolean` (esmaece quando alerta OFF). Mudança mínima.

**Remover:**
- `app/components/admin/whatsapp-status-panel.tsx` — substituído pelo features-panel (o conteúdo "não faz" é migrado pro rodapé do novo painel).

## UX do dashboard

Seção **"RECURSOS"** (topo da página, onde estava "O QUE ESTE NÚMERO FAZ"). Card `bg-brand-surface`. Cada linha:

```
[ícone]  Confirmação automática de pedido            (•———)  ← Switch
         Envia a mensagem de confirmação quando entra um pedido novo.

[ícone]  Atendimento (receber e exibir mensagens)    (———•)
         Captura as mensagens dos clientes e mostra o painel Conversas abaixo.

[ícone]  Alerta por e-mail se a conexão cair          (•———)
         Avisa por e-mail o endereço configurado quando o número desconectar.
```

Rodapé (transparência que o usuário valorizou, condensado): *"Ele NÃO responde sozinho (sem robô), NÃO traz histórico antigo e NÃO avisa status de entrega."* + a dica de teste ("peça pra alguém mandar um 'oi' pro número {me}").

**Relação gate → UI (consistente):** cada interruptor controla seu downstream — Atendimento ⇄ seção Conversas (mostra/esconde + placeholder), Alerta ⇄ card de e-mail (ativo/esmaecido), Confirmação ⇄ comportamento (sem seção própria). Ao alternar, o `setWhatsappFeature` faz `revalidatePath` → a página re-renderiza e a seção aparece/some.

## Estratégia de testes

**Unit (Vitest):**
- `parseFlag`: `'true'`→true, `'false'`→false, `null`→true (fail-open), `undefined`→true.
- `Switch`: renderiza estado ligado/desligado; dispara `onChange`; respeita `disabled`.

**Integração / E2E (staging, via workflow):**
1. Toggle de cada recurso na UI → confirmar linha em `configuracoes` (`valor` muda) + `revalidate`.
2. **Atendimento OFF:** POST sintético no webhook inbound → resposta `{skipped:true}`, `select count(*)` em `conversas_whatsapp` inalterado, seção Conversas some (placeholder). Religar → captura volta (já provado).
3. **Confirmação OFF:** criar pedido → nenhuma mensagem WhatsApp enviada (sem chamada de envio; conferir ausência de log `whatsapp_messages`). Religar → envia.
4. **Alerta OFF:** POST sintético no webhook de alerta → `{skipped:true}`, nenhum e-mail (Resend não chamado). Religar → envia.
5. Fail-open: deletar temporariamente uma flag → gate continua LIGADO (e re-seed).

## Fora de escopo (YAGNI)

- Histórico/auditoria de quem ligou/desligou (data já tem `updated_at`).
- Agendamento (ligar/desligar por horário).
- Toggles por-conversa ou por-cliente.
- Link pedido↔conversa (continua adiado, v2).
- Mudanças no EC2/Baileys.

## Riscos

- **Setter com `update` no-opa em linha ausente** → por isso o setter usa **upsert** e a migração seed garante as linhas. Fail-open cobre o resto.
- **Latência extra:** +1 leitura de config por inbound/pedido/alerta — desprezível.
- **Disco local ~94% cheio** → build no Vercel, não local.
