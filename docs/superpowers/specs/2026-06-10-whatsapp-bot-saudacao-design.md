# FRE-25 etapa 1 — Saudação automática do bot (design)

**Data:** 2026-06-10
**Issue:** FRE-25 (Freelas, projeto "WhatsApp Integration — ALFA Chopp")
**Status:** desenho aprovado nas decisões-chave; pendente revisão do spec escrito.
**Depende de:** FRE-19 (inbound capture) + FRE-20 (flags de recursos).

## Goal

Quando um cliente manda mensagem no WhatsApp e a conversa estava parada (sessão nova), responder automaticamente com uma saudação editável: boas-vindas + link do site + "qualquer dúvida responda aqui". É a primeira vez que o número responde sozinho — por isso a feature nasce **desligada** e **fail-closed**.

## Escopo (etapa 1 — escolhido pelo usuário)

- Auto-resposta **rule-based** (sem IA): uma mensagem fixa editável, disparada por sessão nova.
- Flag liga/desliga própria do bot + mensagem editável + janela de sessão configurável, num painel novo em `/admin/whatsapp`.
- Atualizar a copy do painel Recursos que afirma "NÃO responde sozinho".

**Etapa 2 (fora deste ciclo):** agente de FAQ com LLM (base de conhecimento, guardrails, handoff humano, evals) — vira spec/plano próprios depois.

**YAGNI / fora do v1:** tokens na mensagem (`{nome}` não é garantido — conversa pode ser de número sem cadastro); horário comercial; múltiplas mensagens/fluxos; registro em `mensagens_whatsapp` (log de mensagens *de pedido*; o eco `saida` já registra a saudação na conversa); retry de envio falho.

## Decisões-chave (aprovadas no brainstorm)

1. **Gatilho: por sessão (silêncio).** Responde quando a conversa estava sem QUALQUER mensagem (entrada, resposta do admin ou nosso eco) dentro da janela. Cliente novo e cliente que volta dias depois recebem; mensagens seguidas na mesma conversa não. Mesmo conceito da greeting message do WhatsApp Business.
2. **Janela: 24h default, configurável** no painel (Select 6h / 12h / 24h / 48h) — mesmo padrão da hora do lembrete (FRE-23).
3. **Default OFF + fail-closed.** Diferente das flags da migração 023 (fail-open): config ausente ou erro de leitura = bot desligado. Pior caso é "não saudou", nunca "mandou mensagem indevida".
4. **Hook inline na rota inbound + envio via `after()`** (abordagem A): a rota responde rápido pro EC2 e o envio roda pós-resposta — mesmo padrão da FRE-22 em `actions.ts` (`import { after } from "next/server"`).
5. **Sem migration, sem env nova, sem mudança no EC2.** Defaults vivem no código; configs nascem via upsert do painel (padrão FRE-24). Grupos já são filtrados no EC2 (`extractInbound` descarta `@g.us`/`@broadcast` desde a FRE-19) — só DMs chegam aqui.

## Arquitetura

### Fluxo

```
EC2 → POST /api/whatsapp/inbound (rota existente; nada muda até o RPC)
  secret ✓ → payload ✓ → whatsapp_atendimento_ativo ✓ → match cliente
  → register_inbound_whatsapp ✓ (persistiu a mensagem)
  → NOVO: se payload.direcao === "entrada"
       → after(() => maybeSendBotSaudacao(telefoneE164, payload.waMessageId))
  → responde 200 pro EC2 (não espera o envio)
```

Consequência da posição do hook: o bot **requer** `whatsapp_atendimento_ativo` ON (com atendimento OFF a rota retorna `{skipped:true}` antes do RPC e o bot nem vê a mensagem). O painel do bot avisa isso.

### `maybeSendBotSaudacao(telefone, waMessageId)` — orquestrador

Roda pós-resposta com `createServiceClient()`. Nunca lança (try/catch → `console.error`, espelho de `runLembreteVespera`):

1. **Configs:** lê as 3 chaves numa query `.in("chave", [...])`. Flag liga só com `valor === 'true'`; chave ausente ou erro de leitura → OFF (fail-closed) → retorna.
2. **Conversa:** `conversas_whatsapp.select("id").eq("telefone", telefone).maybeSingle()` (coluna `telefone` é `unique`, E.164 — o RPC acabou de criar/atualizar). Não achou → log + retorna.
3. **Sessão nova?** Mensagem mais recente da conversa **anterior a esta**:
   `mensagens_conversa_whatsapp.select("ocorrida_em").eq("conversa_id", id).neq("wa_message_id", waMessageId).order("ocorrida_em", { ascending: false }).limit(1).maybeSingle()`.
   (Todo registro tem `wa_message_id` por construção — o payload o exige e o RPC sempre grava — então o `.neq` não perde linhas por NULL.)
   Decide com `isSessaoNova` (módulo puro). Sessão ativa → retorna.
