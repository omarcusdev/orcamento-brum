# FRE-25 etapa 1 — Saudação automática do bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando um cliente manda mensagem no WhatsApp e a conversa estava parada além de uma janela configurável, responder automaticamente com uma saudação editável (boas-vindas + link do site). Nasce desligado e fail-closed.

**Architecture:** Hook na rota inbound existente: depois do RPC persistir um inbound `entrada`, dispara `after(() => maybeSendBotSaudacao(...))` (resposta pro EC2 não espera o envio). O orquestrador lê 3 configs (`configuracoes`), checa flag fail-closed (`'true'`) + janela de sessão (última mensagem anterior à atual) e, se for sessão nova, envia via a porta `sendWhatsAppMessage`. Lógica de tempo isolada num módulo puro testável. Painel novo em `/admin/whatsapp` espelha o do lembrete (FRE-23). Sem migration, sem env, sem mudança no EC2.

**Tech Stack:** Next.js 16 App Router (`after` de `next/server`), TypeScript, Supabase service client, Vitest, Tailwind v4, primitivos `@/components/ui`.

**Spec:** `docs/superpowers/specs/2026-06-10-whatsapp-bot-saudacao-design.md`

---

## File Structure

**Novos**
- `app/lib/whatsapp/bot-saudacao-message.ts` — módulo puro: chaves de config, defaults, `parseJanelaHoras`, `isSessaoNova`, `botSaudacaoAtivo`. Sem I/O. Único lugar com a regra de tempo e o parse fail-closed.
- `app/lib/whatsapp/bot-saudacao-message.test.ts` — testes do módulo puro.
- `app/lib/whatsapp/bot-saudacao.ts` — orquestrador `maybeSendBotSaudacao(telefone, waMessageId)`: service client, gates, envio. Nunca lança.
- `app/lib/whatsapp/bot-saudacao.test.ts` — testes do orquestrador (mocks de service client + porta de envio).
- `app/components/admin/whatsapp-bot-panel.tsx` — painel do bot (Switch master + collapse com Textarea + Select da janela).

**Modificados**
- `app/app/api/whatsapp/inbound/route.ts` — engate `after()` pós-RPC, só com `direcao === "entrada"`.
- `app/lib/whatsapp/admin-actions.ts` — `BotSaudacaoConfig` + 4 actions (get/setFlag/setJanela/setMessage).
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — config no `Promise.all` + render do painel.
- `app/components/admin/whatsapp-features-panel.tsx` — reescrita da copy "NÃO responde sozinho".

**Ordem de build:** módulo puro → orquestrador → hook na rota → actions → painel/página/copy. Cada passo compila e testa sozinho. O default OFF + fail-closed garante que qualquer deploy parcial é inerte (nada envia até o painel ligar).

---

### Task 1: Módulo puro `bot-saudacao-message.ts`

**Files:**
- Create: `app/lib/whatsapp/bot-saudacao-message.ts`
- Test: `app/lib/whatsapp/bot-saudacao-message.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/lib/whatsapp/bot-saudacao-message.test.ts
import { describe, it, expect } from "vitest"
import {
  parseJanelaHoras,
  isSessaoNova,
  botSaudacaoAtivo,
  DEFAULT_BOT_SAUDACAO_JANELA_HORAS,
} from "./bot-saudacao-message"

describe("parseJanelaHoras", () => {
  it("usa o default para nulo/vazio/inválido/fora do range", () => {
    for (const v of [null, undefined, "", "   ", "abc", "0", "169", "12.5", "-3"]) {
      expect(parseJanelaHoras(v)).toBe(DEFAULT_BOT_SAUDACAO_JANELA_HORAS)
    }
  })
  it("aceita inteiros de 1 a 168", () => {
    expect(parseJanelaHoras("1")).toBe(1)
    expect(parseJanelaHoras("6")).toBe(6)
    expect(parseJanelaHoras("24")).toBe(24)
    expect(parseJanelaHoras("48")).toBe(48)
    expect(parseJanelaHoras("168")).toBe(168)
  })
})

describe("botSaudacaoAtivo (fail-closed: só 'true' liga)", () => {
  it("liga apenas com 'true' (trim/case-insensitive)", () => {
    expect(botSaudacaoAtivo("true")).toBe(true)
    expect(botSaudacaoAtivo(" TRUE ")).toBe(true)
  })
  it("desliga para tudo o mais", () => {
    for (const v of [null, undefined, "", "false", "1", "yes", "sim"]) {
      expect(botSaudacaoAtivo(v)).toBe(false)
    }
  })
})

describe("isSessaoNova", () => {
  const agora = new Date("2026-06-10T12:00:00Z")
  it("sem mensagem anterior = sessão nova", () => {
    expect(isSessaoNova(null, agora, 24)).toBe(true)
  })
  it("anterior dentro da janela = sessão ativa", () => {
    expect(isSessaoNova("2026-06-10T11:00:00Z", agora, 24)).toBe(false) // 1h < 24h
  })
  it("anterior além da janela = sessão nova", () => {
    expect(isSessaoNova("2026-06-09T11:00:00Z", agora, 24)).toBe(true) // 25h > 24h
  })
  it("exatamente na janela = sessão ativa (boundary)", () => {
    expect(isSessaoNova("2026-06-09T12:00:00Z", agora, 24)).toBe(false) // 24h, não é > 24h
  })
  it("timestamp inválido = sessão ativa (fail-closed)", () => {
    expect(isSessaoNova("nao-e-data", agora, 24)).toBe(false)
  })
  it("anterior no futuro = sessão ativa (fail-closed)", () => {
    expect(isSessaoNova("2026-06-10T13:00:00Z", agora, 24)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app && npx vitest run lib/whatsapp/bot-saudacao-message.test.ts`
