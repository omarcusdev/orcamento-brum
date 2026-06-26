# Deferred Backlog — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real component/server test net (jsdom + RTL + whatsapp-api vitest), then fix the group-A correctness items (addPedidoItem price guard, atomic createManualOrder, getDocumentSignedUrl dead branch, render the payment method).

**Architecture:** Work stacks on branch `refactor/thermo-nuclear-code-quality` (single PR #2). Pure pricing logic is extracted into tested helpers in `lib/pricing.ts` and reused by the server action; the multi-write order creation moves into one transactional Postgres function called via `supabase.rpc()`. UI test net via vitest's per-file `// @vitest-environment jsdom`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase (Postgres), Vitest 2.1.9, `@testing-library/react`.

## Global Constraints

- Branch: `refactor/thermo-nuclear-code-quality`; do NOT create new branches; all commits land in PR #2.
- Every task ends green: `npm --prefix app run typecheck`, `npm --prefix app run test`, and (for tasks touching the build graph) `npm --prefix app run build`.
- Behavior-preserving EXCEPT the explicit fixes here (addPedidoItem price guard is an intentional correctness change).
- Money columns are `numeric(10,2)`; Postgres rounds on write.
- Commit trailers required on every commit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_011vQov9fd6qHob8mbpchWG6`.
- Migrations: write SQL into `supabase/migrations/<NNN>_<name>.sql`; apply to STAGING (ref `iwyijyxpkchibdryzkpn`) first, prod only on merge.

---

## Phase 0 — Test infrastructure

### Task 1: jsdom + Testing Library in `app`

**Files:**
- Modify: `app/package.json` (devDependencies)
- Modify: `app/vitest.config.ts`
- Create: `app/vitest.setup.ts`
- Test: `app/components/ui/button.test.tsx`

**Interfaces:**
- Produces: a working `// @vitest-environment jsdom` path + jest-dom matchers, so later component tests can `render()` and use `toBeInTheDocument()`.

- [ ] **Step 1: Install dev deps**

```bash
npm --prefix app install -D jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: Add the vitest setup file**

Create `app/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest"
```

- [ ] **Step 3: Wire config (keep node default, add tsx glob + setup)**

Edit `app/vitest.config.ts` — `test` block becomes:
```ts
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    setupFiles: ["./vitest.setup.ts"],
  },
```
(Component tests opt into jsdom per-file via a top-of-file `// @vitest-environment jsdom` comment. The jest-dom import is harmless for node tests.)

- [ ] **Step 4: Write the smoke component test**

Create `app/components/ui/button.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"

describe("Button (smoke — jsdom infra)", () => {
  it("renderiza o label", () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument()
  })
})
```
(Verify the import: `app/components/ui/button.tsx` exports `Button` — adjust default vs named to match the file.)

- [ ] **Step 5: Run the smoke test**

Run: `npm --prefix app run test -- button.test`
Expected: PASS (1 test). If it fails on the import name, fix the import to match `button.tsx`'s actual export.

- [ ] **Step 6: Run full suite + typecheck (no regressions)**

Run: `npm --prefix app run test` → all pass (prev 219 + 1). `npm --prefix app run typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/package-lock.json app/vitest.config.ts app/vitest.setup.ts app/components/ui/button.test.tsx
git commit -m "test: add jsdom + Testing Library component-test infra"
```

### Task 2: vitest in `whatsapp-api`

**Files:**
- Modify: `whatsapp-api/package.json`
- Create: `whatsapp-api/vitest.config.ts`
- Test: `whatsapp-api/src/sanity.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm --prefix whatsapp-api install -D vitest@^2
```

- [ ] **Step 2: Add a test script**

In `whatsapp-api/package.json` `scripts`, add: `"test": "vitest run"`.

- [ ] **Step 3: Add config**

Create `whatsapp-api/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
})
```

- [ ] **Step 4: Sanity test**

