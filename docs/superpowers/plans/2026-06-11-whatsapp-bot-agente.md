# FRE-25 etapa 2 — Atendente automático (IA) via Amazon Bedrock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um agente LLM (Claude Haiku 4.5 via Amazon Bedrock) responde automaticamente às mensagens dos clientes no WhatsApp — cumprimenta e responde dúvidas comuns com base em dados reais (cardápio do banco + FAQ editável), com guardrails no prompt, default OFF e fail-closed.

**Architecture:** Reusa o engate de inbound da etapa 1. Um coordenador agente-primeiro: para cada `entrada`, se a flag do agente está ligada o agente assume (e a saudação rule-based é suprimida); senão cai na saudação. O agente roda em `after()`, monta um system prompt puro (guardrails + cardápio + FAQ), chama um seam fino do Bedrock, envia via `sendWhatsAppMessage` e grava a resposta como `saida` (insert direto) pra aparecer no inbox. Nunca lança; qualquer erro de infra = silêncio.

**Tech Stack:** Next.js 16 (`after`), TypeScript, Vitest, Supabase service client, **`@anthropic-ai/bedrock-sdk`** (Claude Haiku 4.5, `us-east-1`), Tailwind v4, primitivos `@/components/ui`.

**Spec:** `docs/superpowers/specs/2026-06-11-whatsapp-bot-agente-design.md`

---

## File Structure

**Novos**
- `app/lib/whatsapp/bot-agente-kb.ts` — módulo puro: chaves de config, `agenteAtivo` (fail-closed), `DEFAULT_AGENTE_FAQ`, `formatCardapio`, `formatHistorico`, `buildSystemPrompt` (guardrails). Sem I/O.
- `app/lib/whatsapp/bot-agente-kb.test.ts` — testes do módulo puro.
- `app/lib/whatsapp/bedrock.ts` — seam fino do Bedrock: `askClaude(system, messages)` → texto ou `null`. Único arquivo que conhece o SDK.
- `app/lib/whatsapp/bedrock.test.ts` — testes do seam (SDK mockado).
- `app/lib/whatsapp/bot-agente.ts` — orquestrador `maybeReplyWithAgent` (lê config/conversa/thread/produtos, monta prompt, chama o seam, envia, grava o `saida`). Nunca lança.
- `app/lib/whatsapp/bot-agente.test.ts` — testes do orquestrador (seam + supabase + envio mockados).
- `app/components/admin/whatsapp-agente-panel.tsx` — painel (Switch + FAQ editável).

**Modificados**
- `app/app/api/whatsapp/inbound/route.ts` — coordenador agente-primeiro (fallback saudação).
- `app/lib/whatsapp/admin-actions.ts` — `AgenteConfig` + 3 actions.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — config no `Promise.all` + painel.
- `app/package.json` — dependência `@anthropic-ai/bedrock-sdk`.

**Ordem de build:** módulo puro → seam Bedrock → orquestrador → coordenador na rota → actions → painel/página. Cada passo compila e testa sozinho. Default OFF + fail-closed → qualquer deploy parcial é inerte.

---

### Task 1: Módulo puro `bot-agente-kb.ts`

