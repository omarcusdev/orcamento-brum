# FRE-25 etapa 2 (v1 enxuta) — Atendente automático (IA) no WhatsApp (design)

**Data:** 2026-06-11
**Issue:** FRE-25 (Freelas, projeto "WhatsApp Integration — ALFA Chopp")
**Status:** desenho aprovado nas decisões-chave; pendente revisão do spec escrito.
**Depende de:** FRE-19 (inbound + inbox) + FRE-25 etapa 1 (engate de inbound, anti-loop, flags/painel, `sendWhatsAppMessage`).

## Goal

Um agente LLM responde automaticamente às mensagens dos clientes no WhatsApp — cumprimenta quem chega e responde dúvidas comuns (cardápio/preço, horário, formas de pagamento, como pedir, cobertura de entrega) com base em dados reais, com **guardrails no prompt** contra inventar preço/prazo/promoção. Para o cliente testar. Roda via **Amazon Bedrock** (Claude Haiku 4.5).

## Escopo (v1 enxuta — escolhido pelo usuário)

**Dentro:**
- Agente que responde a cada mensagem `entrada` do cliente (quando ligado): cumprimenta, responde, ou dá um fallback suave quando não sabe.
- Base de conhecimento **híbrida**: cardápio/preços vêm do banco; o resto (horário, pagamento, como pedir, cobertura) de um texto de FAQ **editável** no painel.
- **Guardrails no prompt** (substituem os evals nesta versão).
- Flag liga/desliga própria + FAQ editável no painel (padrão da etapa 1).
- Grava a resposta do agente como `saida` no banco → a conversa (incluindo o que o bot respondeu) aparece no inbox durante o teste.
- Chamada ao LLM via **Amazon Bedrock** (`@anthropic-ai/bedrock-sdk`), Claude **Haiku 4.5**, região `us-east-1`.

**Cortado (fica pra depois):** eval harness; handoff automático (o inbox humano já cobre — o operador assume na mão); RAG/embeddings; rate-limit sofisticado; promoções puxadas do banco (a FAQ editável cobre); responder no nível de bairro a partir do raio (o bot descreve a cobertura em termos humanos e manda validar o endereço no site).

## Decisões-chave (aprovadas no brainstorm)

1. **Base de conhecimento híbrida** — banco (cardápio/preços) + FAQ editável (resto). ✅
2. **Um respondedor só** — quando o agente está ligado, ele assume tudo (cumprimenta + responde); a saudação rule-based (etapa 1) é suprimida. Coordenador no inbound prefere o agente, então nunca há mensagem dobrada mesmo com as duas flags ligadas. ✅
3. **Sem evals e sem handoff automático** nesta v1; guardrails ficam no prompt; o inbox humano é o "handoff" manual. ✅
4. **Amazon Bedrock**, Haiku 4.5, `us-east-1`. ✅

## Arquitetura (reusa a fundação da etapa 1)

### Coordenador no inbound — `app/app/api/whatsapp/inbound/route.ts`

Hoje o route dispara `after(() => maybeSendBotSaudacao(...))` para `entrada`. Passa a dispatar um coordenador **agente-primeiro**:

```ts
if (payload.direcao === "entrada") {
  after(async () => {
    const { handled } = await maybeReplyWithAgent(telefoneE164, payload.waMessageId, payload.corpo)
    if (!handled) await maybeSendBotSaudacao(telefoneE164, payload.waMessageId)
  })
}
```

`maybeReplyWithAgent` retorna `{ handled: true }` sempre que a flag do agente está ligada (tenha enviado ou ficado em silêncio por erro) — assim a saudação da etapa 1 é suprimida. Retorna `{ handled: false }` quando a flag está desligada → cai na saudação. Cada orquestrador continua se auto-gateando (lê a própria flag, fail-closed), mantendo-os independentes e testáveis.

### Orquestrador do agente — `app/lib/whatsapp/bot-agente.ts` (novo)