Create `whatsapp-api/src/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest"

describe("whatsapp-api test harness", () => {
  it("roda", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run**

Run: `npm --prefix whatsapp-api run test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add whatsapp-api/package.json whatsapp-api/package-lock.json whatsapp-api/vitest.config.ts whatsapp-api/src/sanity.test.ts
git commit -m "test: add vitest harness to whatsapp-api"
```

---

## Phase 1 — Correctness (group A)

### Task 3: `addPedidoItem` reuses canonical barrel pricing

**Problem:** `addPedidoItem` computes `secondUnitPrice = preco_segundo_barril ?? firstUnitPrice` WITHOUT the canonical guard `segundo < à vista`, so a 2º-barril price ≥ à vista is wrongly applied to extra barrels.

**Files:**
- Modify: `app/lib/pricing.ts` (export a tested helper)
- Modify: `app/lib/admin-actions/pedido-edit.ts` (`addPedidoItem`)
- Test: `app/lib/pricing.test.ts`

**Interfaces:**
- Produces: `export const barrelUnitPrices = (produto: ProdutoForPricing, metodoPagamento?: PaymentMethod) => { firstUnitPrice: number; secondUnitPrice: number }` — the guarded per-barrel prices (first full, second = promo only if cheaper).

- [ ] **Step 1: Write the failing test**

Add to `app/lib/pricing.test.ts`:
```ts
import { barrelUnitPrices } from "./pricing"

describe("barrelUnitPrices (guarded 2º barril)", () => {
  it("aplica o 2º barril só quando é mais barato que à vista", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: null, preco_segundo_barril: 385 })).toEqual({ firstUnitPrice: 500, secondUnitPrice: 385 })
  })
  it("ignora 2º barril >= à vista (trava): segundo cai pro preço cheio", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: null, preco_segundo_barril: 600 })).toEqual({ firstUnitPrice: 500, secondUnitPrice: 500 })
  })
  it("usa preco_cartao como base no cartão", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: 530, preco_segundo_barril: 385 }, "cartao")).toEqual({ firstUnitPrice: 530, secondUnitPrice: 385 })
  })
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `npm --prefix app run test -- pricing.test`
Expected: FAIL ("barrelUnitPrices is not a function").

- [ ] **Step 3: Implement the helper (reuse the existing private logic)**

In `app/lib/pricing.ts`, export a wrapper over the existing `unitPricesFor` logic (which already has the guard):
```ts
export const barrelUnitPrices = (produto: ProdutoForPricing, metodoPagamento: PaymentMethod = "pix") =>
  unitPricesFor(produto, metodoPagamento)
```
(`unitPricesFor` already returns `{ firstUnitPrice, secondUnitPrice }` with `promoApplies = segundoBarril != null && segundoBarril < firstUnitPrice`. If it is defined below this line, move the `export const barrelUnitPrices` to after `unitPricesFor`.)

- [ ] **Step 4: Run — verify pass**

Run: `npm --prefix app run test -- pricing.test`
Expected: PASS.

- [ ] **Step 5: Use it in `addPedidoItem`**

In `app/lib/admin-actions/pedido-edit.ts`, add `barrelUnitPrices` to the pricing import, and replace the hand-rolled price block:
```ts
  const { firstUnitPrice, secondUnitPrice } = barrelUnitPrices(
    { id: produtoId, preco_avista: Number(produto.preco_avista), preco_cartao: produto.preco_cartao != null ? Number(produto.preco_cartao) : null, preco_segundo_barril: produto.preco_segundo_barril != null ? Number(produto.preco_segundo_barril) : null },
    pedido.metodo_pagamento === "cartao" ? "cartao" : "pix",
  )
```
(Delete the old `const firstUnitPrice = ...` / `const secondUnitPrice = ...` lines. The rest of `addPedidoItem` — consignado rows and non-consignado subtotal — stays identical.)

- [ ] **Step 6: Verify green**

Run: `npm --prefix app run typecheck` (clean), `npm --prefix app run test` (all pass), `npm --prefix app run build` (clean).

- [ ] **Step 7: Commit**

```bash
git add app/lib/pricing.ts app/lib/pricing.test.ts app/lib/admin-actions/pedido-edit.ts
git commit -m "fix(admin): addPedidoItem honors the canonical 2º-barril price guard"
```

### Task 4: `createManualOrder` becomes one transactional Postgres RPC

**Problem:** create inserts cliente → pedido → itens → status_log as separate writes; a mid-way failure can orphan a freshly-created cliente.

**Files:**
- Create: `supabase/migrations/028_create_manual_order_rpc.sql`
- Modify: `app/lib/admin-actions/pedido-edit.ts` (`createManualOrder`)

