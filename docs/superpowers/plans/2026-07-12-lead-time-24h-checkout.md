# Antecedência mínima de 24h no checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exigir 24h de antecedência (rolling) em pedidos feitos pelo cliente no site, deixando o fluxo de pedido manual do admin sem restrição como escape hatch.

**Architecture:** Uma função pura `isBeforeMinLeadTime` (âncora de timezone fixa `-03:00`) compartilhada por dois guards do fluxo público: `validateCheckout` (client, no submit) e `createOrderSchema` (server, no parse). Admin (`manualOrderInputSchema`, `create_manual_order`, `updatePedidoSchema`) fica intocado.

**Tech Stack:** TypeScript, Next.js 15, Zod, Vitest.

## Global Constraints

- Timezone: âncora fixa `-03:00` (Brasil sem horário de verão desde 2019). Nunca usar parse ingênuo local para o instante do evento no cálculo de 24h.
- Trava vale **só** no fluxo do cliente (`validateCheckout` + `createOrderSchema`). NÃO adicionar trava de data em `manualOrderInputSchema`, `create_manual_order` ou `updatePedidoSchema`.
- Mensagem de erro (pt-BR, **sem acento**, casando o estilo das mensagens existentes): `Pedidos exigem no minimo 24h de antecedencia`. Derivar da constante, não hardcodar o número em dois lugares.
- Regra rolling: evento com exatamente 24h de antecedência é **permitido** (fronteira `< 24h` reprova; `== 24h` passa).
- TDD: teste falhando primeiro, implementação mínima, teste verde, commit. Rodar vitest de dentro de `app/`.
- Todos os comandos de teste rodam a partir de `app/` (config do vitest vive lá).

---

### Task 1: Função pura `isBeforeMinLeadTime` + constantes

**Files:**
- Modify: `app/lib/checkout-validation.ts` (adicionar exports; o arquivo é módulo puro, sem `"use server"`)
- Test: `app/lib/checkout-validation.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const MIN_LEAD_TIME_HOURS = 24`
  - `export const minLeadTimeMessage: string` (= `Pedidos exigem no minimo 24h de antecedencia`)
  - `export const isBeforeMinLeadTime = (dataEvento: string, horarioEvento: string, now?: Date) => boolean` — `dataEvento` = `"YYYY-MM-DD"`, `horarioEvento` = `"HH:MM"`. Retorna `true` quando o instante do evento está a menos de 24h de `now`.

- [ ] **Step 1: Escrever os testes falhando**

Adicionar ao final de `app/lib/checkout-validation.test.ts` (mantendo o import existente do topo; adicionar `isBeforeMinLeadTime`, `MIN_LEAD_TIME_HOURS`, `minLeadTimeMessage` ao import de `./checkout-validation`):

```ts
describe("isBeforeMinLeadTime", () => {
  // now expresso em UTC (Z) de propósito: prova que o cálculo independe do TZ do runner.
  it("é true quando o evento está a menos de 24h", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "14:00", now)).toBe(true) // 23h em BRT
  })
  it("é false quando o evento está a exatamente 24h (fronteira permitida)", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "15:00", now)).toBe(false) // 24h em BRT
  })
  it("é false quando o evento está a mais de 24h", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "16:00", now)).toBe(false) // 25h em BRT
  })
  it("ancora o evento no horário do Brasil (-03:00), não no TZ do runtime", () => {
    // now = 12:00 BRT (15:00Z). Evento 12:00 BRT do dia seguinte = exatamente 24h.
    const now = new Date("2026-07-13T15:00:00Z")
    expect(isBeforeMinLeadTime("2026-07-14", "12:00", now)).toBe(false)
    expect(isBeforeMinLeadTime("2026-07-14", "11:00", now)).toBe(true)
  })
  it("expõe a constante e a mensagem", () => {
    expect(MIN_LEAD_TIME_HOURS).toBe(24)
    expect(minLeadTimeMessage).toBe("Pedidos exigem no minimo 24h de antecedencia")
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd app && npx vitest run lib/checkout-validation.test.ts`
Expected: FAIL — `isBeforeMinLeadTime is not a function` / import indefinido.

- [ ] **Step 3: Implementar o mínimo**

Adicionar no topo de `app/lib/checkout-validation.ts` (acima de `validateCheckout`):