**Files:**
- Create: `app/lib/whatsapp/bot-agente-kb.ts`
- Test: `app/lib/whatsapp/bot-agente-kb.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/lib/whatsapp/bot-agente-kb.test.ts
import { describe, it, expect } from "vitest"
import {
  agenteAtivo,
  formatCardapio,
  formatHistorico,
  buildSystemPrompt,
  DEFAULT_AGENTE_FAQ,
  type CardapioItem,
  type ThreadMsg,
} from "./bot-agente-kb"

describe("agenteAtivo (fail-closed: só 'true' liga)", () => {
  it("liga apenas com 'true'", () => {
    expect(agenteAtivo("true")).toBe(true)
    expect(agenteAtivo(" TRUE ")).toBe(true)
  })
  it("desliga para tudo o mais", () => {
    for (const v of [null, undefined, "", "false", "1", "sim"]) expect(agenteAtivo(v)).toBe(false)
  })
})

describe("formatCardapio", () => {
  const itens: CardapioItem[] = [
    { nome: "Chopp Pilsen", volume_litros: 30, descricao: "Leve e refrescante", preco_avista: 380, preco_segundo_barril: 350 },
    { nome: "Chopp IPA", volume_litros: 50, descricao: null, preco_avista: 620, preco_segundo_barril: null },
  ]
  it("inclui nome, volume e preço à vista em BRL", () => {
    const txt = formatCardapio(itens)
    expect(txt).toContain("Chopp Pilsen")
    expect(txt).toContain("30L")
    expect(txt).toMatch(/R\$\s?380,00/)
  })
  it("mostra o preço do 2º barril quando houver e omite quando null", () => {
    const txt = formatCardapio(itens)
    expect(txt).toMatch(/2º barril.*R\$\s?350,00/)
    // IPA não tem 2º barril -> não inventa um
    const ipaLinha = txt.split("\n").find((l) => l.includes("Chopp IPA")) ?? ""
    expect(ipaLinha).not.toContain("2º barril")
  })
  it("lista vazia -> aviso curto, não quebra", () => {
    expect(formatCardapio([])).toMatch(/sem itens|indispon/i)
  })
})

describe("formatHistorico", () => {
  it("mapeia entrada->Cliente e saida->Atendente em ordem", () => {
    const thread: ThreadMsg[] = [
      { direcao: "entrada", corpo: "oi" },
      { direcao: "saida", corpo: "Olá! 🍻" },
      { direcao: "entrada", corpo: "qual o horário?" },
    ]
    expect(formatHistorico(thread)).toBe("Cliente: oi\nAtendente: Olá! 🍻\nCliente: qual o horário?")
  })
  it("thread vazia -> string vazia", () => {
    expect(formatHistorico([])).toBe("")
  })
})

describe("buildSystemPrompt", () => {
  it("contém os guardrails, o cardápio e a FAQ", () => {
    const sys = buildSystemPrompt({ cardapio: "CARDAPIO_AQUI", faq: "FAQ_AQUI" })
    expect(sys).toContain("NUNCA invente")
    expect(sys).toContain("CARDAPIO_AQUI")
    expect(sys).toContain("FAQ_AQUI")
  })
  it("usa o primeiro nome do cliente quando passado", () => {
    const sys = buildSystemPrompt({ cardapio: "c", faq: "f", nomeCliente: "Marcus Gonçalves" })
    expect(sys).toContain("Marcus")
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd app && npx vitest run lib/whatsapp/bot-agente-kb.test.ts`
Expected: FAIL — `Cannot find module './bot-agente-kb'`.

- [ ] **Step 3: Implementar o módulo puro**

```ts
// app/lib/whatsapp/bot-agente-kb.ts

export const AGENTE_FLAG_KEY = "whatsapp_bot_agente_ativo" as const
export const AGENTE_FAQ_KEY = "whatsapp_bot_agente_faq" as const

// Fail-closed (igual ao bot da etapa 1): só o literal "true" liga.
export const agenteAtivo = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() === "true"

export const DEFAULT_AGENTE_FAQ = `Horário: todos os dias, 10h às 22h.
Pagamento: Pix, cartão (crédito/débito) e dinheiro na entrega.
Cobertura: RJ e Baixada Fluminense. O endereço exato é confirmado na hora do pedido no site.
Como pedir: pelo site https://www.alfachopp.com.br.`

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

export type CardapioItem = {
  nome: string
  volume_litros: number
  descricao: string | null
  preco_avista: number
  preco_segundo_barril: number | null
}

// Cardápio -> bloco de texto pro prompt. Uma linha por item; 2º barril só quando existir.
export const formatCardapio = (itens: CardapioItem[]): string => {
  if (itens.length === 0) return "(Cardápio sem itens disponíveis no momento.)"
  return itens
    .map((i) => {
      const desc = i.descricao ? ` — ${i.descricao}` : ""
      const segundo = i.preco_segundo_barril != null ? ` (2º barril: ${brl(i.preco_segundo_barril)})` : ""
      return `- ${i.nome} ${i.volume_litros}L${desc}: ${brl(i.preco_avista)}${segundo}`
    })
    .join("\n")
}