Expected: FAIL — `Cannot find module './bot-saudacao-message'`.

- [ ] **Step 3: Implementar o módulo puro**

```ts
// app/lib/whatsapp/bot-saudacao-message.ts

export const BOT_SAUDACAO_FLAG_KEY = "whatsapp_bot_saudacao_ativo" as const
export const BOT_SAUDACAO_MSG_KEY = "whatsapp_bot_saudacao_msg" as const
export const BOT_SAUDACAO_JANELA_KEY = "whatsapp_bot_saudacao_janela_horas" as const

export const DEFAULT_BOT_SAUDACAO_JANELA_HORAS = 24
export const DEFAULT_BOT_SAUDACAO_MSG =
  "Oi! 🍻 Você falou com o ALFA Chopp Delivery. Pra fazer seu pedido é só acessar https://www.alfachopp.com.br — e qualquer dúvida, responde por aqui que a gente te atende!"

// Fail-closed (inverso do parseFlag, que é fail-open): só o literal "true" liga o bot.
// Config ausente, "false" ou qualquer outra coisa = DESLIGADO.
export const botSaudacaoAtivo = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() === "true"

// Janela de sessão em horas (1–168 = até 1 semana). Inválido/ausente → default 24.
// Guarda-se a string vazia/nula antes de Number(): Number("") e Number(null) viram 0,
// que passaria no range se não fosse o filtro >= 1.
export const parseJanelaHoras = (valor: string | null | undefined): number => {
  if (!valor || valor.trim() === "") return DEFAULT_BOT_SAUDACAO_JANELA_HORAS
  const n = Number(valor)
  return Number.isInteger(n) && n >= 1 && n <= 168 ? n : DEFAULT_BOT_SAUDACAO_JANELA_HORAS
}

// Sessão nova = não há mensagem anterior, ou a anterior é mais velha que a janela.
// Boundary exato (= janela) e timestamps inválidos/no futuro contam como sessão ATIVA
// (fail-closed: na dúvida, não saúda). Date.parse inválido → NaN → comparação false.
export const isSessaoNova = (
  anteriorIso: string | null,
  agora: Date,
  janelaHoras: number,
): boolean => {
  if (anteriorIso === null) return true
  return agora.getTime() - Date.parse(anteriorIso) > janelaHoras * 3_600_000
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app && npx vitest run lib/whatsapp/bot-saudacao-message.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/bot-saudacao-message.ts app/lib/whatsapp/bot-saudacao-message.test.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): módulo puro da saudação do bot (parse janela + sessão + flag fail-closed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Orquestrador `bot-saudacao.ts`

**Files:**
- Create: `app/lib/whatsapp/bot-saudacao.ts`
- Test: `app/lib/whatsapp/bot-saudacao.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/lib/whatsapp/bot-saudacao.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { maybeSendBotSaudacao } from "./bot-saudacao"
import { DEFAULT_BOT_SAUDACAO_MSG } from "./bot-saudacao-message"

const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)

