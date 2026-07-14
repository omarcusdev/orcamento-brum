# Trava ≥1 barril firme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bloquear qualquer pedido onde todos os itens são consignado — exigir ≥1 barril firme (não-consignado), na criação manual e na edição.

**Architecture:** Um predicado puro `hasFirmeItem` em `lib/pricing.ts` é a única definição da regra. Ele é reusado em 4 guards app-level: schema do pedido manual (server), `canSubmit` do drawer (client), `removePedidoItem` e `addPedidoItem` (server). Sem migration.

**Tech Stack:** TypeScript, Next.js 15 Server Actions, Zod, Supabase JS, Vitest.

## Global Constraints

- Mensagem única de erro: `"Pedido precisa de ao menos 1 item nao-consignado (firme)"` (sem acento, igual ao padrão do repo em `checkout-validation.ts`).
- `hasFirmeItem` é a **única** fonte da regra — nenhum guard reimplementa `some(!is_consignado)` na mão.
- `pricing.ts` é módulo puro (só importa `@/lib/types`) — pode ser importado por client component e por arquivos `"use server"`.
- CI pula vitest (gotcha do repo) — rodar `npx vitest run` localmente antes de considerar pronto.
- Arquivos `"use server"` só exportam funções async; importar funções puras é permitido.

---

### Task 1: Predicado puro `hasFirmeItem`