export type ThreadMsg = { direcao: "entrada" | "saida"; corpo: string }

// Histórico recente -> texto "Cliente:/Atendente:" em ordem cronológica.
export const formatHistorico = (thread: ThreadMsg[]): string =>
  thread.map((m) => `${m.direcao === "entrada" ? "Cliente" : "Atendente"}: ${m.corpo}`).join("\n")

// System prompt: papel + guardrails + cardápio + FAQ. nomeCliente opcional p/ personalizar.
export const buildSystemPrompt = (args: {
  cardapio: string
  faq: string
  nomeCliente?: string | null
}): string => {
  const primeiroNome = args.nomeCliente?.trim().split(" ")[0]
  const saudacaoNome = primeiroNome ? ` O cliente se chama ${primeiroNome} — pode chamar pelo primeiro nome.` : ""
  return `Você é o atendente virtual da ALFA Chopp Delivery no WhatsApp.${saudacaoNome}
Responda em português do Brasil, de forma cordial e breve (2 a 3 frases), em tom de WhatsApp.

REGRAS IMPORTANTES:
- Responda SOMENTE com base nas informações abaixo.
- NUNCA invente preço, prazo, promoção, taxa ou área de entrega. Se a informação não estiver abaixo, NÃO chute: responda algo como "Boa pergunta! Vou confirmar com a equipe e já te respondo por aqui."
- Para fechar o pedido, oriente o cliente a acessar o site https://www.alfachopp.com.br (lá o endereço é validado).
- Não peça nem registre dados pessoais ou de pagamento por aqui.

CARDÁPIO (preços atuais):
${args.cardapio}

INFORMAÇÕES (FAQ):
${args.faq}`
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `cd app && npx vitest run lib/whatsapp/bot-agente-kb.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/bot-agente-kb.ts app/lib/whatsapp/bot-agente-kb.test.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): módulo puro do agente IA (cardápio, FAQ, guardrails, prompt)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Seam do Bedrock `bedrock.ts`

**Files:**
- Create: `app/lib/whatsapp/bedrock.ts`
- Test: `app/lib/whatsapp/bedrock.test.ts`
- Modify: `app/package.json` (dependência `@anthropic-ai/bedrock-sdk`)

- [ ] **Step 1: Instalar a dependência**

Run: `cd app && npm install @anthropic-ai/bedrock-sdk`
Expected: adiciona `@anthropic-ai/bedrock-sdk` em `dependencies` do `app/package.json`.
⚠️ Disco da máquina local pode estar apertado — se der `ENOSPC`, libere espaço (ex.: `rm -rf app/.next`) e tente de novo.

- [ ] **Step 2: Escrever o teste que falha** (SDK mockado — não chama AWS)

```ts
// app/lib/whatsapp/bedrock.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const createMock = vi.fn()
vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  // o SDK exporta a classe como default; mockamos o construtor com um messages.create
  default: class {
    messages = { create: createMock }
  },
}))

import { askClaude } from "./bedrock"

beforeEach(() => createMock.mockReset())

