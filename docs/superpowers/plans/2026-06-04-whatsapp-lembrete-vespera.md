# FRE-23 — Lembrete véspera (D-1) no WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na véspera da entrega (D-1), enviar automaticamente um lembrete no WhatsApp do cliente, no horário configurado, com texto editável — reaproveitando a camada de envio da FRE-22.

**Architecture:** `pg_cron` dispara de hora em hora e usa `pg_net` para fazer um POST numa rota Next protegida por segredo (`/api/whatsapp/lembrete`). Toda a lógica vive em TS: a rota chama `runLembreteVespera()`, que checa a flag master (fail-open), o horário configurado (`hora_SP >= hora_configurada`), busca os pedidos D-1 via RPC `get_orders_needing_reminder()` (já com dedupe), renderiza o template editável e envia. Segredos (URL + token) ficam no Supabase Vault — a migration fica sem segredo.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript, vitest, Supabase (Postgres, `configuracoes` key-value, RPC security-definer, pg_cron, pg_net, Vault), Baileys via porta `sendWhatsAppMessage`.

**Branch:** `staging` (a FRE-23 vai em cima da FRE-22; PR único no go-live). NÃO trabalhar em `main`.

**Reference (ler para imitar o padrão):**
- `app/lib/whatsapp/status-messages.ts` + `status-messages.test.ts` — módulo puro + testes (modelo do Task 1).
- `app/lib/whatsapp/notificacoes.ts` — `sendCustomerWhatsAppConfirmation` (join cliente, `register_whatsapp_message`, try/catch que só loga).
- `app/lib/whatsapp/features.ts` — `WHATSAPP_FEATURE_KEYS`, `parseFlag`, `isWhatsappFeatureEnabled`.
- `app/app/api/whatsapp/alert/route.ts` — rota POST protegida por header-segredo (modelo do Task 3).
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappStatusEntregaConfig` / `setWhatsappStatusFlag` / `setWhatsappStatusMessage` (modelo do Task 5).
- `app/components/admin/whatsapp-status-entrega-panel.tsx` — painel master + collapse (modelo do Task 6).
- `supabase/migrations/024_whatsapp_status_entrega.sql` + `002_whatsapp_integration.sql` (a RPC `get_orders_needing_reminder` atual).

**Comandos (rodar de `app/`):** testes `npm test`; typecheck `npm run typecheck`; build `npm run build`.

**Tokens da mensagem:** `{nome}` (1º nome), `{pedido}` (id curto 8 chars), `{data}` (DD/MM), `{horario}` (HH:MM).
**Default da mensagem (string canônica, usar idêntica em todos os arquivos):**
`Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!`

---

## File Structure

**Novos**
- `app/lib/whatsapp/lembrete-message.ts` — módulo puro: chaves de config, default, `renderLembreteTemplate`, `formatDataBR`, `formatHorario`, `horaEmSaoPaulo`, `deveEnviarAgora`, `parseHora`.
- `app/lib/whatsapp/lembrete-message.test.ts` — testes do módulo puro.
- `app/lib/whatsapp/lembrete.ts` — orquestrador server-side `runLembreteVespera`.
- `app/lib/whatsapp/lembrete.test.ts` — teste do orquestrador (mock leve do service client + porta de envio).
- `app/app/api/whatsapp/lembrete/route.ts` — rota POST protegida.
- `app/components/admin/whatsapp-lembrete-panel.tsx` — painel master + collapse (hora + textarea).
- `supabase/migrations/025_whatsapp_lembrete_vespera.sql` — extensões, RPC, seed configs, cron.

**Modificados**
- `app/lib/whatsapp/features.ts` — adiciona a chave master ao union.
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappLembreteConfig` + 3 setters.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — fetch + render do painel.

---

## Task 1: Módulo puro `lembrete-message.ts` + feature flag

**Files:**
- Modify: `app/lib/whatsapp/features.ts` (adiciona a chave ao `WHATSAPP_FEATURE_KEYS`)
- Create: `app/lib/whatsapp/lembrete-message.ts`
- Test: `app/lib/whatsapp/lembrete-message.test.ts`

- [ ] **Step 1: Adicionar a chave master ao union de features**

Em `app/lib/whatsapp/features.ts`, dentro do array `WHATSAPP_FEATURE_KEYS` (hoje termina em `"whatsapp_status_entrega_ativo",`), acrescentar a linha:

```ts
export const WHATSAPP_FEATURE_KEYS = [
  "whatsapp_confirmacao_ativo",
  "whatsapp_atendimento_ativo",
  "whatsapp_alerta_ativo",
  "whatsapp_status_entrega_ativo",
  "whatsapp_lembrete_vespera_ativo",
] as const
```

(Não mexer em mais nada do arquivo.)

- [ ] **Step 2: Escrever o teste (que vai falhar)**

Criar `app/lib/whatsapp/lembrete-message.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_HORA,
  DEFAULT_LEMBRETE_MSG,
  renderLembreteTemplate,
  formatDataBR,
  formatHorario,
  horaEmSaoPaulo,
  deveEnviarAgora,
  parseHora,
} from "./lembrete-message"

describe("chaves e defaults", () => {
  it("chaves de configuracoes", () => {
    expect(LEMBRETE_FLAG_KEY).toBe("whatsapp_lembrete_vespera_ativo")
    expect(LEMBRETE_HORA_KEY).toBe("whatsapp_lembrete_vespera_hora")
    expect(LEMBRETE_MSG_KEY).toBe("whatsapp_lembrete_vespera_msg")
  })
  it("default tem os 4 tokens e hora padrao 9", () => {
    expect(DEFAULT_LEMBRETE_HORA).toBe(9)
    for (const t of ["{nome}", "{pedido}", "{data}", "{horario}"]) {
      expect(DEFAULT_LEMBRETE_MSG).toContain(t)
    }
  })
})

describe("renderLembreteTemplate", () => {
  const vars = { nome: "Joao", pedido: "1a2b3c4d", data: "10/06", horario: "14:30" }
  it("substitui os 4 tokens", () => {
    expect(
      renderLembreteTemplate("Oi {nome} #{pedido} {data} {horario}", vars),
    ).toBe("Oi Joao #1a2b3c4d 10/06 14:30")
  })
  it("substitui multiplas ocorrencias e ignora ausentes", () => {
    expect(renderLembreteTemplate("{nome} {nome}", vars)).toBe("Joao Joao")
    expect(renderLembreteTemplate("sem token", vars)).toBe("sem token")
  })
  it("renderiza o default sem sobrar token", () => {
    const out = renderLembreteTemplate(DEFAULT_LEMBRETE_MSG, vars)
    for (const t of ["{nome}", "{pedido}", "{data}", "{horario}"]) {
      expect(out).not.toContain(t)
    }
  })
})

describe("formatDataBR / formatHorario", () => {
  it("data YYYY-MM-DD -> DD/MM", () => {
    expect(formatDataBR("2026-06-10")).toBe("10/06")
    expect(formatDataBR("2026-12-01")).toBe("01/12")
  })
  it("horario HH:MM:SS -> HH:MM", () => {
    expect(formatHorario("14:30:00")).toBe("14:30")
    expect(formatHorario("09:05:00")).toBe("09:05")
  })
})

describe("parseHora", () => {
  it("normaliza string valida", () => {
    expect(parseHora("9")).toBe(9)
    expect(parseHora("0")).toBe(0)
    expect(parseHora("23")).toBe(23)
  })
  it("cai no default 9 para invalido/ausente", () => {
    expect(parseHora(null)).toBe(9)
    expect(parseHora(undefined)).toBe(9)
    expect(parseHora("")).toBe(9)
    expect(parseHora("25")).toBe(9)
    expect(parseHora("-1")).toBe(9)
    expect(parseHora("abc")).toBe(9)
    expect(parseHora("9.5")).toBe(9) // Number("9.5")=9.5 nao e inteiro -> default
  })
})

describe("horaEmSaoPaulo (UTC-3, sem horario de verao)", () => {
  it("12:00Z -> 9", () => expect(horaEmSaoPaulo(new Date("2026-06-10T12:00:00Z"))).toBe(9))
  it("11:59Z -> 8", () => expect(horaEmSaoPaulo(new Date("2026-06-10T11:59:00Z"))).toBe(8))
  it("03:00Z -> 0 (meia-noite SP)", () =>
    expect(horaEmSaoPaulo(new Date("2026-06-10T03:00:00Z"))).toBe(0))
  it("02:30Z -> 23 (dia anterior SP)", () =>
    expect(horaEmSaoPaulo(new Date("2026-06-10T02:30:00Z"))).toBe(23))
})

describe("deveEnviarAgora", () => {
  it("envia quando hora SP >= configurada", () => {
    expect(deveEnviarAgora(9, new Date("2026-06-10T12:00:00Z"))).toBe(true) // SP 9
    expect(deveEnviarAgora(9, new Date("2026-06-10T15:00:00Z"))).toBe(true) // SP 12
  })
  it("nao envia antes da hora configurada", () => {
    expect(deveEnviarAgora(9, new Date("2026-06-10T11:00:00Z"))).toBe(false) // SP 8
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run (de `app/`): `npm test -- lembrete-message`
Expected: FAIL — `Failed to resolve import "./lembrete-message"` (arquivo ainda não existe).

- [ ] **Step 4: Implementar o módulo puro**

Criar `app/lib/whatsapp/lembrete-message.ts`:

```ts
import type { WhatsappFeatureKey } from "./features"