**Interfaces:**
- Produces: SQL function `create_manual_order(p_cliente jsonb, p_pedido jsonb, p_itens jsonb, p_user uuid) returns uuid` (the new pedido id), atomic.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/028_create_manual_order_rpc.sql`:
```sql
create or replace function public.create_manual_order(
  p_cliente jsonb,
  p_pedido jsonb,
  p_itens jsonb,
  p_user uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_pedido_id uuid;
begin
  if p_cliente->>'kind' = 'existing' then
    v_cliente_id := (p_cliente->>'id')::uuid;
  else
    insert into clientes (nome, telefone, cpf, email)
    values (p_cliente->>'nome', p_cliente->>'telefone', p_cliente->>'cpf', p_cliente->>'email')
    returning id into v_cliente_id;
  end if;

  insert into pedidos (
    cliente_id, status, documento_status, endereco, endereco_completo,
    data_evento, horario_evento, tipo_chopeira, rampas_escadas, observacoes,
    subtotal, desconto, frete, total, metodo_pagamento, pago
  ) values (
    v_cliente_id, 'confirmado', 'pendente', p_pedido->>'endereco', p_pedido->'endereco_completo',
    (p_pedido->>'data_evento')::date, (p_pedido->>'horario_evento')::time, p_pedido->>'tipo_chopeira',
    p_pedido->>'rampas_escadas', p_pedido->>'observacoes',
    (p_pedido->>'subtotal')::numeric, (p_pedido->>'desconto')::numeric, (p_pedido->>'frete')::numeric,
    (p_pedido->>'total')::numeric, p_pedido->>'metodo_pagamento', (p_pedido->>'pago')::boolean
  ) returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, subtotal, is_consignado, consignado_status)
  select v_pedido_id, (i->>'produto_id')::uuid, (i->>'quantidade')::int, (i->>'preco_unitario')::numeric,
         (i->>'subtotal')::numeric, (i->>'is_consignado')::boolean, (i->>'consignado_status')
  from jsonb_array_elements(p_itens) as i;

  insert into pedido_status_log (pedido_id, status_anterior, status_novo, changed_by)
  values (v_pedido_id, null, 'confirmado', p_user);

  return v_pedido_id;
end;
$$;

revoke all on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) to authenticated, service_role;
```

- [ ] **Step 2: Apply to STAGING**

Apply via Supabase MCP `apply_migration` on staging ref `iwyijyxpkchibdryzkpn` (or `supabase db push` from repo root with staging linked). Confirm the function exists.

- [ ] **Step 3: Refactor `createManualOrder` to call the RPC**

In `app/lib/admin-actions/pedido-edit.ts`, keep validation + pricing (`priceManualOrderLines` → `itemRows` + `calculateStoredTotals` → subtotal/total) exactly as-is. Replace the cliente/pedido/itens/status_log inserts (and the manual rollback delete) with:
```ts
  const { data: pedidoId, error: rpcErr } = await supabase.rpc("create_manual_order", {
    p_cliente: data.cliente,
    p_pedido: {
      endereco: data.endereco,
      endereco_completo: data.endereco_completo,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      tipo_chopeira: data.tipo_chopeira,
      rampas_escadas: data.rampas_escadas,
      observacoes: data.observacoes,
      subtotal,
      desconto: 0,
      frete: data.frete,
      total,
      metodo_pagamento: data.metodo_pagamento,
      pago: data.pago,
    },
    p_itens: itemRows,
    p_user: user.id,
  })
  if (rpcErr || !pedidoId) throw new Error(`Erro ao criar pedido: ${rpcErr?.message ?? "desconhecido"}`)
```
Then the `after(() => sendCustomerOrderConfirmation(pedidoId))` + `after(() => sendCustomerWhatsAppConfirmation(pedidoId))` + `revalidatePath` calls use `pedidoId` (a string now, not `pedido.id`). Return `{ pedidoId }`. For the cpf-on-new-cliente digit-strip, pass `cpf: cpfDigits` inside `data.cliente` is not possible (discriminated union is read-only) — instead compute the cliente payload explicitly:
```ts
  const clientePayload = data.cliente.kind === "existing"
    ? data.cliente
    : { kind: "new" as const, nome: data.cliente.nome, telefone: data.cliente.telefone, cpf: data.cliente.cpf?.replace(/\D/g, "") ?? null, email: data.cliente.email ?? null }
```
and pass `p_cliente: clientePayload`. Remove the now-dead standalone cliente-insert block.

- [ ] **Step 4: Verify green + staging smoke**

Run: `npm --prefix app run typecheck`, `npm --prefix app run test`, `npm --prefix app run build` (all clean). Then on staging: create a manual order (new cliente + 1 consignado + 1 firm) via the admin UI; confirm pedido + itens + status_log rows exist and totals match; confirm no orphan cliente when forcing an item error (optional).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/028_create_manual_order_rpc.sql app/lib/admin-actions/pedido-edit.ts
git commit -m "fix(admin): make createManualOrder atomic via transactional RPC"
```

### Task 5: `getDocumentSignedUrl` — drop the dead branch