**Files:**
- Modify: `app/lib/pricing.ts` (adicionar no fim do arquivo)
- Test: `app/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `REQUIRE_FIRME_MESSAGE: string`
  - `hasFirmeItem(items: readonly { is_consignado: boolean }[]): boolean`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `app/lib/pricing.test.ts`:

```ts
import { hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "./pricing"

describe("hasFirmeItem", () => {
  it("true quando ha ao menos um item firme", () => {
    expect(hasFirmeItem([{ is_consignado: false }])).toBe(true)
    expect(hasFirmeItem([{ is_consignado: true }, { is_consignado: false }])).toBe(true)
  })
  it("false quando todos os itens sao consignado", () => {
    expect(hasFirmeItem([{ is_consignado: true }, { is_consignado: true }])).toBe(false)
  })
  it("false para lista vazia", () => {
    expect(hasFirmeItem([])).toBe(false)
  })
  it("expoe a mensagem padrao da trava", () => {
    expect(REQUIRE_FIRME_MESSAGE).toMatch(/firme/i)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run lib/pricing.test.ts -t hasFirmeItem`
Expected: FAIL — `hasFirmeItem is not a function` / import não resolve.

- [ ] **Step 3: Implementar o mínimo**

Adicionar ao fim de `app/lib/pricing.ts`:

```ts
// Regra de negócio: todo pedido precisa de ao menos 1 barril firme (não-consignado).
// Um pedido 100% consignado deixa o cliente pagando só o frete — bloqueado em todos os guards.
export const REQUIRE_FIRME_MESSAGE = "Pedido precisa de ao menos 1 item nao-consignado (firme)"

export const hasFirmeItem = (items: readonly { is_consignado: boolean }[]): boolean =>
  items.some((i) => !i.is_consignado)
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run lib/pricing.test.ts -t hasFirmeItem`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add app/lib/pricing.ts app/lib/pricing.test.ts
git commit -m "feat(consignado): pure hasFirmeItem guard + REQUIRE_FIRME_MESSAGE"
```

---

### Task 2: Guard server na criação (`manualOrderInputSchema`)

**Files:**
- Modify: `app/lib/schemas.ts` (import no topo + `.superRefine` em `manualOrderInputSchema`, ~L96-109)
- Test: `app/lib/schemas.test.ts`

**Interfaces:**
- Consumes: `hasFirmeItem`, `REQUIRE_FIRME_MESSAGE` de `@/lib/pricing`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `app/lib/schemas.test.ts` (importar `manualOrderInputSchema` no topo do arquivo, junto do import existente de `./schemas`):

```ts
import { manualOrderInputSchema } from "./schemas"
import { REQUIRE_FIRME_MESSAGE } from "./pricing"

const validManualOrder = {
  cliente: { kind: "existing" as const, id: "00000000-0000-0000-0000-000000000000" },
  endereco: "Rua X, 123",
  endereco_completo: null,
  data_evento: "2099-01-01",
  horario_evento: "12:00",
  tipo_chopeira: "gelo" as const,
  rampas_escadas: null,
  observacoes: null,
  items: [{ produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: false }],
  metodo_pagamento: "pix" as const,
  pago: false,
  frete: 20,
}

describe("manualOrderInputSchema — trava >=1 firme", () => {
  it("aceita pedido com ao menos um item firme", () => {
    expect(manualOrderInputSchema.safeParse(validManualOrder).success).toBe(true)
  })
  it("aceita misto (firme + consignado)", () => {
    const input = { ...validManualOrder, items: [
      { produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: false },
      { produto_id: "00000000-0000-0000-0000-000000000001", quantidade: 1, is_consignado: true },
    ] }
    expect(manualOrderInputSchema.safeParse(input).success).toBe(true)
  })
  it("rejeita pedido 100% consignado com issue em items", () => {
    const input = { ...validManualOrder, items: [
      { produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: true },
      { produto_id: "00000000-0000-0000-0000-000000000001", quantidade: 2, is_consignado: true },
    ] }
    const result = manualOrderInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("items") && i.message === REQUIRE_FIRME_MESSAGE)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd app && npx vitest run lib/schemas.test.ts -t "trava"`
Expected: FAIL — o caso "rejeita 100% consignado" espera `success=false` mas o schema atual aceita.

- [ ] **Step 3: Implementar o mínimo**

Em `app/lib/schemas.ts`, adicionar ao bloco de imports do topo:

```ts
import { hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "@/lib/pricing"
```

Trocar o fechamento de `manualOrderInputSchema` (o `})` logo após `frete: z.number().nonnegative(),`) por um `.superRefine`:

```ts
export const manualOrderInputSchema = z.object({
  cliente: z.discriminatedUnion("kind", [manualOrderClienteExistingSchema, manualOrderClienteNewSchema]),
  endereco: z.string().min(1).max(500),
  endereco_completo: enderecoCompletoSchema.nullable(),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/),
  tipo_chopeira: z.enum(["gelo", "eletrica"]),
  rampas_escadas: z.string().max(500).nullable(),
  observacoes: z.string().max(1000).nullable(),
  items: z.array(manualOrderItemSchema).min(1),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
  pago: z.boolean(),
  frete: z.number().nonnegative(),
}).superRefine((val, ctx) => {
  if (!hasFirmeItem(val.items)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: REQUIRE_FIRME_MESSAGE,
    })
  }
})
```

(`z.infer` sobre `ZodEffects` continua inferindo o mesmo tipo — `ManualOrderInput` não muda.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd app && npx vitest run lib/schemas.test.ts`
Expected: PASS (checkout + manual).

- [ ] **Step 5: Commit**

```bash
git add app/lib/schemas.ts app/lib/schemas.test.ts
git commit -m "feat(consignado): server guard — manualOrderInputSchema requires >=1 firme"
```

---

### Task 3: Guard client — `canSubmit` + aviso no drawer

**Files:**
- Modify: `app/components/admin/manual-order-drawer.tsx` (import ~L11, `canSubmit` ~L170-178, aviso ~L466)

**Interfaces:**
- Consumes: `hasFirmeItem`, `REQUIRE_FIRME_MESSAGE` de `@/lib/pricing`

> Sem teste unitário — componente client sem harness de RTL para este drawer. Verificação por typecheck + build (Step 3) e eyeball opcional.

- [ ] **Step 1: Import**

Trocar a linha de import de pricing (L11):

```ts
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit } from "@/lib/pricing"
```

por:

```ts
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit, hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "@/lib/pricing"
```

- [ ] **Step 2: `canSubmit`**

Em `canSubmit` (~L170), adicionar a cláusula `hasFirmeItem(items)` logo após `items.every((i) => i.quantidade >= 1) &&`:

```ts
  const canSubmit =
    !submitting &&
    items.length > 0 &&
    items.every((i) => i.quantidade >= 1) &&
    hasFirmeItem(items) &&
    !!enderecoText &&
    !!dataEvento &&
    !!horarioEvento &&
    ((clienteMode === "search" && !!selectedCliente) ||
      (clienteMode === "new" && newCliente.nome.length >= 2 && newCliente.telefone.length >= 10))
```

- [ ] **Step 3: Aviso inline**

Em `app/components/admin/manual-order-drawer.tsx`, na linha após `</section>` (~L465) e antes de `{error && ...}` (~L467), inserir:

```tsx
        {items.length > 0 && !hasFirmeItem(items) && (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {REQUIRE_FIRME_MESSAGE}
          </p>
        )}
```

- [ ] **Step 4: Verificar typecheck + build**

Run: `cd app && npx tsc --noEmit && npm run build`
Expected: sem erros de tipo; build ok.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/manual-order-drawer.tsx
git commit -m "feat(consignado): drawer blocks submit + warns when order is all-consignado"
```

---

### Task 4: Guards server na edição — `removePedidoItem` + `addPedidoItem`

**Files:**
- Modify: `app/lib/admin-actions/pedido-edit.ts` (import ~L6, `removePedidoItem` ~L422-453, `addPedidoItem` ~L299-369)

**Interfaces:**
- Consumes: `hasFirmeItem`, `REQUIRE_FIRME_MESSAGE` de `@/lib/pricing`

> Sem teste unitário — server actions dependem do Supabase e o repo não tem harness pra elas. A regra já está coberta em Task 1 pelo predicado puro; aqui é wiring, verificado por typecheck + build.

- [ ] **Step 1: Import**

Trocar a linha de import de pricing (L6):

```ts
import { calculateStoredTotals, priceManualOrderLines, barrelUnitPrices } from "@/lib/pricing"
```

por:

```ts
import { calculateStoredTotals, priceManualOrderLines, barrelUnitPrices, hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "@/lib/pricing"
```

- [ ] **Step 2: Guard em `removePedidoItem`**

Em `removePedidoItem`, logo após o bloco que valida `LOCKED_EDIT_STATUSES` (após `if (pedidoStatus && LOCKED_EDIT_STATUSES.includes(pedidoStatus)) throw new Error("Pedido travado")`) e ANTES do `delete`, inserir:

```ts
  // Trava: remover o último barril firme deixaria o pedido 100% consignado. Bloqueia.
  // (Esvaziar o pedido até 0 itens continua permitido — remaining vazio não dispara.)
  const { data: remaining } = await supabase
    .from("pedido_itens")
    .select("is_consignado")
    .eq("pedido_id", item.pedido_id)
    .neq("id", itemId)
  if (remaining && remaining.length > 0 && !hasFirmeItem(remaining)) {
    throw new Error(REQUIRE_FIRME_MESSAGE)
  }
```

- [ ] **Step 3: Guard em `addPedidoItem`**

Em `addPedidoItem`, logo após o bloco `if (LOCKED_EDIT_STATUSES.includes(pedido.status)) throw new Error("Pedido travado")` e ANTES de buscar o produto, inserir:

```ts
  // Trava defensiva: adicionar consignado a um pedido sem nenhum item firme o deixaria 100% consignado.
  // Adicionar item firme é sempre permitido.
  if (isConsignado) {
    const { data: existentes } = await supabase
      .from("pedido_itens")
      .select("is_consignado")
      .eq("pedido_id", pedidoId)
    if (!hasFirmeItem(existentes ?? [])) {
      throw new Error(REQUIRE_FIRME_MESSAGE)
    }
  }
```

- [ ] **Step 4: Verificar typecheck + build**

Run: `cd app && npx tsc --noEmit && npm run build`
Expected: sem erros de tipo; build ok.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions/pedido-edit.ts
git commit -m "feat(consignado): edit guards — remove/add keep >=1 firme per order"
```

---

## Verificação final (após as 4 tasks)

- [ ] `cd app && npx vitest run` — toda a suíte verde.
- [ ] `cd app && npx tsc --noEmit` — sem erros.
- [ ] `cd app && npm run build` — build ok.
- [ ] Revisão adversarial multi-agente do diff completo (caça-buracos na trava).

## Self-review (feito ao escrever)

- **Cobertura do spec:** regra pura (Task 1) ✓; guard criação server (Task 2) ✓; guard UX client (Task 3) ✓; guards edição remove+add (Task 4) ✓; testes pricing+schemas ✓; verificação ✓. Sem gaps.
- **Placeholders:** nenhum — todo passo tem código/comando real.
- **Consistência de tipos:** `hasFirmeItem(items: readonly { is_consignado: boolean }[])` — as chamadas passam `items` do drawer (`DraftItem` tem `is_consignado`), `val.items` do zod (`is_consignado`), e linhas do supabase selecionando `is_consignado`. Mensagem `REQUIRE_FIRME_MESSAGE` idêntica em todos os sites. OK.