// Fake do service client. Dispara builders diferentes por tabela:
//   configuracoes → .select().in() => {data: cfgRows, error: cfgErr}
//   conversas_whatsapp → .select().eq().maybeSingle() => {data: conversa, error: convErr}
//   mensagens_conversa_whatsapp → .select().eq().neq().order().limit().maybeSingle() => {data: anterior}
const fakeClient = (opts: {
  cfgRows?: { chave: string; valor: string }[]
  cfgErr?: unknown
  conversa?: { id: string } | null
  convErr?: unknown
  anterior?: { ocorrida_em: string } | null
}) => {
  const cfgBuilder = {
    select: () => ({ in: () => Promise.resolve({ data: opts.cfgRows ?? [], error: opts.cfgErr ?? null }) }),
  }
  const convBuilder = {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.conversa ?? null, error: opts.convErr ?? null }) }) }),
  }
  const msgBuilder = {
    select: () => ({
      eq: () => ({
        neq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: () => Promise.resolve({ data: opts.anterior ?? null, error: null }) }),
          }),
        }),
      }),
    }),
  }
  const from = vi.fn((table: string) =>
    table === "configuracoes" ? cfgBuilder : table === "conversas_whatsapp" ? convBuilder : msgBuilder,
  )
  return { client: { from }, from }
}

const ON = { chave: "whatsapp_bot_saudacao_ativo", valor: "true" }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
  clientMock.mockReset()
  sendMock.mockReset()
  sendMock.mockResolvedValue({ ok: true })
})
afterEach(() => vi.useRealTimers())

describe("maybeSendBotSaudacao", () => {
  it("não envia quando a flag está desligada (fail-closed)", async () => {
    const { client } = fakeClient({ cfgRows: [{ chave: "whatsapp_bot_saudacao_ativo", valor: "false" }] })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a config ausente (flag default OFF)", async () => {
    const { client } = fakeClient({ cfgRows: [] })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a leitura da config falha (fail-closed)", async () => {
    const { client } = fakeClient({ cfgErr: { message: "boom" } })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a sessão está ativa (mensagem anterior recente)", async () => {
    const { client } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1" },
      anterior: { ocorrida_em: "2026-06-10T11:00:00Z" }, // 1h atrás, janela default 24h
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("envia a mensagem padrão quando é sessão nova (sem anterior)", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: { id: "conv-1" }, anterior: null })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith("5521999990000", DEFAULT_BOT_SAUDACAO_MSG)
  })

  it("envia a mensagem editada da config quando presente", async () => {
    const { client } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_saudacao_msg", valor: "Olá! Fala comigo aqui." }],
      conversa: { id: "conv-1" },
      anterior: null,
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledWith("5521999990000", "Olá! Fala comigo aqui.")
  })

  it("respeita a janela configurada (anterior além dela = sessão nova)", async () => {
    const { client } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_saudacao_janela_horas", valor: "6" }],
      conversa: { id: "conv-1" },
      anterior: { ocorrida_em: "2026-06-10T05:00:00Z" }, // 7h atrás > janela 6h
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it("não envia quando a conversa não é encontrada", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: null })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não lança quando o envio falha", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: { id: "conv-1" }, anterior: null })
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: false, error: "down" })
    await expect(maybeSendBotSaudacao("5521999990000", "wamid-1")).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd app && npx vitest run lib/whatsapp/bot-saudacao.test.ts`
Expected: FAIL — `Cannot find module './bot-saudacao'`.

- [ ] **Step 3: Implementar o orquestrador**

```ts
// app/lib/whatsapp/bot-saudacao.ts
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import {
  BOT_SAUDACAO_FLAG_KEY,
  BOT_SAUDACAO_MSG_KEY,
  BOT_SAUDACAO_JANELA_KEY,
  DEFAULT_BOT_SAUDACAO_MSG,
  botSaudacaoAtivo,
  parseJanelaHoras,
  isSessaoNova,
} from "./bot-saudacao-message"