`maybeReplyWithAgent(telefone, waMessageId, corpo): Promise<{ handled: boolean }>`. Roda no `after()`, com `createServiceClient()`, **nunca lança**, **fail-closed**:

1. Lê a flag `whatsapp_bot_agente_ativo` (+ o FAQ) numa query. Erro de leitura → `{ handled: false }` (deixa a saudação assumir) — exceção ao "agente assume": se nem a config lê, não dá pra afirmar que o agente está on.
2. Flag desligada (fail-closed: só `'true'` liga) → `{ handled: false }`.
3. Busca a conversa por `telefone` (E.164) → pega `id` (e `cliente_id`/`nome_exibicao` p/ personalizar). Sem conversa → `{ handled: true }` (agente está on; só não há o que responder).
4. Lê o **trecho recente** da thread (últimas ~8 msgs da conversa, ordem cronológica) → vira o histórico de mensagens (`entrada`→user, `saida`→assistant). A mensagem atual já está persistida (o route gravou antes do `after()`).
5. Busca os **produtos ativos** (cardápio). Monta a **base de conhecimento** e o **system prompt** (módulo puro).
6. Chama o **seam do Bedrock** `askClaude(system, messages)`.
   - Retorno `null` (qualquer erro/timeout do Bedrock) → log + **silêncio** (não manda lixo), `{ handled: true }`.
   - Resposta vazia/branca → silêncio, `{ handled: true }`.
7. Envia via `sendWhatsAppMessage(telefone, resposta)`. `{ok:false}` → log, `{ handled: true }`.
8. Em sucesso, **grava a resposta** como `saida` (insert direto em `mensagens_conversa_whatsapp` usando o `conversa_id` já em mãos — NÃO usa o RPC de inbound, pra não tocar no `cliente_id` da conversa; `wa_message_id` sintético único `agente-<uuid>`). `{ handled: true }`.

### Base de conhecimento + prompt — `app/lib/whatsapp/bot-agente-kb.ts` (novo, NÃO `"use server"`)

Puro e testável (formatação + texto, sem I/O):

```ts
export const AGENTE_FLAG_KEY = "whatsapp_bot_agente_ativo" as const
export const AGENTE_FAQ_KEY  = "whatsapp_bot_agente_faq" as const

export const agenteAtivo = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() === "true"   // fail-closed, igual ao bot da etapa 1

export const DEFAULT_AGENTE_FAQ = `Horário: todos os dias, 10h às 22h.
Pagamento: Pix, cartão (crédito/débito) e dinheiro na entrega.
Cobertura: RJ e Baixada Fluminense. O endereço exato é confirmado na hora do pedido no site.
Como pedir: pelo site https://www.alfachopp.com.br.`

export type CardapioItem = {
  nome: string; volume_litros: number; descricao: string | null
  preco_avista: number; preco_segundo_barril: number | null
}

// Cardápio -> bloco de texto pro prompt (ignora itens inativos a montante; vazio -> aviso curto).
export const formatCardapio = (itens: CardapioItem[]): string => { /* ... */ }

// Junta papel + guardrails + cardápio + FAQ num único system prompt.
export const buildSystemPrompt = (args: { cardapio: string; faq: string; nomeCliente?: string | null }): string => { /* ... */ }
```

**Guardrails (texto fixo dentro de `buildSystemPrompt`):** papel = atendente cordial da ALFA Chopp Delivery, PT-BR, mensagens curtas (2–3 frases), tom de WhatsApp. Regras: **responda SÓ com base nas informações abaixo; NUNCA invente preço, prazo, promoção ou cobertura; se não souber ou não estiver nas informações, responda algo como _"Boa pergunta! Vou confirmar com a equipe e já te respondo por aqui."_ e não chute;** para fechar o pedido, mande o cliente pro site; não peça dados pessoais/pagamento por aqui.

### Seam do Bedrock — `app/lib/whatsapp/bedrock.ts` (novo)

Fronteira fina e mockável (todo o resto não conhece o SDK):

```ts
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"

// Inference profile do Bedrock p/ Haiku 4.5 (confirmar o ID exato no build/teste — depende da região).
const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