**Files:**
- Modify: `app/lib/admin-actions/documentos.ts`
- Modify: callers if signature changes (grep `getDocumentSignedUrl(` — `app/components/admin/document-section.tsx`)

- [ ] **Step 1: Confirm usage**

Run: `grep -rn "getDocumentSignedUrl\b" app --include=*.tsx --include=*.ts`
Determine whether the `tipo: "pessoal" | "residencia"` param is ever called with `"pessoal"` (the documents are now `documento_pessoal_urls[]` + path-based via `getDocumentSignedUrlByPath`). If `"pessoal"` is dead, the function is redundant with `getDocumentSignedUrlByPath`.

- [ ] **Step 2: Remove or consolidate**

If unused entirely: delete `getDocumentSignedUrl` and have any caller use `getDocumentSignedUrlByPath`. If only the `"pessoal"` branch is dead but `"residencia"` is used: narrow the param to the used case. Apply whichever the grep proves.

- [ ] **Step 3: Verify green**

Run: `npm --prefix app run typecheck` (clean — catches any missed caller), `npm --prefix app run test`, `npm --prefix app run build`.

- [ ] **Step 4: Commit**

```bash
git add app/lib/admin-actions/documentos.ts app/components/admin/document-section.tsx
git commit -m "refactor(admin): drop dead getDocumentSignedUrl branch"
```

### Task 6: Render `metodo_pagamento` as a badge on the order card

**Files:**
- Modify: `app/components/admin/order-card.tsx`
- Test: `app/components/admin/order-card.test.tsx`

**Interfaces:**
- Consumes: `OrderListItem.metodo_pagamento` (already fetched via `PEDIDO_LIST_SELECT`).

- [ ] **Step 1: Write the failing component test**

Create `app/components/admin/order-card.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import OrderCard from "./order-card"

vi.mock("@/lib/admin-actions", () => ({ archiveOrder: vi.fn(), unarchiveOrder: vi.fn() }))

const pedido = {
  id: "a", status: "confirmado", documento_status: "pendente", total: 500,
  data_evento: "2026-07-15", horario_evento: "18:00", endereco: "Rua X",
  metodo_pagamento: "pix", created_at: "2026-07-01T12:00:00Z", arquivado_em: null,
  clientes: { nome: "Ana", telefone: "51999" },
}

describe("OrderCard payment badge", () => {
  it("mostra o método de pagamento", () => {
    render(<OrderCard pedido={pedido} />)
    expect(screen.getByText("Pix")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `npm --prefix app run test -- order-card.test`
Expected: FAIL (no "Pix" text).

- [ ] **Step 3: Implement the badge**

In `app/components/admin/order-card.tsx`, add a label map near `docStatusConfig`:
```tsx
const metodoLabel: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" }
```
And inside the badges row (after the docs badge / arquivado badge), render when present:
```tsx
{pedido.metodo_pagamento && (
  <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 text-brand-gray-light bg-white/5">
    {metodoLabel[pedido.metodo_pagamento] ?? pedido.metodo_pagamento}
  </span>
)}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm --prefix app run test -- order-card.test`
Expected: PASS.

- [ ] **Step 5: Verify green**

Run: `npm --prefix app run typecheck`, `npm --prefix app run test`, `npm --prefix app run build` (all clean).

- [ ] **Step 6: Commit**

```bash
git add app/components/admin/order-card.tsx app/components/admin/order-card.test.tsx
git commit -m "feat(admin): show payment-method badge on the order card"
```

---

## Self-Review

- **Spec coverage (Phase 0+1):** test infra (Task 1–2) ✓; addPedidoItem guard (Task 3) ✓; createManualOrder atomic RPC (Task 4) ✓; getDocumentSignedUrl (Task 5) ✓; metodo_pagamento badge (Task 6) ✓. Phases 2–5 are intentionally separate plans (scope check).
- **Placeholders:** none — each code step has concrete code; Task 5 is conditional on a grep whose two outcomes are both specified.
- **Type consistency:** `barrelUnitPrices` returns `{ firstUnitPrice, secondUnitPrice }` (Task 3) and is consumed with those exact names in `addPedidoItem`. `create_manual_order` returns `uuid` consumed as `pedidoId: string` (Task 4). `OrderListItem.metodo_pagamento: string | null` matches the Task 6 guard.

## Next plans (created when we reach them)
- Phase 2 (UI primitives + dedup), Phase 3 (product decisions), Phase 4 (whatsapp-api), Phase 5 (faxina) — each its own plan with fresh reads of then-current code.