describe("askClaude", () => {
  it("retorna o texto concatenado dos blocos de texto", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "Olá! " }, { type: "text", text: "🍻" }] })
    const r = await askClaude("system", [{ role: "user", content: "oi" }])
    expect(r).toBe("Olá! 🍻")
  })
  it("retorna null quando o Bedrock lança", async () => {
    createMock.mockRejectedValue(new Error("bedrock down"))
    expect(await askClaude("s", [{ role: "user", content: "oi" }])).toBeNull()
  })
  it("retorna null quando a resposta vem vazia", async () => {
    createMock.mockResolvedValue({ content: [] })
    expect(await askClaude("s", [{ role: "user", content: "oi" }])).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd app && npx vitest run lib/whatsapp/bedrock.test.ts`
Expected: FAIL — `Cannot find module './bedrock'`.

- [ ] **Step 4: Implementar o seam**

```ts
// app/lib/whatsapp/bedrock.ts
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"

// Inference profile do Bedrock p/ Claude Haiku 4.5.
// NOTE: confirmar o ID exato contra a conta/região no teste manual do Bedrock — os testes
// unitários mockam o SDK e NÃO validam este valor; um ID errado só falha em runtime (InvokeModel).
const MODEL_ID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

export type ChatMsg = { role: "user" | "assistant"; content: string }

// Chama o Claude via Bedrock. Retorna o texto da resposta, ou null em QUALQUER erro
// (o orquestrador trata null como "ficar em silêncio"). Credenciais AWS vêm dos envs
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION) via a cadeia padrão do SDK.
export const askClaude = async (system: string, messages: ChatMsg[]): Promise<string | null> => {
  try {
    const client = new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "us-east-1" })
    const res = await client.messages.create({ model: MODEL_ID, max_tokens: 400, system, messages })
    const text = (res.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim()
    return text || null
  } catch (err) {
    console.error("[whatsapp] erro no Bedrock:", err)
    return null
  }
}
```

- [ ] **Step 5: Rodar e confirmar que passa + typecheck**

Run: `cd app && npx vitest run lib/whatsapp/bedrock.test.ts && npx tsc --noEmit`
Expected: PASS; typecheck limpo.

- [ ] **Step 6: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/bedrock.ts app/lib/whatsapp/bedrock.test.ts app/package.json app/package-lock.json
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): seam do Bedrock (askClaude, Haiku 4.5, null em erro)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Orquestrador `bot-agente.ts`

**Files:**
- Create: `app/lib/whatsapp/bot-agente.ts`
- Test: `app/lib/whatsapp/bot-agente.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/lib/whatsapp/bot-agente.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))
vi.mock("./bedrock", () => ({ askClaude: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { askClaude } from "./bedrock"
import { maybeReplyWithAgent } from "./bot-agente"

const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)
const askMock = vi.mocked(askClaude)

// Fake do service client por tabela. mensagens_conversa_whatsapp serve select (thread) E insert (gravar).
const fakeClient = (opts: {
  cfgRows?: { chave: string; valor: string }[]
  cfgErr?: unknown
  conversa?: { id: string; nome_exibicao: string | null } | null
  thread?: { direcao: "entrada" | "saida"; corpo: string }[]
  produtos?: unknown[]
}) => {
  const insertSpy = vi.fn(() => Promise.resolve({ error: null }))
  const cfg = { select: () => ({ in: () => Promise.resolve({ data: opts.cfgRows ?? [], error: opts.cfgErr ?? null }) }) }
  const conv = { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.conversa ?? null, error: null }) }) }) }
  const msgs = {
    select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: opts.thread ?? [], error: null }) }) }) }),
    insert: insertSpy,
  }
  const prod = { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: opts.produtos ?? [], error: null }) }) }) }
  const from = vi.fn((t: string) =>
    t === "configuracoes" ? cfg : t === "conversas_whatsapp" ? conv : t === "produtos" ? prod : msgs,
  )
  return { client: { from }, from, insertSpy }
}

const ON = { chave: "whatsapp_bot_agente_ativo", valor: "true" }

beforeEach(() => {
  clientMock.mockReset()
  sendMock.mockReset()
  askMock.mockReset()
  sendMock.mockResolvedValue({ ok: true })
})