export type ChatMsg = { role: "user" | "assistant"; content: string }

// Retorna o texto da resposta, ou null em qualquer erro (o orquestrador trata null como silêncio).
export const askClaude = async (system: string, messages: ChatMsg[]): Promise<string | null> => {
  try {
    const client = new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "us-east-1" })
    const res = await client.messages.create({ model: MODEL_ID, max_tokens: 400, system, messages })
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim()
    return text || null
  } catch (err) {
    console.error("[whatsapp] erro no Bedrock:", err)
    return null
  }
}
```

Credenciais AWS vêm da cadeia padrão (envs no Vercel). O `@anthropic-ai/bedrock-sdk` expõe a API de Messages da Anthropic apontada pro Bedrock.

### Painel — `app/components/admin/whatsapp-agente-panel.tsx` (novo)

Espelha o painel do bot da etapa 1: ícone (`Bot`/`Sparkles`), Switch master (`whatsapp_bot_agente_ativo`, default OFF), collapse fechado com a **textarea da FAQ** + Salvar/Restaurar + "Salvo ✓". Nota fixa: "Quando ligado, **substitui a saudação automática** — o agente cumprimenta e responde. Requer o Atendimento ligado." Primitivos de `@/components/ui`.

### Página — `app/app/admin/(authenticated)/whatsapp/page.tsx`

`getWhatsappAgenteConfig()` entra no `Promise.all`; `<WhatsappAgentePanel initial={agente} />` renderiza junto dos outros painéis de Recursos (abaixo do painel de saudação).

## Config (chaves em `configuracoes`, sem migration — nascem no 1º save, padrão etapa 1)

| chave | default (no código) |
|---|---|
| `whatsapp_bot_agente_ativo` | OFF (só `'true'` liga; fail-closed) |
| `whatsapp_bot_agente_faq` | `DEFAULT_AGENTE_FAQ` |

A flag NÃO entra em `WHATSAPP_FEATURE_KEYS` (helper fail-open, semântica errada) — mesma decisão da etapa 1.

## Server actions — `app/lib/whatsapp/admin-actions.ts`

Padrão das existentes (`requireAdmin`, upsert+select `{ onConflict: "chave" }`, guard `error || !data?.length`, `revalidatePath`):

```ts
export type AgenteConfig = { ativo: boolean; faq: string }
getWhatsappAgenteConfig(): Promise<AgenteConfig>        // lê flag (agenteAtivo) + faq (vazio→default)
setWhatsappAgenteFlag(ativo: boolean): Promise<{ ok: boolean }>
setWhatsappAgenteFaq(texto: string): Promise<{ ok: boolean }>   // vazio→DEFAULT_AGENTE_FAQ
```

## Amazon Bedrock — o que o usuário provisiona

- Habilitar **model access** do Claude Haiku 4.5 no console do Bedrock, em **`us-east-1`**.
- **Usuário IAM** com permissão mínima `bedrock:InvokeModel` (e `bedrock:InvokeModelWithResponseStream` se um dia usar streaming).
- Envs no Vercel (Preview/staging): **`AWS_ACCESS_KEY_ID`**, **`AWS_SECRET_ACCESS_KEY`**, **`AWS_REGION=us-east-1`**.
- Dependência nova: **`@anthropic-ai/bedrock-sdk`** (em `app/package.json`).
- O ID exato do inference profile do Haiku 4.5 (`us.anthropic.claude-haiku-4-5-…-v1:0`) é confirmado no momento do build/teste contra a conta.

## Tratamento de erro (tudo fail-closed / nunca quebra o webhook)

- O orquestrador roda em `after()` + try/catch → o 200 pro EC2 nunca é afetado; nunca lança.
- Erro de leitura de config → `{ handled: false }` (saudação assume).
- Bedrock erro/timeout/`null`/vazio → **silêncio** (não envia), `{ handled: true }`.
- `sendWhatsAppMessage` `{ok:false}` → log, sem retry.
- Falha ao gravar o `saida` → log, não afeta o envio já feito.
- O **fallback suave** ("vou confirmar com a equipe") é decisão do MODELO via guardrails — em erro de infra o agente fica calado, não manda o fallback.

## Convivência com o humano (sem handoff automático — limitação aceita do v1)

Quando ligado, o agente responde a cada `entrada`. Se o operador quiser conduzir uma conversa na mão, ele **desliga o agente** (ou assume sabendo que o bot também pode responder). O inbox mostra tudo (inclusive as respostas do agente, porque gravamos o `saida`). Roteamento automático/"pausar quando humano está atendendo" fica pra uma próxima versão.

## Testes (sem eval harness; unit tests nos pontos puros e no orquestrador)

- **`bot-agente-kb.test.ts`** (puro): `agenteAtivo` (só `'true'`); `formatCardapio` (item com/sem 2º barril; lista vazia → aviso; valores em BRL); `buildSystemPrompt` (contém os guardrails-chave "NUNCA invente", o cardápio e o texto da FAQ; usa o nome do cliente quando passado). Vitest.
- **`bot-agente.test.ts`** (orquestrador, mocks de `./bedrock`, `@/lib/supabase/service`, `.`): flag off → `{handled:false}` e **não chama o Bedrock**; flag on + msg → monta prompt, chama `askClaude`, envia e grava `saida`, `{handled:true}`; `askClaude`→`null` → **não envia**, não lança, `{handled:true}`; conversa inexistente → `{handled:true}` sem chamar Bedrock. Fake timers/UUID estável conforme necessário.
- **`bedrock.ts`**: é o seam — coberto por mock no orquestrador; sem teste com chamada real. Validação real entra no teste manual (cliente testando) — coerente com "sem evals nesta v1".

## Arquivos

**Novos**
- `app/lib/whatsapp/bot-agente-kb.ts` (+ `.test.ts`) — puro: chaves, `agenteAtivo`, `DEFAULT_AGENTE_FAQ`, `formatCardapio`, `buildSystemPrompt` (guardrails).
- `app/lib/whatsapp/bedrock.ts` — seam `askClaude` (Bedrock, Haiku 4.5).
- `app/lib/whatsapp/bot-agente.ts` (+ `.test.ts`) — orquestrador `maybeReplyWithAgent` (+ gravação do `saida`).
- `app/components/admin/whatsapp-agente-panel.tsx` — painel.

**Modificados**
- `app/app/api/whatsapp/inbound/route.ts` — coordenador agente-primeiro (fallback saudação).
- `app/lib/whatsapp/admin-actions.ts` — `AgenteConfig` + 3 actions.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — config no `Promise.all` + painel.
- `app/package.json` — dependência `@anthropic-ai/bedrock-sdk`.

**Sem migration** (configs nascem via upsert do painel; gravação do `saida` é insert direto na tabela existente). **Env nova** (AWS_* no Vercel) + **model access no Bedrock**.

## Decisões travadas

1. v1 enxuta: agente rule-based-grounded de FAQ; **sem evals, sem handoff automático**. ✅
2. Base híbrida: cardápio/preços do banco (`produtos` ativos: `nome/volume_litros/descricao/preco_avista/preco_segundo_barril`) + FAQ editável pro resto. Área de entrega = texto humano na FAQ + "confirme no site" (o raio do banco não vira resposta de bairro). ✅
3. Um respondedor só: agente assume quando ligado; coordenador agente-primeiro suprime a saudação. ✅
4. Flag própria default OFF + fail-closed; fora de `WHATSAPP_FEATURE_KEYS`. ✅
5. Grava a resposta como `saida` (insert direto, sem mexer no `cliente_id`) → visível no inbox. ✅
6. Amazon Bedrock + `@anthropic-ai/bedrock-sdk`, Haiku 4.5, `us-east-1`, credenciais via env no Vercel, IAM mínimo. ✅
7. Erros de infra → silêncio (fail-closed); fallback suave só por decisão do modelo. ✅