// Tipado como WhatsappFeatureKey: um rename em WHATSAPP_FEATURE_KEYS quebra aqui (compile-time),
// garantindo que esta chave continua igual ao gate lido pela rota/orquestrador.
export const LEMBRETE_FLAG_KEY: WhatsappFeatureKey = "whatsapp_lembrete_vespera_ativo"
export const LEMBRETE_HORA_KEY = "whatsapp_lembrete_vespera_hora" as const
export const LEMBRETE_MSG_KEY = "whatsapp_lembrete_vespera_msg" as const

export const DEFAULT_LEMBRETE_HORA = 9
export const DEFAULT_LEMBRETE_MSG =
  "Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!"

// tokens: {nome} (1o nome), {pedido} (id curto 8 chars), {data} (DD/MM), {horario} (HH:MM)
export const renderLembreteTemplate = (
  template: string,
  vars: { nome: string; pedido: string; data: string; horario: string },
): string =>
  template
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{pedido}", vars.pedido)
    .replaceAll("{data}", vars.data)
    .replaceAll("{horario}", vars.horario)

// data_evento chega como 'YYYY-MM-DD' (string) -> 'DD/MM' sem depender de fuso
export const formatDataBR = (iso: string): string => {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}

// horario_evento chega como 'HH:MM:SS' -> 'HH:MM'
export const formatHorario = (t: string): string => t.slice(0, 5)

// hora atual no fuso de Sao Paulo (0-23); hourCycle h23 evita "24" na meia-noite
export const horaEmSaoPaulo = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  )

// gate do horario: envia no horario configurado ou em qualquer hora seguinte do mesmo dia
export const deveEnviarAgora = (horaConfigurada: number, now: Date): boolean =>
  horaEmSaoPaulo(now) >= horaConfigurada

// normaliza a hora lida da config (string) para 0-23 inteiro; default 9 se invalida/ausente.
// Guard antes do Number(): Number(null) e Number("") dao 0, que passaria no range check.
export const parseHora = (valor: string | null | undefined): number => {
  if (!valor || valor.trim() === "") return DEFAULT_LEMBRETE_HORA
  const n = Number(valor)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_LEMBRETE_HORA
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run (de `app/`): `npm test -- lembrete-message`
Expected: PASS (todos os describes verdes).

- [ ] **Step 6: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros (a chave nova no union faz `LEMBRETE_FLAG_KEY: WhatsappFeatureKey` compilar).

- [ ] **Step 7: Commit**

```bash
git add app/lib/whatsapp/features.ts app/lib/whatsapp/lembrete-message.ts app/lib/whatsapp/lembrete-message.test.ts
git commit -m "feat(whatsapp): modulo puro de lembrete vespera + feature flag (FRE-23)"
```

---

## Task 2: Orquestrador `runLembreteVespera` + teste

**Files:**
- Create: `app/lib/whatsapp/lembrete.ts`
- Test: `app/lib/whatsapp/lembrete.test.ts`

- [ ] **Step 1: Escrever o teste (que vai falhar)**

Criar `app/lib/whatsapp/lembrete.test.ts`. Mocka a flag (`./features`), o service client (`@/lib/supabase/service`) e a porta de envio (`.`):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("./features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./features")>()),
  isWhatsappFeatureEnabled: vi.fn(),
}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))

import { isWhatsappFeatureEnabled } from "./features"
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { runLembreteVespera } from "./lembrete"