4. **Envia:** `sendWhatsAppMessage(telefone, mensagem)` (porta existente em `lib/whatsapp/index.ts`, `Promise<WhatsAppResult>`). `{ok:false}` → log e segue (sem retry; a próxima sessão tenta de novo). O eco volta como `saida` e aparece no inbox — esse é o registro do envio.

**Edge aceito:** duas mensagens quase simultâneas do mesmo número podem passar ambas no check e gerar 2 saudações (raro e inócuo). O próprio eco da saudação mantém a sessão viva — não há repetição em sequência normal.

### Módulo puro — `app/lib/whatsapp/bot-saudacao-message.ts` (novo, NÃO `"use server"`)

Espelho de `lembrete-message.ts`: chaves, defaults e lógica de tempo, sem I/O.

```ts
export const BOT_SAUDACAO_FLAG_KEY = "whatsapp_bot_saudacao_ativo"
export const BOT_SAUDACAO_MSG_KEY = "whatsapp_bot_saudacao_msg"
export const BOT_SAUDACAO_JANELA_KEY = "whatsapp_bot_saudacao_janela_horas"

export const DEFAULT_BOT_SAUDACAO_JANELA_HORAS = 24
export const DEFAULT_BOT_SAUDACAO_MSG =
  "Oi! 🍻 Você falou com o ALFA Chopp Delivery. Pra fazer seu pedido é só acessar https://www.alfachopp.com.br — e qualquer dúvida, responde por aqui que a gente te atende!"

// 1–168h (1 semana); inválido/ausente → default. Mesmo formato do parseHora (FRE-23).
export const parseJanelaHoras = (valor: string | null | undefined): number => {
  if (!valor || valor.trim() === "") return DEFAULT_BOT_SAUDACAO_JANELA_HORAS
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 && n <= 168 ? n : DEFAULT_BOT_SAUDACAO_JANELA_HORAS
}

// Sessão nova = sem mensagem anterior, ou a anterior é mais velha que a janela.
// Boundary exato (= janela) e timestamps inválidos/futuros contam como sessão ATIVA (fail-closed).
export const isSessaoNova = (
  anteriorIso: string | null,
  agora: Date,
  janelaHoras: number,
): boolean => {
  if (anteriorIso === null) return true
  return agora.getTime() - Date.parse(anteriorIso) > janelaHoras * 3_600_000
}
```

(`Date.parse` inválido → `NaN` → comparação `false` → não envia. Anterior no futuro → diff negativo → não envia.)

### Configs (3 chaves em `configuracoes`, sem seed)

| chave | default (no código) |
|---|---|
| `whatsapp_bot_saudacao_ativo` | OFF (`'true'` é o único valor que liga) |
| `whatsapp_bot_saudacao_msg` | `DEFAULT_BOT_SAUDACAO_MSG` |
| `whatsapp_bot_saudacao_janela_horas` | `24` |

A flag **não** entra em `WHATSAPP_FEATURE_KEYS`/`isWhatsappFeatureEnabled` (helper fail-open, semântica errada pro bot) nem vira 4º switch do painel Recursos — o bot tem painel e gate próprios.

### Server actions — `app/lib/whatsapp/admin-actions.ts`

Mesmo padrão das actions do lembrete (`requireAdmin`, upsert+select com `onConflict: "chave"`, guard `error || !data?.length`):

```ts
export type BotSaudacaoConfig = { ativo: boolean; janelaHoras: number; mensagem: string }

getWhatsappBotSaudacaoConfig(): Promise<BotSaudacaoConfig>   // lê as 3 chaves; ausente → default
setWhatsappBotSaudacaoFlag(ativo: boolean): Promise<{ ok: boolean }>
setWhatsappBotSaudacaoJanela(horas: number): Promise<{ ok: boolean }>   // guarda 1–168 int antes do DB
setWhatsappBotSaudacaoMessage(mensagem: string): Promise<{ ok: boolean }>  // vazia → volta ao default
```

### Painel — `app/components/admin/whatsapp-bot-panel.tsx` (novo)

Espelho do `whatsapp-lembrete-panel.tsx`: header com ícone (`Bot` do lucide) + Switch master + status; collapse **fechado por padrão** ("Mensagem e janela") com `Textarea` da mensagem + `Select` da janela (6h / 12h / 24h / 48h) + Salvar (disabled sem diff) + Restaurar padrão + "Salvo ✓". Nota fixa no painel: "Requer Conversas (atendimento) ativas." Primitivos de `@/components/ui`.