// Saudação automática do bot. Chamada via after() na rota inbound, só para mensagens de ENTRADA.
// Nunca lança: a rota já respondeu 200 pro EC2. Fail-closed em todos os ramos ambíguos.
export const maybeSendBotSaudacao = async (
  telefone: string,
  waMessageId: string,
): Promise<void> => {
  try {
    const supabase = createServiceClient()

    const { data: cfg, error: cfgErr } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [BOT_SAUDACAO_FLAG_KEY, BOT_SAUDACAO_MSG_KEY, BOT_SAUDACAO_JANELA_KEY])
    if (cfgErr) {
      console.error("[whatsapp] erro lendo config do bot:", cfgErr)
      return // fail-closed: sem config confiável, não saúda
    }

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    if (!botSaudacaoAtivo(valorDe(BOT_SAUDACAO_FLAG_KEY))) return // só 'true' liga

    const janelaHoras = parseJanelaHoras(valorDe(BOT_SAUDACAO_JANELA_KEY))
    const rawMsg = valorDe(BOT_SAUDACAO_MSG_KEY)
    const mensagem = rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_BOT_SAUDACAO_MSG

    // A conversa já foi criada/atualizada pelo register_inbound_whatsapp (telefone é unique, E.164).
    const { data: conversa, error: convErr } = await supabase
      .from("conversas_whatsapp")
      .select("id")
      .eq("telefone", telefone)
      .maybeSingle()
    if (convErr) console.error("[whatsapp] erro buscando conversa do bot:", convErr)
    if (!conversa) return

    // Mensagem mais recente da conversa EXCLUINDO a que acabou de chegar (todo registro tem
    // wa_message_id por construção, então o .neq não descarta linhas por NULL).
    const { data: anterior, error: antErr } = await supabase
      .from("mensagens_conversa_whatsapp")
      .select("ocorrida_em")
      .eq("conversa_id", conversa.id)
      .neq("wa_message_id", waMessageId)
      .order("ocorrida_em", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (antErr) console.error("[whatsapp] erro buscando última mensagem do bot:", antErr)

    if (!isSessaoNova(anterior?.ocorrida_em ?? null, new Date(), janelaHoras)) return

    const result = await sendWhatsAppMessage(telefone, mensagem)
    if (!result.ok) {
      console.error("[whatsapp] falha ao enviar saudação do bot:", telefone, result.error)
    }
  } catch (err) {
    console.error("[whatsapp] erro inesperado na saudação do bot:", err)
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd app && npx vitest run lib/whatsapp/bot-saudacao.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/bot-saudacao.ts app/lib/whatsapp/bot-saudacao.test.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): orquestrador maybeSendBotSaudacao (gates fail-closed + sessão)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Engate na rota inbound

**Files:**
- Modify: `app/app/api/whatsapp/inbound/route.ts`

- [ ] **Step 1: Adicionar o import de `after` e do orquestrador**

No topo do arquivo, trocar a primeira linha de import:

```ts
import { NextResponse, after } from "next/server"
```

E adicionar, junto aos outros imports de `@/lib/whatsapp/*`:

```ts
import { maybeSendBotSaudacao } from "@/lib/whatsapp/bot-saudacao"
```

- [ ] **Step 2: Disparar a saudação pós-RPC, só para `entrada`**

Substituir o bloco final (a partir do `if (error)`) por:

```ts
  if (error) {
    console.error("[whatsapp/inbound] RPC falhou:", error)
    return NextResponse.json({ error: "persist failed" }, { status: 500 })
  }

  // Bot: só responde a mensagens de ENTRADA (nossos próprios envios voltam como "saida" e são
  // ignorados — anti-loop). Roda pós-resposta via after(); a flag/janela são checadas lá dentro.
  if (payload.direcao === "entrada") {
    after(() => maybeSendBotSaudacao(telefoneE164, payload.waMessageId))
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar typecheck e a suíte inteira**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: typecheck limpo; todos os testes passam (incluindo os das Tasks 1–2).

- [ ] **Step 4: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add "app/app/api/whatsapp/inbound/route.ts"
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): engata saudação do bot na rota inbound (after, só entrada)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Server actions de config no `admin-actions.ts`

**Files:**
- Modify: `app/lib/whatsapp/admin-actions.ts`

- [ ] **Step 1: Adicionar o import do módulo puro**

Logo após o bloco de import do lembrete (que termina em `} from "./lembrete-message"`), adicionar:

```ts
import {
  BOT_SAUDACAO_FLAG_KEY,
  BOT_SAUDACAO_MSG_KEY,
  BOT_SAUDACAO_JANELA_KEY,
  DEFAULT_BOT_SAUDACAO_MSG,
  botSaudacaoAtivo,
  parseJanelaHoras,
} from "./bot-saudacao-message"
```

- [ ] **Step 2: Adicionar o tipo e as 4 actions no fim do arquivo**

Acrescentar ao final de `app/lib/whatsapp/admin-actions.ts` (depois de `setWhatsappLembreteMessage`):

```ts
export type BotSaudacaoConfig = { ativo: boolean; janelaHoras: number; mensagem: string }