const flagMock = vi.mocked(isWhatsappFeatureEnabled)
const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)

// Fake do service client: .from(...).select(...).in(...) devolve cfgRows; .rpc(name) devolve
// rpcRows para get_orders_needing_reminder e {} para register_whatsapp_message.
const fakeClient = (cfgRows: { chave: string; valor: string }[], rpcRows: unknown[]) => {
  const rpc = vi.fn((name: string) =>
    name === "get_orders_needing_reminder"
      ? Promise.resolve({ data: rpcRows, error: null })
      : Promise.resolve({ data: null, error: null }),
  )
  const client = {
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: cfgRows, error: null }) }) }),
    rpc,
  }
  return { client, rpc }
}

beforeEach(() => {
  vi.useFakeTimers()
  // 12:00Z = 09:00 em Sao Paulo
  vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
  flagMock.mockReset()
  clientMock.mockReset()
  sendMock.mockReset()
})
afterEach(() => vi.useRealTimers())

describe("runLembreteVespera", () => {
  it("pula quando a feature esta desligada", async () => {
    flagMock.mockResolvedValue(false)
    const r = await runLembreteVespera()
    expect(r).toEqual({ skipped: true, reason: "feature_off" })
    expect(clientMock).not.toHaveBeenCalled()
  })

  it("pula quando ainda nao chegou a hora configurada", async () => {
    flagMock.mockResolvedValue(true)
    const { client } = fakeClient([{ chave: "whatsapp_lembrete_vespera_hora", valor: "23" }], [])
    clientMock.mockReturnValue(client as never)
    const r = await runLembreteVespera()
    expect(r).toEqual({ skipped: true, reason: "fora_da_hora" }) // SP 9 < 23
  })

  it("envia para cada pedido e registra; conta sem-telefone como falha", async () => {
    flagMock.mockResolvedValue(true)
    const rpcRows = [
      { pedido_id: "1a2b3c4d-aaaa", nome: "Joao Silva", telefone: "21999990000", data_evento: "2026-06-11", horario_evento: "14:30:00" },
      { pedido_id: "9z8y7x6w-bbbb", nome: "Sem Fone", telefone: "", data_evento: "2026-06-11", horario_evento: "10:00:00" },
    ]
    const { client, rpc } = fakeClient(
      [{ chave: "whatsapp_lembrete_vespera_hora", valor: "9" }],
      rpcRows,
    )
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: true })

    const r = await runLembreteVespera()

    expect(r).toEqual({ skipped: false, total: 2, enviados: 1, falhas: 1 })
    // 1 envio (o sem-telefone e pulado)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      "21999990000",
      expect.stringContaining("amanhã (11/06) às 14:30"),
    )
    expect(sendMock).toHaveBeenCalledWith("21999990000", expect.stringContaining("Joao"))
    expect(sendMock).toHaveBeenCalledWith("21999990000", expect.stringContaining("#1a2b3c4d"))
    // register chamado so para o que tinha telefone (1x), com tipo 'lembrete' e status 'enviada'
    const registerCalls = rpc.mock.calls.filter((c) => c[0] === "register_whatsapp_message")
    expect(registerCalls).toHaveLength(1)
    expect(registerCalls[0][1]).toMatchObject({ p_tipo: "lembrete", p_status: "enviada" })
  })

  it("usa o template editado da config quando presente", async () => {
    flagMock.mockResolvedValue(true)
    const { client } = fakeClient(
      [
        { chave: "whatsapp_lembrete_vespera_hora", valor: "9" },
        { chave: "whatsapp_lembrete_vespera_msg", valor: "Lembrete {nome}: {data}" },
      ],
      [{ pedido_id: "abcd1234-xxxx", nome: "Maria", telefone: "2198888", data_evento: "2026-06-11", horario_evento: "08:00:00" }],
    )
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: true })

    await runLembreteVespera()
    expect(sendMock).toHaveBeenCalledWith("2198888", "Lembrete Maria: 11/06")
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (de `app/`): `npm test -- lembrete.test`
Expected: FAIL — `Failed to resolve import "./lembrete"`.

- [ ] **Step 3: Implementar o orquestrador**

Criar `app/lib/whatsapp/lembrete.ts`:

```ts
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { isWhatsappFeatureEnabled } from "./features"
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_MSG,
  parseHora,
  deveEnviarAgora,
  renderLembreteTemplate,
  formatDataBR,
  formatHorario,
} from "./lembrete-message"

export type LembreteRunResult =
  | { skipped: true; reason: "feature_off" | "fora_da_hora" | "erro" }
  | { skipped: false; total: number; enviados: number; falhas: number }

type PedidoLembrete = {
  pedido_id: string
  nome: string | null
  telefone: string | null
  data_evento: string
  horario_evento: string
}

// Lote diario do lembrete de vespera. Acordado pela rota /api/whatsapp/lembrete (pg_cron+pg_net).
// Nunca lanca: a rota sempre responde 200.
export const runLembreteVespera = async (): Promise<LembreteRunResult> => {
  // gate master fail-open, igual FRE-22
  if (!(await isWhatsappFeatureEnabled(LEMBRETE_FLAG_KEY))) {
    return { skipped: true, reason: "feature_off" }
  }

  try {
    const supabase = createServiceClient()

    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [LEMBRETE_HORA_KEY, LEMBRETE_MSG_KEY])

    const valorDe = (chave: string) => cfg?.find((row) => row.chave === chave)?.valor
    const hora = parseHora(valorDe(LEMBRETE_HORA_KEY))
    const rawMsg = valorDe(LEMBRETE_MSG_KEY)
    const template = rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_LEMBRETE_MSG

    // gate de horario: so envia a partir da hora configurada (>= cobre atraso/pedido novo)
    if (!deveEnviarAgora(hora, new Date())) {
      return { skipped: true, reason: "fora_da_hora" }
    }

    const { data: rows } = await supabase.rpc("get_orders_needing_reminder")
    const pedidos = (rows ?? []) as PedidoLembrete[]

    let enviados = 0
    let falhas = 0

    for (const pedido of pedidos) {
      if (!pedido.telefone) {
        console.error("[whatsapp] pedido sem telefone (lembrete):", pedido.pedido_id)
        falhas += 1
        continue
      }

      const mensagem = renderLembreteTemplate(template, {
        nome: (pedido.nome ?? "Cliente").split(" ")[0],
        pedido: pedido.pedido_id.slice(0, 8),
        data: formatDataBR(pedido.data_evento),
        horario: formatHorario(pedido.horario_evento),
      })

      const result = await sendWhatsAppMessage(pedido.telefone, mensagem)

      await supabase.rpc("register_whatsapp_message", {
        p_pedido_id: pedido.pedido_id,
        p_tipo: "lembrete",
        p_status: result.ok ? "enviada" : "falha",
      })

      if (result.ok) enviados += 1
      else falhas += 1
    }

    return { skipped: false, total: pedidos.length, enviados, falhas }
  } catch (err) {
    console.error("[whatsapp] erro inesperado no lembrete de vespera:", err)
    return { skipped: true, reason: "erro" }
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run (de `app/`): `npm test -- lembrete.test`
Expected: PASS (4 casos verdes).

- [ ] **Step 5: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add app/lib/whatsapp/lembrete.ts app/lib/whatsapp/lembrete.test.ts
git commit -m "feat(whatsapp): orquestrador runLembreteVespera com gate de hora + dedupe (FRE-23)"
```

---

## Task 3: Rota `/api/whatsapp/lembrete`

**Files:**
- Create: `app/app/api/whatsapp/lembrete/route.ts`

(Sem teste unitário — segue o padrão de `app/app/api/whatsapp/alert/route.ts`, que não tem teste; validada por typecheck/build + E2E em staging.)

- [ ] **Step 1: Implementar a rota**

Criar `app/app/api/whatsapp/lembrete/route.ts`:

```ts
import { NextResponse } from "next/server"
import { runLembreteVespera } from "@/lib/whatsapp/lembrete"

// Acordada 1x/hora pelo pg_cron via pg_net. Protegida por segredo (header x-cron-secret).
// O gate de horario e a flag ficam dentro de runLembreteVespera.
export const POST = async (request: Request) => {
  const secret = process.env.LEMBRETE_CRON_SECRET

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const result = await runLembreteVespera()
  return NextResponse.json({ ok: true, ...result })
}
```

- [ ] **Step 2: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Build (confirma que o route handler é válido)**

Run (de `app/`): `npm run build`
Expected: build conclui; a rota `/api/whatsapp/lembrete` aparece como ƒ (Dynamic) na lista de rotas.