### Página — `app/app/admin/(authenticated)/whatsapp/page.tsx`

`getWhatsappBotSaudacaoConfig()` entra no `Promise.all` existente; `<WhatsappBotPanel initial={botSaudacao} />` renderiza abaixo do painel de lembrete, acima de Conversas.

### Copy do Recursos — `app/components/admin/whatsapp-features-panel.tsx`

Rodapé atual (linha 10): "Ele NÃO responde sozinho (sem robô) e NÃO traz o histórico antigo de conversas."
Novo (estático, correto nos dois estados da flag): "Ele só responde sozinho com a saudação automática (painel abaixo), se ligada — e NÃO traz o histórico antigo de conversas."

## Tratamento de erro

- Tudo dentro de `after()` + try/catch: falha em config, conversa, sessão ou envio → `console.error` e silêncio. A resposta 200 pro EC2 **nunca** é afetada.
- Fail-closed em todos os ramos ambíguos: erro de leitura → não envia; conversa não achada → não envia; timestamp inválido → não envia.
- `sendWhatsAppMessage` `{ok:false}` → log e segue (saudação não é crítica; sem retry).
- Actions do painel: mesmo contrato das existentes (`{ ok: boolean }`, validação antes do DB).

## Testes

- **Unit (módulo puro):** `parseJanelaHoras` (null/`''`/`'abc'`/`'0'`/`'169'` → 24; `'6'`/`'48'`/`'168'` → n). `isSessaoNova` (null → true; anterior dentro da janela → false; fora → true; boundary exato → false; ISO inválido → false; futuro → false). Vitest.
- **Orquestrador (mocks, padrão `lembrete.test.ts` — `vi.mock` de supabase/service e da porta de envio, fake timers):** flag OFF → não consulta conversa nem envia; erro na leitura de config → não envia (fail-closed); sessão ativa → não envia; sessão nova → envia exatamente a mensagem configurada (e a default quando não há config); send `{ok:false}` → não lança.
- **Rota:** sem teste unitário próprio (rotas não têm padrão de teste no repo — a do lembrete também foi validada via curl). O guard `direcao === "entrada"` é uma condição de uma linha; e mesmo sem ele a checagem de sessão já impediria loop (o eco da saudação chega como `saida` segundos depois da mensagem do cliente → sessão ativa → não envia). O guard é defesa em profundidade + correção semântica (resposta do admin a thread parada não deve disparar saudação). Validado no E2E (b).
- **E2E (manual, staging — entra no roteiro da FRE-4):** (a) flag ON + mensagem real do número de teste após 24h de silêncio (ou janela 6h pra encurtar) → saudação chega no telefone e aparece no inbox como `saida`; (b) segunda mensagem em seguida → sem nova saudação; (c) flag OFF → silêncio; (d) atendimento OFF → silêncio (nem persiste).

## Arquivos

**Novos**
- `app/lib/whatsapp/bot-saudacao-message.ts` — módulo puro (chaves, defaults, `parseJanelaHoras`, `isSessaoNova`).
- `app/lib/whatsapp/bot-saudacao-message.test.ts` — testes do módulo puro.
- `app/lib/whatsapp/bot-saudacao.ts` — orquestrador `maybeSendBotSaudacao` (service client, nunca lança).
- `app/lib/whatsapp/bot-saudacao.test.ts` — testes do orquestrador (mocks).
- `app/components/admin/whatsapp-bot-panel.tsx` — painel do bot.

**Modificados**
- `app/app/api/whatsapp/inbound/route.ts` — engate `after()` pós-RPC, só com `direcao === "entrada"`.
- `app/lib/whatsapp/admin-actions.ts` — `BotSaudacaoConfig` + 4 actions.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — config no `Promise.all` + painel.
- `app/components/admin/whatsapp-features-panel.tsx` — copy do rodapé.

**Sem migration, sem env nova, sem mudança no EC2.**

## Decisões travadas

1. Escopo: só etapa 1 (rule-based); agente LLM = ciclo próprio. ✅
2. Gatilho por sessão (silêncio em QUALQUER direção mantém sessão viva). ✅
3. Janela 24h default, configurável (Select 6/12/24/48h; parse aceita 1–168). ✅
4. Abordagem A: hook na rota inbound + `after()`. ✅
5. Flag default OFF + fail-closed; fora de `WHATSAPP_FEATURE_KEYS`. ✅
6. Sem migration/env/EC2; sem tokens na mensagem; sem registro em `mensagens_whatsapp`. ✅
7. Copy do Recursos reescrita (estática, aponta pro painel do bot). ✅