export const getWhatsappBotSaudacaoConfig = async (): Promise<BotSaudacaoConfig> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [BOT_SAUDACAO_FLAG_KEY, BOT_SAUDACAO_JANELA_KEY, BOT_SAUDACAO_MSG_KEY])

  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor
  const rawMsg = valorDe(BOT_SAUDACAO_MSG_KEY)

  return {
    // fail-closed (igual ao gate do orquestrador): o painel reflete o que o bot faz de verdade
    ativo: botSaudacaoAtivo(valorDe(BOT_SAUDACAO_FLAG_KEY)),
    janelaHoras: parseJanelaHoras(valorDe(BOT_SAUDACAO_JANELA_KEY)),
    mensagem: rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_BOT_SAUDACAO_MSG,
  }
}

export const setWhatsappBotSaudacaoFlag = async (ativo: boolean): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_FLAG_KEY, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappBotSaudacaoJanela = async (horas: number): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!Number.isInteger(horas) || horas < 1 || horas > 168) return { ok: false }

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_JANELA_KEY, valor: String(horas), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappBotSaudacaoMessage = async (texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  // texto vazio = restaurar padrão (operador reseta sem saber o texto original)
  const valor = texto.trim() ? texto : DEFAULT_BOT_SAUDACAO_MSG

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: BOT_SAUDACAO_MSG_KEY, valor, updated_at: new Date().toISOString() },
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
Expected: limpo. (Sem testes unitários — `admin-actions.ts` não tem padrão de teste no repo; cobertura via painel/E2E.)

- [ ] **Step 4: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/lib/whatsapp/admin-actions.ts
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): actions de config da saudação do bot (flag/janela/mensagem)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Painel, wiring na página e copy do Recursos

**Files:**
- Create: `app/components/admin/whatsapp-bot-panel.tsx`
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`
- Modify: `app/components/admin/whatsapp-features-panel.tsx`

- [ ] **Step 1: Criar o painel do bot**

```tsx
// app/components/admin/whatsapp-bot-panel.tsx
"use client"

import { useState, useTransition } from "react"
import { Bot, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Select, Button } from "@/components/ui"
import {
  setWhatsappBotSaudacaoFlag,
  setWhatsappBotSaudacaoJanela,
  setWhatsappBotSaudacaoMessage,
  type BotSaudacaoConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_BOT_SAUDACAO_MSG } from "@/lib/whatsapp/bot-saudacao-message"

type Props = { initial: BotSaudacaoConfig }

const JANELAS = [6, 12, 24, 48]
const labelJanela = (h: number) => (h >= 24 && h % 24 === 0 ? `${h / 24} dia${h > 24 ? "s" : ""}` : `${h}h`)