```ts
export const MIN_LEAD_TIME_HOURS = 24

export const minLeadTimeMessage = `Pedidos exigem no minimo ${MIN_LEAD_TIME_HOURS}h de antecedencia`

// Brasil não tem horário de verão desde 2019, então o offset é fixo -03:00.
// Ancorar aqui torna o cálculo determinístico independente do timezone do runtime
// (browser do cliente em BRT; server na Vercel em UTC).
const BRAZIL_UTC_OFFSET = "-03:00"

// true quando o instante do evento (data + horário, horário de parede BR) está a
// menos de MIN_LEAD_TIME_HOURS de now. Fronteira exata (== 24h) retorna false.
export const isBeforeMinLeadTime = (
  dataEvento: string,
  horarioEvento: string,
  now: Date = new Date(),
): boolean => {
  const eventAt = new Date(`${dataEvento}T${horarioEvento}:00${BRAZIL_UTC_OFFSET}`)
  return eventAt.getTime() - now.getTime() < MIN_LEAD_TIME_HOURS * 3_600_000
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd app && npx vitest run lib/checkout-validation.test.ts`
Expected: PASS (novos casos + os antigos de `validateCheckout` continuam verdes).

- [ ] **Step 5: Commit**

```bash
git add app/lib/checkout-validation.ts app/lib/checkout-validation.test.ts
git commit -m "feat(checkout): pure isBeforeMinLeadTime helper (24h, -03:00 anchored)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Guard no cliente — `validateCheckout` + wiring do form

**Files:**
- Modify: `app/lib/checkout-validation.ts` (adicionar param `horarioEvento` + o guard de 24h)
- Modify: `app/components/checkout-form.tsx` (passar `horarioEvento` na chamada)
- Test: `app/lib/checkout-validation.test.ts`

**Interfaces:**
- Consumes: `isBeforeMinLeadTime`, `minLeadTimeMessage` (Task 1).
- Produces: `validateCheckout` agora exige `horarioEvento: string` no input; retorna `minLeadTimeMessage` quando o evento está a menos de 24h.

- [ ] **Step 1: Escrever os testes falhando**

No `describe("validateCheckout", ...)` de `app/lib/checkout-validation.test.ts`, primeiro atualizar o objeto `base` (topo do arquivo) para incluir o horário, e adicionar casos novos:

Atualizar `base`:

```ts
const base = {
  address: { numero: "10" },
  addressInArea: true as boolean | null,
  dataEvento: "2026-07-15",
  horarioEvento: "12:00",
  tipoChopeira: "gelo" as const,
  temRampas: "nao" as const,
  now: new Date("2026-07-01T12:00:00Z"),
}
```

Adicionar dentro do `describe("validateCheckout", ...)`:

```ts
it("rejeita evento a menos de 24h", () => {
  expect(validateCheckout({ ...base, dataEvento: "2026-07-01", horarioEvento: "18:00" }))
    .toBe("Pedidos exigem no minimo 24h de antecedencia")
})
it("aceita evento a mais de 24h", () => {
  expect(validateCheckout({ ...base, dataEvento: "2026-07-03", horarioEvento: "12:00" })).toBeNull()
})
it("pula o check de 24h quando o horario esta vazio", () => {
  expect(validateCheckout({ ...base, dataEvento: "2026-07-03", horarioEvento: "" })).toBeNull()
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd app && npx vitest run lib/checkout-validation.test.ts`
Expected: FAIL — TypeScript/asserção: `validateCheckout` ainda não conhece `horarioEvento` e não retorna a mensagem de 24h.

- [ ] **Step 3: Implementar o guard**

Em `app/lib/checkout-validation.ts`, atualizar a assinatura e o corpo de `validateCheckout`. Adicionar `horarioEvento: string` ao tipo do input e inserir o check logo após o de data-passado:

```ts
export const validateCheckout = (input: {
  address: { numero: string } | null
  addressInArea: boolean | null
  dataEvento: string
  horarioEvento: string
  tipoChopeira: "gelo" | "eletrica" | ""
  temRampas: "sim" | "nao" | ""
  now?: Date
}): string | null => {
  if (!input.address) return "Selecione um endereco valido"
  if (input.addressInArea === false) return "Infelizmente nao atendemos essa regiao"

  const eventDate = new Date(input.dataEvento + "T00:00:00")
  const today = new Date(input.now ?? new Date())
  today.setHours(0, 0, 0, 0)
  if (eventDate < today) return "A data do evento nao pode ser no passado"

  if (input.horarioEvento && isBeforeMinLeadTime(input.dataEvento, input.horarioEvento, input.now))
    return minLeadTimeMessage

  if (!input.tipoChopeira) return "Selecione o tipo de chopeira"
  if (input.address && !input.temRampas) return "Informe se o local possui rampas ou escadas"

  return null
}
```

- [ ] **Step 4: Passar `horarioEvento` no form**

Em `app/components/checkout-form.tsx`, dentro de `handleSubmit`, adicionar `horarioEvento` ao objeto passado para `validateCheckout` (a variável local `horarioEvento` já existe, ~linha 66):

```ts
    const validationError = validateCheckout({
      address: address ? { numero: address.numero } : null,
      addressInArea,
      dataEvento,
      horarioEvento,
      tipoChopeira,
      temRampas,
    })
```

- [ ] **Step 5: Rodar teste + typecheck e ver passar**

Run: `cd app && npx vitest run lib/checkout-validation.test.ts && npx tsc --noEmit`
Expected: PASS nos testes; `tsc` sem erros (o form agora satisfaz a nova assinatura).

- [ ] **Step 6: Commit**

```bash
git add app/lib/checkout-validation.ts app/lib/checkout-validation.test.ts app/components/checkout-form.tsx
git commit -m "feat(checkout): enforce 24h min lead time in client submit guard

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Guard no server — `createOrderSchema.superRefine`

**Files:**
- Modify: `app/lib/schemas.ts` (superRefine em `createOrderSchema`)
- Test: `app/lib/schemas.test.ts` (criar)

**Interfaces:**
- Consumes: `isBeforeMinLeadTime`, `minLeadTimeMessage` (Task 1); `createOrderSchema` (existente).
- Produces: `createOrderSchema` reprova payload cujo `data_evento`+`horario_evento` está a menos de 24h, com issue no path `["horario_evento"]`.

> Nota de layering: o `superRefine` usa `new Date()` real (sem injeção de `now`), então este teste prova só o **wiring** (futuro distante passa; passado reprova com issue em `horario_evento`). A precisão da fronteira de 24h já é coberta deterministicamente pelos testes de `isBeforeMinLeadTime` na Task 1. Não transformar isto em teste relativo a "agora" (fica flaky perto da meia-noite).

- [ ] **Step 1: Escrever os testes falhando**

Criar `app/lib/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { createOrderSchema } from "./schemas"

// CPF válido pelo algoritmo (validado em lib/cpf.ts).
const validPayload = {
  nome: "Fulano de Tal",
  telefone: "(21) 99999-9999",
  cpf: "529.982.247-25",
  data_evento: "2099-01-01",
  horario_evento: "12:00",
  endereco_bairro: "Centro",
  endereco_cidade: "Rio de Janeiro",
  endereco_estado: "RJ",
  endereco_lat: -22.9,
  endereco_lng: -43.2,
  tipo_chopeira: "gelo" as const,
  metodo_pagamento: "pix" as const,
  items: [{ produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1 }],
}

describe("createOrderSchema — 24h min lead time", () => {
  it("aceita evento bem no futuro", () => {
    expect(createOrderSchema.safeParse(validPayload).success).toBe(true)
  })
  it("reprova evento com menos de 24h (aqui: no passado) com issue em horario_evento", () => {
    const result = createOrderSchema.safeParse({ ...validPayload, data_evento: "2020-01-01" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("horario_evento"))).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd app && npx vitest run lib/schemas.test.ts`
Expected: FAIL — o segundo caso não encontra issue em `horario_evento` (o superRefine ainda não existe; só o refine de `data_evento` dispara).

- [ ] **Step 3: Implementar o superRefine**

Em `app/lib/schemas.ts`, adicionar o import no topo:

```ts
import { isBeforeMinLeadTime, minLeadTimeMessage } from "@/lib/checkout-validation"
```

E encadear `.superRefine` no `createOrderSchema` (logo após o `})` que fecha o `z.object({...})`):

```ts
export const createOrderSchema = z.object({
  // ...campos existentes, inalterados...
}).superRefine((val, ctx) => {
  if (isBeforeMinLeadTime(val.data_evento, val.horario_evento)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["horario_evento"],
      message: minLeadTimeMessage,
    })
  }
})
```

- [ ] **Step 4: Rodar teste + typecheck e ver passar**

Run: `cd app && npx vitest run lib/schemas.test.ts && npx tsc --noEmit`
Expected: PASS; `tsc` sem erros.

- [ ] **Step 5: Rodar a suite inteira**

Run: `cd app && npx vitest run`
Expected: PASS — todos os testes (nenhuma regressão nos guards de admin ou nas mensagens antigas).

- [ ] **Step 6: Commit**

```bash
git add app/lib/schemas.ts app/lib/schemas.test.ts
git commit -m "feat(checkout): enforce 24h min lead time in createOrderSchema (server)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificação final (após as 3 tasks)

- [ ] `cd app && npx vitest run` — suite inteira verde.
- [ ] `cd app && npx tsc --noEmit` — sem erros de tipo.
- [ ] Conferir que `manualOrderInputSchema`, `create_manual_order` e `updatePedidoSchema` continuam **sem** check de 24h (grep por `isBeforeMinLeadTime` deve aparecer só em `checkout-validation.ts`, `checkout-form.tsx` via validateCheckout, e `schemas.ts` no `createOrderSchema`).
- [ ] (Opcional, recomendado) `cd app && npm run build` para garantir build de produção limpo.

## Notas de escopo

- **Sem** desabilitar horários no dropdown (decisão: bloqueio no envio).
- **Sem** tornar 24h configurável no banco (constante).
- **Sem** override no site público (bypass é só o admin, que já é irrestrito).