- [ ] **Step 4: Commit**

```bash
git add "app/app/api/whatsapp/lembrete/route.ts"
git commit -m "feat(whatsapp): rota POST /api/whatsapp/lembrete protegida por segredo (FRE-23)"
```

---

## Task 4: Migração 025 (extensões + RPC + configs + cron)

**Files:**
- Create: `supabase/migrations/025_whatsapp_lembrete_vespera.sql`

(O subagente **apenas escreve o arquivo**. Aplicar no staging é um passo separado feito pelo coordenador via Supabase MCP — não tentar aplicar aqui.)

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migrations/025_whatsapp_lembrete_vespera.sql`:

```sql
-- FRE-23: lembrete de vespera (D-1) no WhatsApp.
-- pg_cron acorda /api/whatsapp/lembrete de hora em hora; a rota faz o trabalho em TS.

-- Extensoes (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Redefinir get_orders_needing_reminder: retorna LINHAS (mensagem montada em TS),
-- corrige o filtro de status (inclui enviar_para_entregador) e usa o fuso BR para "amanha".
-- drop antes do create porque a assinatura de retorno mudou.
drop function if exists get_orders_needing_reminder();

create or replace function get_orders_needing_reminder()
returns table(pedido_id uuid, nome text, telefone text, data_evento date, horario_evento time) as $$
begin
  return query
  select p.id, c.nome, c.telefone, p.data_evento, p.horario_evento
  from pedidos p
  join clientes c on c.id = p.cliente_id
  where p.status in ('confirmado', 'enviar_para_entregador')
    and p.data_evento = (now() at time zone 'America/Sao_Paulo')::date + 1
    and not exists (
      select 1 from mensagens_whatsapp mw
      where mw.pedido_id = p.id and mw.tipo = 'lembrete' and mw.status = 'enviada'
    );
end;
$$ language plpgsql security definer;

-- drop+create reseta os grants; re-revoga (a migracao 004 ja revogava esta funcao).
revoke execute on function get_orders_needing_reminder() from anon, authenticated;

-- Configs (default ligado/preenchido para a feature nascer funcional).
insert into configuracoes (chave, valor) values
  ('whatsapp_lembrete_vespera_ativo', 'true'),
  ('whatsapp_lembrete_vespera_hora',  '9'),
  ('whatsapp_lembrete_vespera_msg',   'Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!')
on conflict (chave) do nothing;

-- Agendamento horario, idempotente. URL e segredo vem do Vault (sem segredo na migracao).
-- Os secrets 'lembrete_route_url' e 'lembrete_cron_secret' sao inseridos manualmente por
-- ambiente: select vault.create_secret('<valor>', '<nome>');
select cron.unschedule('lembrete-vespera-d1')
where exists (select 1 from cron.job where jobname = 'lembrete-vespera-d1');

select cron.schedule('lembrete-vespera-d1', '0 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_route_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
```

- [ ] **Step 2: Conferência manual da SQL**

Reler o arquivo e confirmar: (a) `drop function if exists` antes do `create`; (b) `status in ('confirmado','enviar_para_entregador')`; (c) `data_evento = (now() at time zone 'America/Sao_Paulo')::date + 1`; (d) o `on conflict (chave) do nothing`; (e) a string default da mensagem é **idêntica** à `DEFAULT_LEMBRETE_MSG` do Task 1 (mesmos emojis/acentos/pontuação). Sem comando que rode SQL aqui.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/025_whatsapp_lembrete_vespera.sql
git commit -m "feat(db): migration 025 - lembrete vespera (RPC + configs + pg_cron) (FRE-23)"
```

---

## Task 5: Server actions admin (get/set flag/hora/msg)

**Files:**
- Modify: `app/lib/whatsapp/admin-actions.ts` (acrescentar no fim do arquivo + import)

- [ ] **Step 1: Adicionar o import do módulo puro**

No topo de `app/lib/whatsapp/admin-actions.ts`, **depois** do bloco `import { ... } from "./status-messages"`, acrescentar:

```ts
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_MSG,
  parseHora,
} from "./lembrete-message"
```

- [ ] **Step 2: Adicionar as actions no fim do arquivo**

Acrescentar ao final de `app/lib/whatsapp/admin-actions.ts` (mesmo padrão `requireAdmin` + upsert+select das actions de status):

```ts
export type LembreteConfig = { ativo: boolean; hora: number; mensagem: string }

export const getWhatsappLembreteConfig = async (): Promise<LembreteConfig> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [LEMBRETE_FLAG_KEY, LEMBRETE_HORA_KEY, LEMBRETE_MSG_KEY])

  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor
  const rawMsg = valorDe(LEMBRETE_MSG_KEY)

  return {
    ativo: parseFlag(valorDe(LEMBRETE_FLAG_KEY)),
    hora: parseHora(valorDe(LEMBRETE_HORA_KEY)),
    // texto vazio na DB = cair no padrao; o operador pode restaurar deixando o campo vazio
    mensagem: rawMsg && rawMsg.trim() ? rawMsg : DEFAULT_LEMBRETE_MSG,
  }
}

export const setWhatsappLembreteFlag = async (ativo: boolean): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_FLAG_KEY, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappLembreteHora = async (hora: number): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!Number.isInteger(hora) || hora < 0 || hora > 23) return { ok: false }

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_HORA_KEY, valor: String(hora), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappLembreteMessage = async (texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  // texto vazio = restaurar padrao; assim o operador reseta sem saber o texto original
  const valor = texto.trim() ? texto : DEFAULT_LEMBRETE_MSG

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: LEMBRETE_MSG_KEY, valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}
```

- [ ] **Step 3: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add app/lib/whatsapp/admin-actions.ts
git commit -m "feat(whatsapp): actions do lembrete vespera (get/set flag/hora/msg) (FRE-23)"
```

---

## Task 6: Painel `whatsapp-lembrete-panel.tsx`

**Files:**
- Create: `app/components/admin/whatsapp-lembrete-panel.tsx`

(Espelha `app/components/admin/whatsapp-status-entrega-panel.tsx`: master sempre visível + collapse fechado por default. Sem teste de componente — não há testes de componente no repo; validado por typecheck/build + E2E em staging.)

- [ ] **Step 1: Implementar o componente**

Criar `app/components/admin/whatsapp-lembrete-panel.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { BellRing, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Select, Button } from "@/components/ui"
import {
  setWhatsappLembreteFlag,
  setWhatsappLembreteHora,
  setWhatsappLembreteMessage,
  type LembreteConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_LEMBRETE_MSG } from "@/lib/whatsapp/lembrete-message"

type Props = { initial: LembreteConfig }

const HORAS = Array.from({ length: 24 }, (_, h) => h)
const labelHora = (h: number) => `${String(h).padStart(2, "0")}:00`

const WhatsappLembretePanel = ({ initial }: Props) => {
  const [ativo, setAtivo] = useState(initial.ativo)
  const [hora, setHora] = useState(initial.hora)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  // Collapse fechado por default: a feature nasce ligada e e raramente editada, entao nao
  // empurramos o painel de Conversas (parte principal da tela) pra baixo.
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const trocarHora = (next: number) => {
    setErro(null)
    setSalvo(false)
    const anterior = hora
    setHora(next)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteHora(next)
      if (!ok) {
        setHora(anterior)
        setErro("Não consegui salvar o horário.")
      }
    })
  }

  const salvarMsg = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteMessage(rascunho)
      if (ok) {
        // texto vazio = servidor cai no padrao; espelhamos localmente
        const final = rascunho.trim() ? rascunho : DEFAULT_LEMBRETE_MSG
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
    setRascunho(DEFAULT_LEMBRETE_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteMessage(DEFAULT_LEMBRETE_MSG)
      if (ok) {
        setMensagem(DEFAULT_LEMBRETE_MSG)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <BellRing className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Lembrete na véspera</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Manda um lembrete automático no dia anterior à entrega, no horário escolhido.
          </p>
        </div>
        <Switch
          id="whatsapp_lembrete_vespera_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Lembrete na véspera"
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
            <span className="font-medium">Mensagem e horário</span>
            <span className="text-xs text-brand-warm-gray/70">(envia às {labelHora(hora)})</span>
          </button>

          {aberto && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-white shrink-0">Enviar às</span>
                <div className="w-32">
                  <Select
                    value={String(hora)}
                    onChange={(e) => trocarHora(Number(e.target.value))}
                    aria-label="Horário do lembrete"
                  >
                    {HORAS.map((h) => (
                      <option key={h} value={String(h)}>
                        {labelHora(h)}
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
                aria-label="Mensagem do lembrete"
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
                Use <code className="text-brand-yellow">{"{nome}"}</code> (primeiro nome),{" "}
                <code className="text-brand-yellow">{"{pedido}"}</code> (nº),{" "}
                <code className="text-brand-yellow">{"{data}"}</code> (DD/MM) e{" "}
                <code className="text-brand-yellow">{"{horario}"}</code> (HH:MM).
              </p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappLembretePanel
```

- [ ] **Step 2: Typecheck**

Run (de `app/`): `npm run typecheck`
Expected: sem erros. (Confirma que `BellRing` existe em `lucide-react` e que `Select`/`Switch`/`Textarea`/`Button` estão exportados de `@/components/ui`.)

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp-lembrete-panel.tsx
git commit -m "feat(admin): painel do lembrete de vespera (toggle + hora + mensagem) (FRE-23)"
```

---

## Task 7: Wire no `page.tsx` da tela WhatsApp

**Files:**
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`

- [ ] **Step 1: Importar a action e o painel**

No topo de `app/app/admin/(authenticated)/whatsapp/page.tsx`:

1. Na linha do import de `@/lib/whatsapp/admin-actions`, acrescentar `getWhatsappLembreteConfig` à lista:

```ts
import { getWhatsappAlertEmail, getWhatsappConnection, getWhatsappFeatures, getWhatsappLembreteConfig, getWhatsappStatusEntregaConfig } from "@/lib/whatsapp/admin-actions"
```

2. Depois do import de `WhatsappStatusEntregaPanel`, acrescentar:

```ts
import WhatsappLembretePanel from "@/components/admin/whatsapp-lembrete-panel"
```

- [ ] **Step 2: Buscar a config no `Promise.all` e renderizar o painel**

Trocar o `Promise.all` para incluir `lembrete`:

```ts
  const [connection, features, statusEntrega, lembrete, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappStatusEntregaConfig(),
    getWhatsappLembreteConfig(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])
```

E na seção RECURSOS, logo depois do bloco do `WhatsappStatusEntregaPanel`, acrescentar o painel:

```tsx
          <div className="mt-4">
            <WhatsappStatusEntregaPanel initial={statusEntrega} />
          </div>
          <div className="mt-4">
            <WhatsappLembretePanel initial={lembrete} />
          </div>
```

- [ ] **Step 3: Typecheck + build**

Run (de `app/`): `npm run typecheck && npm run build`
Expected: sem erros; build conclui com a rota `/admin/whatsapp` e `/api/whatsapp/lembrete`.

- [ ] **Step 4: Rodar a suíte de testes inteira**

Run (de `app/`): `npm test`
Expected: tudo verde (os testes de `lembrete-message` e `lembrete` somam aos existentes).

- [ ] **Step 5: Commit**

```bash
git add "app/app/admin/(authenticated)/whatsapp/page.tsx"
git commit -m "feat(admin): integra painel de lembrete de vespera na tela WhatsApp (FRE-23)"
```

---

## Pós-execução (coordenador — fora do subagent-driven)

Depois dos 7 tasks (não são passos de subagente):

1. **Aplicar a migração 025 no staging** (`iwyijyxpkchibdryzkpn`, NUNCA prod) via Supabase MCP `apply_migration`. Antes, `list_extensions` para confirmar `pg_cron`/`pg_net`/`supabase_vault`.
2. **Inserir os secrets do Vault no staging:** `select vault.create_secret('https://app-git-staging-marcusgoncalvess-projects.vercel.app/api/whatsapp/lembrete', 'lembrete_route_url');` e `select vault.create_secret('<segredo forte>', 'lembrete_cron_secret');`.
3. **Adicionar `LEMBRETE_CRON_SECRET`** (o mesmo `<segredo forte>`) nas env vars da Vercel, escopo Preview→`staging`.
4. **Deploy staging** (push `staging`) e **E2E manual**: semear um pedido com `data_evento = amanhã` em `confirmado`; `POST` na rota com o header-segredo (ou disparar o job do cron na mão) → conferir mensagem recebida, log `enviada`, 2ª chamada sem reenvio (dedupe); editar texto/hora no painel e revalidar.
5. (Prod fica para o go-live FRE-21: aplicar 025, criar os secrets do Vault com a URL de prod, setar a env var de prod.)
</content>