describe("maybeReplyWithAgent", () => {
  it("flag off -> handled:false e NÃO chama o Bedrock", async () => {
    const { client } = fakeClient({ cfgRows: [{ chave: "whatsapp_bot_agente_ativo", valor: "false" }] })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: false })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("erro ao ler config -> handled:false (deixa a saudação assumir)", async () => {
    const { client } = fakeClient({ cfgErr: { message: "boom" } })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: false })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("flag on mas conversa não encontrada -> handled:true sem chamar Bedrock", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: null })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: true })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("flag on -> monta prompt, chama Bedrock, envia e grava o saida", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_agente_faq", valor: "Horário: 10h-22h." }],
      conversa: { id: "conv-1", nome_exibicao: "Marcus" },
      thread: [{ direcao: "entrada", corpo: "qual o horário?" }],
      produtos: [{ nome: "Chopp Pilsen", volume_litros: 30, descricao: null, preco_avista: 380, preco_segundo_barril: null }],
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue("Funcionamos das 10h às 22h! 🍻")

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "qual o horário?")

    expect(r).toEqual({ handled: true })
    // system prompt levou guardrails + cardápio + FAQ
    const [systemArg, messagesArg] = askMock.mock.calls[0]
    expect(systemArg).toContain("NUNCA invente")
    expect(systemArg).toContain("Chopp Pilsen")
    expect(systemArg).toContain("Horário: 10h-22h.")
    expect(messagesArg[0]).toMatchObject({ role: "user" })
    expect(messagesArg[0].content).toContain("qual o horário?")
    // enviou a resposta e gravou como saida
    expect(sendMock).toHaveBeenCalledWith("5521999990000", "Funcionamos das 10h às 22h! 🍻")
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0][0]).toMatchObject({ conversa_id: "conv-1", direcao: "saida", corpo: "Funcionamos das 10h às 22h! 🍻" })
  })

  it("Bedrock retorna null -> não envia nem grava, não lança, handled:true", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1", nome_exibicao: null },
      thread: [{ direcao: "entrada", corpo: "oi" }],
      produtos: [],
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue(null)

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")

    expect(r).toEqual({ handled: true })
    expect(sendMock).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd app && npx vitest run lib/whatsapp/bot-agente.test.ts`
Expected: FAIL — `Cannot find module './bot-agente'`.

- [ ] **Step 3: Implementar o orquestrador**

```ts
// app/lib/whatsapp/bot-agente.ts
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { askClaude } from "./bedrock"
import {
  AGENTE_FLAG_KEY,
  AGENTE_FAQ_KEY,
  DEFAULT_AGENTE_FAQ,
  agenteAtivo,
  formatCardapio,
  formatHistorico,
  buildSystemPrompt,
  type CardapioItem,
  type ThreadMsg,
} from "./bot-agente-kb"

// Atendente IA. Chamado via after() na rota inbound, só para ENTRADA. Nunca lança; fail-closed.
// Retorna { handled: true } sempre que a flag do agente está ligada (tenha enviado ou não) —
// assim o coordenador suprime a saudação rule-based. { handled: false } = flag off (ou config
// ilegível) => o coordenador cai na saudação da etapa 1.
export const maybeReplyWithAgent = async (
  telefone: string,
  waMessageId: string,
  corpo: string,
): Promise<{ handled: boolean }> => {
  try {
    const supabase = createServiceClient()

    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [AGENTE_FLAG_KEY, AGENTE_FAQ_KEY])
    if (cfgErr) {
      console.error("[whatsapp] erro lendo config do agente:", cfgErr)
      return { handled: false } // não dá pra afirmar que o agente está on -> deixa a saudação assumir
    }

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    if (!agenteAtivo(valorDe(AGENTE_FLAG_KEY))) return { handled: false }

    // Daqui pra baixo o agente "é dono" do turno (handled:true), mesmo que fique em silêncio.
    const rawFaq = valorDe(AGENTE_FAQ_KEY)
    const faq = rawFaq && rawFaq.trim() ? rawFaq : DEFAULT_AGENTE_FAQ

    const { data: conversa } = await supabase
      .from("conversas_whatsapp")
      .select("id, nome_exibicao")
      .eq("telefone", telefone)
      .maybeSingle()
    if (!conversa) return { handled: true }

    const { data: threadDesc } = await supabase
      .from("mensagens_conversa_whatsapp")
      .select("direcao, corpo, ocorrida_em")
      .eq("conversa_id", conversa.id)
      .order("ocorrida_em", { ascending: false })
      .limit(8)
    const thread: ThreadMsg[] = ((threadDesc ?? []) as { direcao: "entrada" | "saida"; corpo: string }[])
      .map((m) => ({ direcao: m.direcao, corpo: m.corpo }))
      .reverse() // cronológico

    const { data: produtos } = await supabase
      .from("produtos")
      .select("nome, volume_litros, descricao, preco_avista, preco_segundo_barril")
      .eq("ativo", true)
      .order("nome")

    const cardapio = formatCardapio((produtos ?? []) as CardapioItem[])
    const system = buildSystemPrompt({ cardapio, faq, nomeCliente: conversa.nome_exibicao })

    const historico = formatHistorico(thread)
    const userContent = historico
      ? `Conversa recente:\n${historico}\n\nResponda à última mensagem do cliente, seguindo as regras.`
      : corpo

    const reply = await askClaude(system, [{ role: "user", content: userContent }])
    if (!reply) return { handled: true } // erro/timeout/vazio -> silêncio

    const result = await sendWhatsAppMessage(telefone, reply)
    if (!result.ok) {
      console.error("[whatsapp] falha ao enviar resposta do agente:", telefone, result.error)
      return { handled: true }
    }

    // grava a resposta como saida (insert direto: NÃO usa o RPC de inbound, então não toca no
    // cliente_id da conversa; este EC2 não devolve eco, por isso gravamos nós mesmos).
    const { error: insErr } = await supabase.from("mensagens_conversa_whatsapp").insert({
      conversa_id: conversa.id,
      wa_message_id: `agente-${crypto.randomUUID()}`,
      direcao: "saida",
      corpo: reply,
      ocorrida_em: new Date().toISOString(),
    })
    if (insErr) console.error("[whatsapp] erro gravando resposta do agente:", insErr)

    return { handled: true }
  } catch (err) {
    console.error("[whatsapp] erro inesperado no agente:", err)
    // erro inesperado com a flag possivelmente on: handled:true evita uma saudação dobrada por cima.
    return { handled: true }
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passam + typecheck**

Run: `cd app && npx vitest run lib/whatsapp/bot-agente.test.ts && npx tsc --noEmit`
Expected: PASS (5 testes); typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/bot-agente.ts app/lib/whatsapp/bot-agente.test.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): orquestrador do agente IA (prompt + Bedrock + envio + grava saida)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Coordenador agente-primeiro na rota inbound

**Files:**
- Modify: `app/app/api/whatsapp/inbound/route.ts`

- [ ] **Step 1: Adicionar o import do orquestrador**

Junto aos outros imports de `@/lib/whatsapp/*` (perto do import de `maybeSendBotSaudacao`), adicionar:

```ts
import { maybeReplyWithAgent } from "@/lib/whatsapp/bot-agente"
```

- [ ] **Step 2: Trocar o disparo da saudação pelo coordenador agente-primeiro**

Substituir o bloco atual:

```ts
  // Bot: só responde a mensagens de ENTRADA (nossos próprios envios voltam como "saida" e são
  // ignorados — anti-loop). Roda pós-resposta via after(); a flag/janela são checadas lá dentro.
  if (payload.direcao === "entrada") {
    after(() => maybeSendBotSaudacao(telefoneE164, payload.waMessageId))
  }
```

por:

```ts
  // Auto-resposta: só para ENTRADA (nossos envios voltam como "saida" e são ignorados — anti-loop).
  // Coordenador agente-primeiro: se o agente IA está ligado, ele assume (e suprime a saudação);
  // senão, cai na saudação rule-based. Tudo via after(), pós-resposta; flags checadas lá dentro.
  if (payload.direcao === "entrada") {
    after(async () => {
      const { handled } = await maybeReplyWithAgent(telefoneE164, payload.waMessageId, payload.corpo)
      if (!handled) await maybeSendBotSaudacao(telefoneE164, payload.waMessageId)
    })
  }
```

- [ ] **Step 3: Verificar typecheck e a suíte inteira**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: typecheck limpo; toda a suíte passa.

- [ ] **Step 4: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add "app/app/api/whatsapp/inbound/route.ts"
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): coordenador agente-primeiro na rota inbound (fallback saudação)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Server actions de config no `admin-actions.ts`