const WhatsappBotPanel = ({ initial }: Props) => {
  const [ativo, setAtivo] = useState(initial.ativo)
  const [janela, setJanela] = useState(initial.janelaHoras)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const trocarJanela = (next: number) => {
    setErro(null)
    setSalvo(false)
    const anterior = janela
    setJanela(next)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoJanela(next)
      if (!ok) {
        setJanela(anterior)
        setErro("Não consegui salvar a janela.")
      }
    })
  }

  const salvarMsg = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_BOT_SAUDACAO_MSG
        setRascunho(final)
        setMensagem(final)
        setSalvo(true)
      } else {
        setErro("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = () => {
    setErro(null)
    setSalvo(false)
    setRascunho(DEFAULT_BOT_SAUDACAO_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(DEFAULT_BOT_SAUDACAO_MSG)
      if (ok) {
        setMensagem(DEFAULT_BOT_SAUDACAO_MSG)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Bot className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Saudação automática (bot)</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Responde sozinho quando o cliente escreve depois de um tempo parado. Requer o Atendimento ligado.
          </p>
        </div>
        <Switch
          id="whatsapp_bot_saudacao_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Saudação automática do bot"
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
            <span className="font-medium">Mensagem e janela</span>
            <span className="text-xs text-brand-warm-gray/70">(após {labelJanela(janela)} parado)</span>
          </button>

          {aberto && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white shrink-0">Saudar após</span>
                <div className="w-32">
                  <Select
                    value={String(janela)}
                    onChange={(e) => trocarJanela(Number(e.target.value))}
                    aria-label="Janela de silêncio"
                  >
                    {JANELAS.map((h) => (
                      <option key={h} value={String(h)}>
                        {labelJanela(h)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <Textarea
                rows={3}
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value)
                  setSalvo(false)
                }}
                aria-label="Mensagem da saudação"
              />

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={salvarMsg} disabled={rascunho === mensagem}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={restaurar}>
                  Restaurar padrão
                </Button>
                {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
              </div>

              <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
                Mensagem fixa (sem nome do cliente, porque pode ser um número sem cadastro). Inclua o
                link do site para o cliente fazer o pedido.
              </p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappBotPanel
```

- [ ] **Step 2: Conectar na página**

Em `app/app/admin/(authenticated)/whatsapp/page.tsx`, adicionar `getWhatsappBotSaudacaoConfig` ao import existente de `@/lib/whatsapp/admin-actions` (linha 1) e o import do componente após o do lembrete:

```ts
import WhatsappBotPanel from "@/components/admin/whatsapp-bot-panel"
```

Adicionar a config ao `Promise.all` (após `getWhatsappLembreteConfig()`), atualizando o destructuring na mesma posição:

```ts
  const [connection, features, statusEntrega, lembrete, botSaudacao, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappStatusEntregaConfig(),
    getWhatsappLembreteConfig(),
    getWhatsappBotSaudacaoConfig(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])
```

Renderizar o painel logo abaixo do de lembrete:

```tsx
          <div className="mt-4">
            <WhatsappLembretePanel initial={lembrete} />
          </div>
          <div className="mt-4">
            <WhatsappBotPanel initial={botSaudacao} />
          </div>
```

- [ ] **Step 3: Reescrever a copy do Recursos**

Em `app/components/admin/whatsapp-features-panel.tsx`, trocar a constante `NAO_FAZ` (linhas 9-10):

```ts
const NAO_FAZ =
  "Ele só responde sozinho com a saudação automática (painel abaixo), se você ligar — e NÃO traz o histórico antigo de conversas."
```

- [ ] **Step 4: Verificar typecheck e build**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: typecheck limpo; toda a suíte passa.

- [ ] **Step 5: Commit**

```bash
git -C /Users/marcusgoncalves/projects/orcamento-brum add app/components/admin/whatsapp-bot-panel.tsx "app/app/admin/(authenticated)/whatsapp/page.tsx" app/components/admin/whatsapp-features-panel.tsx
git -C /Users/marcusgoncalves/projects/orcamento-brum commit -m "feat(whatsapp): painel da saudação do bot + atualiza copy do Recursos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `cd app && npx tsc --noEmit` — limpo.
- [ ] `cd app && npx vitest run` — toda a suíte verde (Tasks 1–2 adicionam ~15 testes).
- [ ] Revisão holística: o bot só envia quando `whatsapp_atendimento_ativo` ON (gate da rota) **e** `whatsapp_bot_saudacao_ativo` == 'true' **e** sessão nova; default OFF; `after()` nunca afeta a resposta 200; anti-loop garantido pelo guard `direcao === "entrada"` **e** pela checagem de sessão (o eco `saida` mantém a sessão viva).
- [ ] E2E manual em staging entra no roteiro da FRE-4 (não bloqueia esta entrega).

## Notas de revisão (self-review)

**Spec coverage:** todos os arquivos do spec têm task — módulo puro (T1), orquestrador (T2), hook (T3), actions (T4), painel+página+copy (T5). ✅

**Sem placeholders:** todo passo de código mostra o código completo. ✅

**Consistência de tipos/nomes:** chaves (`BOT_SAUDACAO_FLAG_KEY` etc.), `BotSaudacaoConfig` (`ativo`/`janelaHoras`/`mensagem`), `parseJanelaHoras`/`isSessaoNova`/`botSaudacaoAtivo`, `maybeSendBotSaudacao(telefone, waMessageId)` — idênticos entre tasks. `botSaudacaoAtivo` é fail-closed (≠ `parseFlag` fail-open), de propósito; por isso a flag fica fora de `WHATSAPP_FEATURE_KEYS`. ✅

**Decisão de granularidade:** a copy do Recursos (1 linha) foi dobrada na T5 junto com painel+página (todas mudanças de superfície de UI), em vez de uma task própria — evita um ciclo implementer+2-reviewers para uma linha. ✅