**Files:**
- Modify: `app/lib/whatsapp/admin-actions.ts`

- [ ] **Step 1: Adicionar o import do módulo puro**

Após o bloco de import do bot da etapa 1 (`} from "./bot-saudacao-message"`), adicionar:

```ts
import {
  AGENTE_FLAG_KEY,
  AGENTE_FAQ_KEY,
  DEFAULT_AGENTE_FAQ,
  agenteAtivo,
} from "./bot-agente-kb"
```

- [ ] **Step 2: Acrescentar o tipo + 3 actions no fim do arquivo**

```ts
export type AgenteConfig = { ativo: boolean; faq: string }

export const getWhatsappAgenteConfig = async (): Promise<AgenteConfig> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [AGENTE_FLAG_KEY, AGENTE_FAQ_KEY])

  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor
  const rawFaq = valorDe(AGENTE_FAQ_KEY)

  return {
    // fail-closed (igual ao gate do orquestrador): o painel reflete o que o agente faz de verdade
    ativo: agenteAtivo(valorDe(AGENTE_FLAG_KEY)),
    faq: rawFaq && rawFaq.trim() ? rawFaq : DEFAULT_AGENTE_FAQ,
  }
}

export const setWhatsappAgenteFlag = async (ativo: boolean): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: AGENTE_FLAG_KEY, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappAgenteFaq = async (texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  // texto vazio = restaurar padrão (operador reseta sem saber o texto original)
  const valor = texto.trim() ? texto : DEFAULT_AGENTE_FAQ

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: AGENTE_FAQ_KEY, valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: limpo. (Sem testes unitários — `admin-actions.ts` não tem padrão de teste no repo.)

- [ ] **Step 4: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/admin-actions.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): actions de config do agente IA (flag + FAQ)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Painel + wiring na página

**Files:**
- Create: `app/components/admin/whatsapp-agente-panel.tsx`
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`

- [ ] **Step 1: Criar o painel**

```tsx
// app/components/admin/whatsapp-agente-panel.tsx
"use client"

import { useState, useTransition } from "react"
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Button } from "@/components/ui"
import {
  setWhatsappAgenteFlag,
  setWhatsappAgenteFaq,
  type AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_AGENTE_FAQ } from "@/lib/whatsapp/bot-agente-kb"

type Props = { initial: AgenteConfig }

const WhatsappAgentePanel = ({ initial }: Props) => {
  const [ativo, setAtivo] = useState(initial.ativo)
  const [faq, setFaq] = useState(initial.faq)
  const [rascunho, setRascunho] = useState(initial.faq)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const salvarFaq = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_AGENTE_FAQ
        setRascunho(final)
        setFaq(final)
        setSalvo(true)
      } else {
        setErro("Não consegui salvar as informações.")
      }
    })
  }

  const restaurar = () => {
    setErro(null)
    setSalvo(false)
    setRascunho(DEFAULT_AGENTE_FAQ)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(DEFAULT_AGENTE_FAQ)
      if (ok) {
        setFaq(DEFAULT_AGENTE_FAQ)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Sparkles className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Atendente automático (IA)</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Responde sozinho às dúvidas dos clientes (cardápio, horário, pagamento). Quando ligado,
            substitui a saudação automática. Requer o Atendimento ligado.
          </p>
        </div>
        <Switch
          id="whatsapp_bot_agente_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Atendente automático (IA)"
        />
      </div>

      {ativo && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex w-full items-center gap-2 text-sm text-brand-warm-gray hover:text-white transition-colors"
          >
            {aberto ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">Informações que o atendente pode usar</span>
          </button>

          {aberto && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-brand-warm-gray">
                Horário, formas de pagamento, cobertura, como pedir. O cardápio e os preços vêm do
                catálogo automaticamente — não precisa repetir aqui.
              </p>
              <Textarea
                rows={6}
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value)
                  setSalvo(false)
                }}
                aria-label="Informações do atendente"
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={salvarFaq} disabled={rascunho === faq}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={restaurar}>
                  Restaurar padrão
                </Button>
                {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
              </div>
              <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
                O atendente nunca inventa preço ou prazo: quando não sabe, pede pra confirmar com a
                equipe. Suas respostas aparecem nas Conversas abaixo.
              </p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappAgentePanel
```

- [ ] **Step 2: Conectar na página**

Em `app/app/admin/(authenticated)/whatsapp/page.tsx`:

Adicionar `getWhatsappAgenteConfig` ao import existente de `@/lib/whatsapp/admin-actions` (linha 1) e o import do componente após o do bot da etapa 1:

```ts
import WhatsappAgentePanel from "@/components/admin/whatsapp-agente-panel"
```

Adicionar a config ao `Promise.all` (após `getWhatsappBotSaudacaoConfig()`), atualizando o destructuring na mesma posição:

```ts
  const [connection, features, statusEntrega, lembrete, botSaudacao, agente, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappStatusEntregaConfig(),
    getWhatsappLembreteConfig(),
    getWhatsappBotSaudacaoConfig(),
    getWhatsappAgenteConfig(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])
```

Renderizar o painel logo abaixo do painel do bot (saudação):

```tsx
          <div className="mt-4">
            <WhatsappAgentePanel initial={agente} />
          </div>
```

- [ ] **Step 3: Verificar typecheck e a suíte**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: typecheck limpo; toda a suíte passa.

- [ ] **Step 4: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/components/admin/whatsapp-agente-panel.tsx "app/app/admin/(authenticated)/whatsapp/page.tsx"
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): painel do atendente IA + wiring na página

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `cd app && npx tsc --noEmit` — limpo.
- [ ] `cd app && npx vitest run` — toda a suíte verde (Tasks 1–3 adicionam ~14 testes).
- [ ] Revisão holística: o agente só envia quando `whatsapp_atendimento_ativo` ON (gate da rota) **e** `whatsapp_bot_agente_ativo` == 'true'; default OFF; `after()` nunca afeta o 200; anti-loop garantido por `direcao === "entrada"` (o `saida` gravado é insert direto, não passa pela rota); erro de infra/Bedrock → silêncio; coordenador agente-primeiro nunca gera mensagem dobrada.
- [ ] Provisionamento (usuário, fora do código): model access do Haiku 4.5 no Bedrock `us-east-1`; usuário IAM `bedrock:InvokeModel`; envs `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION` no Vercel (Preview/staging). Confirmar o ID do inference profile no teste manual.
- [ ] E2E manual em staging (cliente testando) — fora desta entrega.

## Notas de revisão (self-review)

**Spec coverage:** todos os componentes do spec têm task — módulo puro/guardrails (T1), seam Bedrock + dep (T2), orquestrador + gravar saida (T3), coordenador agente-primeiro (T4), actions (T5), painel + página (T6). ✅

**Sem placeholders:** todo passo de código mostra o código completo. A única indefinição declarada é o ID do inference profile do Bedrock (`MODEL_ID`), marcada com NOTE na T2 — é um valor de ambiente a confirmar contra a conta, não código a preencher. ✅

**Consistência de tipos/nomes:** `AGENTE_FLAG_KEY`/`AGENTE_FAQ_KEY`, `agenteAtivo`, `DEFAULT_AGENTE_FAQ`, `CardapioItem`, `ThreadMsg`, `formatCardapio`/`formatHistorico`/`buildSystemPrompt`, `askClaude(system, messages)`/`ChatMsg`, `maybeReplyWithAgent(telefone, waMessageId, corpo) -> { handled }`, `AgenteConfig { ativo, faq }` — idênticos entre tasks. O agente lê a flag fail-closed (`agenteAtivo`, ≠ `parseFlag` fail-open) e fica fora de `WHATSAPP_FEATURE_KEYS`, igual à etapa 1. ✅

**Decisão de granularidade:** o painel (T6) inclui o wiring na página (mesma superfície de UI) em vez de uma task própria, evitando um ciclo extra de revisão para o wiring de 3 linhas. ✅
