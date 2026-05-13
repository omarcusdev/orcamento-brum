# Admin Operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six admin features so Jean can run the operation without depending on the public checkout: manual order entry, status revert, identity front+back upload, consigned barrel, undo document verification, and pedido editing with audit log.

**Architecture:** Single Supabase migration (020) adds `documento_pessoal_urls` array, consignado columns on `pedido_items`, and a `pedido_edit_log` table. Server actions in `lib/admin-actions.ts` handle the new flows; pricing recalculations live in `lib/pricing.ts`. UI surfaces in `/admin` (manual order drawer trigger) and `/admin/pedidos/[id]` (revert, edit, desverificar, consignado banner). The cliente checkout flow extends `document-upload-section.tsx` to accept 1-2 photos.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), React 19, Tailwind CSS v4, Zod, vitest

**Spec:** `docs/superpowers/specs/2026-05-13-admin-operacional-design.md`

---

### Task 1: Migration 020 — schema changes

**Files:**
- Create: `supabase/migrations/020_admin_operacional.sql`

- [ ] **Step 1: Write migration**

```sql
-- Cliente: documento_pessoal_url -> documento_pessoal_urls (array)
ALTER TABLE clientes ADD COLUMN documento_pessoal_urls TEXT[];

UPDATE clientes
SET documento_pessoal_urls = ARRAY[documento_pessoal_url]
WHERE documento_pessoal_url IS NOT NULL;

ALTER TABLE clientes
ADD CONSTRAINT documento_pessoal_urls_size
CHECK (documento_pessoal_urls IS NULL
       OR (array_length(documento_pessoal_urls, 1) BETWEEN 1 AND 2));

ALTER TABLE clientes DROP COLUMN documento_pessoal_url;

-- Pedido items: consignado
ALTER TABLE pedido_items
  ADD COLUMN is_consignado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN consignado_status TEXT NULL
    CHECK (consignado_status IN ('pendente', 'usado', 'devolvido'));

ALTER TABLE pedido_items
  ADD CONSTRAINT pedido_items_consignado_status_when_consignado
  CHECK (is_consignado = false OR consignado_status IS NOT NULL);

ALTER TABLE pedido_items
  ADD CONSTRAINT pedido_items_consignado_qty_one
  CHECK (is_consignado = false OR quantidade = 1);

CREATE UNIQUE INDEX pedido_items_um_consignado_por_pedido
  ON pedido_items (pedido_id)
  WHERE is_consignado = true;

-- pedido_edit_log
CREATE TABLE pedido_edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pedido_edit_log_pedido_id_idx
  ON pedido_edit_log(pedido_id, changed_at DESC);

ALTER TABLE pedido_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY pedido_edit_log_admin_select
  ON pedido_edit_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY pedido_edit_log_admin_insert
  ON pedido_edit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

- [ ] **Step 2: Apply migration to local Supabase**

Run: `supabase db push --include-all`

Expected: migration applies cleanly, no errors. Confirm in dashboard that:
- `clientes.documento_pessoal_urls` exists as TEXT[]
- `clientes.documento_pessoal_url` no longer exists
- `pedido_items.is_consignado` and `pedido_items.consignado_status` exist
- `pedido_edit_log` table exists with policies

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/020_admin_operacional.sql
git commit -m "feat(db): migration 020 — documento array, consignado, edit log"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `app/lib/types.ts`

- [ ] **Step 1: Update `Cliente`, `PedidoItem`, add `PedidoEditLog`**

Replace `documento_pessoal_url` line in `Cliente`:

```ts
export type Cliente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  cpf: string | null
  documento_pessoal_urls: string[] | null
  comprovante_residencia_url: string | null
  documento_verificado: boolean
  documento_verificado_em: string | null
  documento_verificado_por: string | null
  created_at: string
}
```

Add `is_consignado` and `consignado_status` to `PedidoItem`:

```ts
export type ConsignadoStatus = "pendente" | "usado" | "devolvido"

export type PedidoItem = {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  is_consignado: boolean
  consignado_status: ConsignadoStatus | null
}
```

Add `PedidoEditLog` type:

```ts
export type PedidoEditLog = {
  id: string
  pedido_id: string
  field: string
  old_value: unknown
  new_value: unknown
  changed_by: string | null
  changed_at: string
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd app && pnpm typecheck` (or `npx tsc --noEmit`)
Expected: compile errors on existing files referencing `documento_pessoal_url` — those are expected, fix in Task 3.

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat(types): documento_pessoal_urls array, consignado fields, PedidoEditLog"
```

---

### Task 3: Fix all references to `documento_pessoal_url` (singular)

**Files:**
- Grep first to find every usage: `cd app && grep -rn "documento_pessoal_url" --include="*.ts" --include="*.tsx"`

- [ ] **Step 1: List affected files**

Run the grep above. Expected files include `lib/queries.ts`, `lib/actions.ts`, `lib/admin-actions.ts`, `components/document-upload-section.tsx`, `components/document-upload.tsx`, possibly `app/admin/(authenticated)/pedidos/[id]/page.tsx`.

- [ ] **Step 2: For each occurrence, migrate to `documento_pessoal_urls` array semantics**

Rules:
- DB select/insert/update: change column name to `documento_pessoal_urls`
- Single-value reads (`cliente.documento_pessoal_url`) → `cliente.documento_pessoal_urls?.[0] ?? null`
- Upload action: append into array instead of overwrite (see Task 8 for full upload flow rewrite)

Apply minimal changes to compile. Full upload UI rewrite happens in Task 8.

- [ ] **Step 3: Verify typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "fix(types): migrate documento_pessoal_url references to array"
```

---

### Task 4: Pricing — `calculateOrderTotals` with consignado

**Files:**
- Modify: `app/lib/pricing.ts`
- Test: `app/lib/pricing.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `app/lib/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { calculateOrderTotals } from "./pricing"

describe("calculateOrderTotals", () => {
  const baseItem = { subtotal: 500, is_consignado: false, consignado_status: null as null | string }
  const consignadoPendente = { subtotal: 400, is_consignado: true, consignado_status: "pendente" }
  const consignadoUsado = { subtotal: 400, is_consignado: true, consignado_status: "usado" }
  const consignadoDevolvido = { subtotal: 400, is_consignado: true, consignado_status: "devolvido" }

  it("returns single total when no consignado", () => {
    const totals = calculateOrderTotals([baseItem])
    expect(totals.subtotalMin).toBe(500)
    expect(totals.subtotalMax).toBe(500)
    expect(totals.hasPendente).toBe(false)
  })

  it("returns min/max when consignado pendente", () => {
    const totals = calculateOrderTotals([baseItem, consignadoPendente])
    expect(totals.subtotalMin).toBe(500)
    expect(totals.subtotalMax).toBe(900)
    expect(totals.hasPendente).toBe(true)
  })

  it("includes consignado in min when usado", () => {
    const totals = calculateOrderTotals([baseItem, consignadoUsado])
    expect(totals.subtotalMin).toBe(900)
    expect(totals.subtotalMax).toBe(900)
    expect(totals.hasPendente).toBe(false)
  })

  it("excludes consignado from min when devolvido", () => {
    const totals = calculateOrderTotals([baseItem, consignadoDevolvido])
    expect(totals.subtotalMin).toBe(500)
    expect(totals.subtotalMax).toBe(900)
    expect(totals.hasPendente).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && pnpm vitest run lib/pricing.test.ts`
Expected: FAIL — `calculateOrderTotals is not a function`.

- [ ] **Step 3: Implement `calculateOrderTotals`**

Append to `app/lib/pricing.ts`:

```ts
export type OrderItemForTotals = {
  subtotal: number
  is_consignado: boolean
  consignado_status: string | null
}

export type OrderTotals = {
  subtotalMin: number
  subtotalMax: number
  hasPendente: boolean
}

export const calculateOrderTotals = (items: OrderItemForTotals[]): OrderTotals => {
  const subtotalMin = items
    .filter((i) => !i.is_consignado || i.consignado_status === "usado")
    .reduce((sum, i) => sum + i.subtotal, 0)

  const subtotalMax = items
    .filter((i) => !i.is_consignado || i.consignado_status !== "devolvido")
    .reduce((sum, i) => sum + i.subtotal, 0)

  const hasPendente = items.some((i) => i.is_consignado && i.consignado_status === "pendente")

  return { subtotalMin, subtotalMax, hasPendente }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && pnpm vitest run lib/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/pricing.ts app/lib/pricing.test.ts
git commit -m "feat(pricing): calculateOrderTotals with consignado min/max"
```

---

### Task 5: Zod schemas for manual order + update pedido

**Files:**
- Modify: `app/lib/schemas.ts`

- [ ] **Step 1: Add `manualOrderInputSchema`**

Append to `app/lib/schemas.ts`:

```ts
export const manualOrderItemSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().min(1).max(100),
  is_consignado: z.boolean().default(false),
})

export const manualOrderInputSchema = z.object({
  cliente: z.union([
    z.object({ id: z.string().uuid() }),
    z.object({
      nome: z.string().min(2).max(200),
      telefone: z.string().regex(phoneRegex, "Telefone invalido"),
      cpf: z.string().optional().nullable(),
      email: z.string().email().max(254).optional().nullable(),
    }),
  ]),
  endereco: z.string().min(1).max(500),
  endereco_completo: z.object({
    rua: z.string(),
    numero: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    estado: z.string().length(2),
    cep: z.string(),
    complemento: z.string(),
    lat: z.number(),
    lng: z.number(),
  }).nullable(),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/),
  tipo_chopeira: z.enum(["gelo", "eletrica"]),
  rampas_escadas: z.string().max(500).nullable(),
  observacoes: z.string().max(1000).nullable(),
  items: z.array(manualOrderItemSchema).min(1),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]),
  pago: z.boolean().default(false),
  frete: z.number().nonnegative().default(0),
}).refine(
  (input) => input.items.filter((i) => i.is_consignado).length <= 1,
  { message: "No maximo 1 item pode ser consignado" },
)

export type ManualOrderInput = z.infer<typeof manualOrderInputSchema>
```

- [ ] **Step 2: Add `updatePedidoSchema`**

Append to `app/lib/schemas.ts`:

```ts
export const updatePedidoSchema = z.object({
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  horario_evento: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endereco: z.string().min(1).max(500).optional(),
  endereco_completo: z.object({
    rua: z.string(),
    numero: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    estado: z.string().length(2),
    cep: z.string(),
    complemento: z.string(),
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  observacoes: z.string().max(1000).nullable().optional(),
  rampas_escadas: z.string().max(500).nullable().optional(),
  tipo_chopeira: z.enum(["gelo", "eletrica"]).optional(),
  frete: z.number().nonnegative().optional(),
  metodo_pagamento: z.enum(["pix", "cartao", "dinheiro"]).nullable().optional(),
  pago: z.boolean().optional(),
})

export type UpdatePedidoInput = z.infer<typeof updatePedidoSchema>
```

- [ ] **Step 3: Verify typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/lib/schemas.ts
git commit -m "feat(schemas): manualOrderInputSchema, updatePedidoSchema"
```

---

### Task 6: Server action — `revertOrderStatus`

**Files:**
- Modify: `app/lib/admin-actions.ts`
- Test: `app/lib/admin-actions.test.ts` (new file)

- [ ] **Step 1: Write failing tests**

Create `app/lib/admin-actions.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { canRevertToStatus, STATUS_FLOW_ORDER } from "./admin-actions"

describe("canRevertToStatus", () => {
  it("allows cancelado from any non-recolhido status", () => {
    expect(canRevertToStatus("confirmado", "cancelado")).toBe(true)
    expect(canRevertToStatus("em_rota", "cancelado")).toBe(true)
    expect(canRevertToStatus("recolhido", "cancelado")).toBe(false)
  })

  it("allows reverting to earlier status", () => {
    expect(canRevertToStatus("em_rota", "confirmado")).toBe(true)
    expect(canRevertToStatus("pago", "entregue")).toBe(true)
  })

  it("rejects forward moves", () => {
    expect(canRevertToStatus("confirmado", "em_rota")).toBe(false)
    expect(canRevertToStatus("entregue", "pago")).toBe(false)
  })

  it("rejects same status", () => {
    expect(canRevertToStatus("confirmado", "confirmado")).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && pnpm vitest run lib/admin-actions.test.ts`
Expected: FAIL — `canRevertToStatus is not exported`.

- [ ] **Step 3: Add `canRevertToStatus` and `revertOrderStatus` in admin-actions.ts**

Add near the top of `app/lib/admin-actions.ts`:

```ts
export const STATUS_FLOW_ORDER = [
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "pago",
  "recolhido",
] as const

export const canRevertToStatus = (current: string, target: string): boolean => {
  if (target === "cancelado") return current !== "recolhido"
  const currentIndex = STATUS_FLOW_ORDER.indexOf(current as never)
  const targetIndex = STATUS_FLOW_ORDER.indexOf(target as never)
  return currentIndex > 0 && targetIndex >= 0 && targetIndex < currentIndex
}

export const revertOrderStatus = async (pedidoId: string, newStatus: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (!canRevertToStatus(pedido.status, newStatus)) {
    throw new Error(`Nao pode voltar de ${pedido.status} para ${newStatus}`)
  }

  const { error: updateError } = await supabase
    .from("pedidos")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", pedidoId)

  if (updateError) throw updateError

  await supabase.from("pedido_status_log").insert({
    pedido_id: pedidoId,
    status_anterior: pedido.status,
    status_novo: newStatus,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && pnpm vitest run lib/admin-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions.ts app/lib/admin-actions.test.ts
git commit -m "feat(admin): revertOrderStatus with status-flow-aware validation"
```

---

### Task 7: UI — `RevertStatusModal` + button in order detail

**Files:**
- Create: `app/components/admin/revert-status-modal.tsx`
- Modify: `app/components/admin/status-actions.tsx` — add "Voltar status" button

- [ ] **Step 1: Create modal component**

Create `app/components/admin/revert-status-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import { revertOrderStatus, STATUS_FLOW_ORDER } from "@/lib/admin-actions"
import type { PedidoStatus } from "@/lib/types"

type Props = {
  pedidoId: string
  currentStatus: PedidoStatus
  onClose: () => void
}

const RevertStatusModal = ({ pedidoId, currentStatus, onClose }: Props) => {
  const [loading, setLoading] = useState(false)
  const currentIndex = STATUS_FLOW_ORDER.indexOf(currentStatus as never)
  const previousStatuses = STATUS_FLOW_ORDER.slice(0, currentIndex) as PedidoStatus[]
  const canCancel = currentStatus !== "recolhido" && currentStatus !== "cancelado"

  const handleRevert = async (target: PedidoStatus) => {
    if (!confirm(`Voltar de "${currentStatus}" para "${target}"?`)) return
    setLoading(true)
    try {
      await revertOrderStatus(pedidoId, target)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao voltar status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-zinc-900 rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-white">Voltar status</h2>
        <p className="text-zinc-400 mb-4">Status atual: <span className="font-semibold text-white">{currentStatus}</span></p>
        <div className="flex flex-col gap-2">
          {previousStatuses.map((status) => (
            <button
              key={status}
              disabled={loading}
              onClick={() => handleRevert(status)}
              className="text-left px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-white disabled:opacity-50"
            >
              Voltar para <span className="font-semibold">{status}</span>
            </button>
          ))}
          {canCancel && (
            <button
              disabled={loading}
              onClick={() => handleRevert("cancelado")}
              className="text-left px-4 py-2 rounded bg-red-900/50 hover:bg-red-900 text-white disabled:opacity-50"
            >
              Marcar como <span className="font-semibold">cancelado</span>
            </button>
          )}
        </div>
        <button onClick={onClose} className="mt-4 text-zinc-400 text-sm">Fechar</button>
      </div>
    </div>
  )
}

export default RevertStatusModal
```

- [ ] **Step 2: Wire button in `status-actions.tsx`**

Add a "Voltar status" button to the component, gated to non-`recolhido` and non-`cancelado` statuses where there is at least one previous status. Add state for showing `RevertStatusModal`.

Update `app/components/admin/status-actions.tsx`:

```tsx
import RevertStatusModal from "@/components/admin/revert-status-modal"

// inside component:
const [showRevert, setShowRevert] = useState(false)
const canShowRevertButton = currentStatus !== "cancelado" && currentStatus !== "confirmado"

// in JSX, alongside existing buttons:
{canShowRevertButton && (
  <button
    type="button"
    onClick={() => setShowRevert(true)}
    className="text-zinc-400 hover:text-white text-sm underline"
  >
    Voltar status
  </button>
)}
{showRevert && (
  <RevertStatusModal
    pedidoId={pedidoId}
    currentStatus={currentStatus}
    onClose={() => setShowRevert(false)}
  />
)}
```

- [ ] **Step 3: Manual verification**

Run: `cd app && pnpm dev`
Navigate to a pedido in `em_rota` status. Click "Voltar status" → modal shows confirm + previous statuses. Pick `confirmado` → status updates, page refreshes, log row inserted in `pedido_status_log`.

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/revert-status-modal.tsx app/components/admin/status-actions.tsx
git commit -m "feat(admin): RevertStatusModal + Voltar status button"
```

---

### Task 8: Document upload — accept 1-2 photos (cliente flow)

**Files:**
- Modify: `app/components/document-upload-section.tsx`
- Modify: `app/components/document-upload.tsx`
- Modify: `app/lib/actions.ts` — `uploadDocumentoPessoal`

- [ ] **Step 1: Update `document-upload.tsx` for multi-slot**

Read the current file: `app/components/document-upload.tsx`. Add a `slot` prop (`"primeiro" | "segundo"`) and a `disabled` prop. The component should call the parent's `onUpload(file, slot)` callback.

Key changes:
- Accept `existingUrl?: string | null` per slot
- Label changes based on slot: "Frente" / "Verso (opcional)"
- After upload, show preview thumbnail with "Remover" button

(Show full code in the implementation. The component already handles single upload; we extend it.)

- [ ] **Step 2: Update `document-upload-section.tsx`**

Render two slots side-by-side:

```tsx
<div>
  <h3 className="text-white font-semibold mb-2">Documento de identidade</h3>
  <p className="text-zinc-400 text-sm mb-3">
    Envie frente e verso. RG: 2 fotos. CNH: pode mandar so 1 foto aberta mostrando os dois lados.
  </p>
  <div className="grid grid-cols-2 gap-3">
    <DocumentUpload
      slot="primeiro"
      existingUrl={cliente.documento_pessoal_urls?.[0] ?? null}
      onUpload={(file) => uploadDocumentoPessoal(pedidoId, file, "primeiro")}
      onRemove={() => removeDocumentoPessoal(pedidoId, 0)}
    />
    <DocumentUpload
      slot="segundo"
      existingUrl={cliente.documento_pessoal_urls?.[1] ?? null}
      onUpload={(file) => uploadDocumentoPessoal(pedidoId, file, "segundo")}
      onRemove={() => removeDocumentoPessoal(pedidoId, 1)}
      disabled={!cliente.documento_pessoal_urls?.[0]}
    />
  </div>
</div>
```

- [ ] **Step 3: Update server action `uploadDocumentoPessoal`**

In `app/lib/actions.ts`, change to append/replace per slot:

```ts
export const uploadDocumentoPessoal = async (pedidoId: string, file: File, slot: "primeiro" | "segundo") => {
  // upload to storage (existing pattern)
  // const newUrl = ...

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("cliente_id, clientes(documento_pessoal_urls)")
    .eq("id", pedidoId)
    .single()

  const existing = pedido?.clientes?.documento_pessoal_urls ?? []
  const next = [...existing]
  const index = slot === "primeiro" ? 0 : 1
  next[index] = newUrl

  await supabase
    .from("clientes")
    .update({ documento_pessoal_urls: next.filter(Boolean) })
    .eq("id", pedido.cliente_id)

  // Update documento_status to "enviado" once at least one URL exists
  if (next.length > 0) {
    await supabase
      .from("pedidos")
      .update({ documento_status: "enviado" })
      .eq("id", pedidoId)
  }

  revalidatePath(`/pedido/${pedidoId}`)
}

export const removeDocumentoPessoal = async (pedidoId: string, urlIndex: number) => {
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("cliente_id, clientes(documento_pessoal_urls)")
    .eq("id", pedidoId)
    .single()

  const existing = pedido?.clientes?.documento_pessoal_urls ?? []
  const next = existing.filter((_, i) => i !== urlIndex)

  await supabase
    .from("clientes")
    .update({ documento_pessoal_urls: next.length > 0 ? next : null })
    .eq("id", pedido.cliente_id)

  if (next.length === 0) {
    await supabase
      .from("pedidos")
      .update({ documento_status: "pendente" })
      .eq("id", pedidoId)
  }

  revalidatePath(`/pedido/${pedidoId}`)
}
```

- [ ] **Step 4: Update admin viewer**

In `app/admin/(authenticated)/pedidos/[id]/page.tsx`, change single img to map:

```tsx
{cliente.documento_pessoal_urls?.map((url, i) => (
  <img key={i} src={await getSignedUrl(url)} alt={`Documento ${i + 1}`} className="..." />
))}
```

- [ ] **Step 5: Manual verification**

Use cliente flow: upload 1 photo → admin sees 1. Upload 2 photos → admin sees 2 side by side. Remove first → admin sees only second.

- [ ] **Step 6: Commit**

```bash
git add app/components/document-upload-section.tsx app/components/document-upload.tsx app/lib/actions.ts app/app/admin/(authenticated)/pedidos/[id]/page.tsx
git commit -m "feat(documents): identidade frente+verso (1-2 fotos)"
```

---

### Task 9: Server action — `revertDocumentoVerificacao`

**Files:**
- Modify: `app/lib/admin-actions.ts`

- [ ] **Step 1: Add `revertDocumentoVerificacao`**

```ts
export const revertDocumentoVerificacao = async (clienteId: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("documento_status", "verificado")

  await supabase
    .from("clientes")
    .update({
      documento_verificado: false,
      documento_verificado_em: null,
      documento_verificado_por: null,
    })
    .eq("id", clienteId)

  if (pedidos && pedidos.length > 0) {
    await supabase
      .from("pedidos")
      .update({ documento_status: "enviado" })
      .in("id", pedidos.map((p) => p.id))

    await supabase.from("pedido_edit_log").insert(
      pedidos.map((p) => ({
        pedido_id: p.id,
        field: "documento_status",
        old_value: "verificado",
        new_value: "enviado",
        changed_by: user.id,
      })),
    )
  }

  revalidatePath("/admin")
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): revertDocumentoVerificacao"
```

---

### Task 10: UI — "Revisar de novo" button in order detail

**Files:**
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` (or wherever the doc-verified banner lives)

- [ ] **Step 1: Locate the "Verificado em ... por ..." block**

Grep: `cd app && grep -rn "documento_verificado_em" --include="*.tsx"`

- [ ] **Step 2: Add button next to "Verificado em ..."**

```tsx
import { revertDocumentoVerificacao } from "@/lib/admin-actions"

// near the verificado text:
<form action={revertDocumentoVerificacao.bind(null, cliente.id)}>
  <button
    type="submit"
    className="text-xs text-yellow-400 underline ml-2"
    onClick={(e) => {
      if (!confirm("Desfazer verificacao do documento? Sera necessario verificar novamente antes de avancar.")) {
        e.preventDefault()
      }
    }}
  >
    Revisar de novo
  </button>
</form>
```

- [ ] **Step 3: Manual verification**

Verify a cliente → click "Revisar de novo" → confirm → status reverts to `enviado`, button to verify reappears, edit log row inserted.

- [ ] **Step 4: Commit**

```bash
git add app/app/admin/(authenticated)/pedidos/[id]/page.tsx
git commit -m "feat(admin): Revisar de novo button to undo doc verification"
```

---

### Task 11: Server action — `createManualOrder`

**Files:**
- Modify: `app/lib/admin-actions.ts`

- [ ] **Step 1: Add `createManualOrder`**

```ts
import { manualOrderInputSchema, type ManualOrderInput } from "@/lib/schemas"
import { calculateOrderTotals } from "@/lib/pricing"

export const createManualOrder = async (input: ManualOrderInput) => {
  const parsed = manualOrderInputSchema.parse(input)
  const { supabase, user } = await requireAdmin()

  // 1. Resolve cliente (existing or new)
  let clienteId: string
  if ("id" in parsed.cliente) {
    clienteId = parsed.cliente.id
  } else {
    const { data: newCliente, error: cliErr } = await supabase
      .from("clientes")
      .insert({
        nome: parsed.cliente.nome,
        telefone: parsed.cliente.telefone,
        cpf: parsed.cliente.cpf ?? null,
        email: parsed.cliente.email ?? null,
      })
      .select("id")
      .single()
    if (cliErr || !newCliente) throw new Error(`Erro ao criar cliente: ${cliErr?.message}`)
    clienteId = newCliente.id
  }

  // 2. Fetch product prices for total calculation
  const productIds = parsed.items.map((i) => i.produto_id)
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, preco_avista, preco_cartao, preco_segundo_barril")
    .in("id", productIds)

  // 3. Build pedido_items rows, splitting consignado as separate row of qty=1
  type ItemRow = {
    produto_id: string
    quantidade: number
    preco_unitario: number
    subtotal: number
    is_consignado: boolean
    consignado_status: "pendente" | null
  }

  const itemRows: ItemRow[] = []
  for (const input of parsed.items) {
    const produto = produtos?.find((p) => p.id === input.produto_id)
    if (!produto) throw new Error(`Produto nao encontrado: ${input.produto_id}`)
    const firstUnitPrice = parsed.metodo_pagamento === "cartao" && produto.preco_cartao
      ? produto.preco_cartao
      : produto.preco_avista
    const secondUnitPrice = produto.preco_segundo_barril ?? firstUnitPrice

    if (input.is_consignado) {
      if (input.quantidade !== 2) throw new Error("Consignado exige quantidade = 2")
      itemRows.push({
        produto_id: input.produto_id,
        quantidade: 1,
        preco_unitario: firstUnitPrice,
        subtotal: firstUnitPrice,
        is_consignado: false,
        consignado_status: null,
      })
      itemRows.push({
        produto_id: input.produto_id,
        quantidade: 1,
        preco_unitario: secondUnitPrice,
        subtotal: secondUnitPrice,
        is_consignado: true,
        consignado_status: "pendente",
      })
    } else {
      const qty = input.quantidade
      const subtotal = qty === 1 ? firstUnitPrice : firstUnitPrice + secondUnitPrice * (qty - 1)
      itemRows.push({
        produto_id: input.produto_id,
        quantidade: qty,
        preco_unitario: firstUnitPrice,
        subtotal,
        is_consignado: false,
        consignado_status: null,
      })
    }
  }

  // 4. Calculate totals
  const totals = calculateOrderTotals(
    itemRows.map((r) => ({
      subtotal: r.subtotal,
      is_consignado: r.is_consignado,
      consignado_status: r.consignado_status,
    })),
  )
  const subtotal = totals.subtotalMin
  const total = subtotal + parsed.frete

  // 5. Insert pedido
  const { data: pedido, error: pedErr } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      status: "confirmado",
      documento_status: "pendente",
      endereco: parsed.endereco,
      endereco_completo: parsed.endereco_completo,
      data_evento: parsed.data_evento,
      horario_evento: parsed.horario_evento,
      tipo_chopeira: parsed.tipo_chopeira,
      rampas_escadas: parsed.rampas_escadas,
      observacoes: parsed.observacoes,
      subtotal,
      desconto: 0,
      frete: parsed.frete,
      total,
      metodo_pagamento: parsed.metodo_pagamento,
      pago: parsed.pago,
    })
    .select("id")
    .single()
  if (pedErr || !pedido) throw new Error(`Erro ao criar pedido: ${pedErr?.message}`)

  // 6. Insert items
  const { error: itemsErr } = await supabase
    .from("pedido_items")
    .insert(itemRows.map((r) => ({ ...r, pedido_id: pedido.id })))
  if (itemsErr) throw new Error(`Erro ao inserir items: ${itemsErr.message}`)

  // 7. Status log
  await supabase.from("pedido_status_log").insert({
    pedido_id: pedido.id,
    status_anterior: null,
    status_novo: "confirmado",
    changed_by: user.id,
  })

  revalidatePath("/admin")
  return pedido.id
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): createManualOrder server action with consignado"
```

---

### Task 12: Server action — `searchClientes` for manual order drawer

**Files:**
- Modify: `app/lib/queries.ts`

- [ ] **Step 1: Add `searchClientes` (server-side)**

```ts
"use server"

export const searchClientes = async (query: string) => {
  if (query.length < 2) return []
  const supabase = await createClient()
  const sanitized = query.replace(/\D/g, "")
  const { data } = await supabase
    .from("clientes")
    .select("id, nome, telefone, cpf, email")
    .or(`telefone.ilike.%${sanitized}%,cpf.ilike.%${sanitized}%,nome.ilike.%${query}%`)
    .limit(8)
  return data ?? []
}
```

Note: `"use server"` must be at top of file. If file already has it, just add the function. If not, separate file or convert; keep current pattern.

- [ ] **Step 2: Commit**

```bash
git add app/lib/queries.ts
git commit -m "feat(queries): searchClientes for manual order drawer"
```

---

### Task 13: UI — `ManualOrderDrawer` component

**Files:**
- Create: `app/components/admin/manual-order-drawer.tsx`
- Modify: `app/app/admin/(authenticated)/page.tsx` — add trigger button

- [ ] **Step 1: Create the drawer**

Create `app/components/admin/manual-order-drawer.tsx`. The component is a controlled drawer (open/onClose) with sections for cliente, endereco, evento, itens, pagamento. State is managed locally with a single form object; on submit it calls `createManualOrder`.

Structure to extend (use existing components like `AddressAutocomplete`, follow Tailwind patterns from other admin components):

```tsx
"use client"

import { useState, useEffect } from "react"
import { createManualOrder } from "@/lib/admin-actions"
import { searchClientes } from "@/lib/queries"
import AddressAutocomplete from "@/components/address-autocomplete"
import type { ManualOrderInput } from "@/lib/schemas"
import type { Produto } from "@/lib/types"

type Props = {
  open: boolean
  onClose: () => void
  produtos: Produto[]
}

const ManualOrderDrawer = ({ open, onClose, produtos }: Props) => {
  const [clienteQuery, setClienteQuery] = useState("")
  const [clienteResults, setClienteResults] = useState<{ id: string; nome: string; telefone: string }[]>([])
  const [selectedCliente, setSelectedCliente] = useState<{ id: string } | null>(null)
  const [newCliente, setNewCliente] = useState({ nome: "", telefone: "", cpf: "", email: "" })
  // ... endereco, items, pagamento, frete states

  useEffect(() => {
    if (clienteQuery.length < 2) {
      setClienteResults([])
      return
    }
    const id = setTimeout(async () => {
      const results = await searchClientes(clienteQuery)
      setClienteResults(results)
    }, 300)
    return () => clearTimeout(id)
  }, [clienteQuery])

  const handleSubmit = async () => {
    const cliente = selectedCliente ?? newCliente
    const input: ManualOrderInput = {
      cliente,
      endereco: addressString,
      endereco_completo: enderecoCompleto,
      data_evento: dataEvento,
      horario_evento: horarioEvento,
      tipo_chopeira: tipoChopeira,
      rampas_escadas: rampasEscadas || null,
      observacoes: observacoes || null,
      items,
      metodo_pagamento: metodoPagamento,
      pago,
      frete,
    }
    try {
      await createManualOrder(input)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar pedido")
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-zinc-900 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {/* Sections: cliente, endereco, evento, itens, pagamento, frete, resumo, acoes */}
      </div>
    </div>
  )
}

export default ManualOrderDrawer
```

Implementation details for items section:

```tsx
{items.map((item, idx) => {
  const produto = produtos.find((p) => p.id === item.produto_id)
  const hasSegundoBarril = produto?.preco_segundo_barril != null
  const canConsignar = item.quantidade === 2 && hasSegundoBarril
  const hasOtherConsignado = items.some((i, j) => j !== idx && i.is_consignado)

  return (
    <div key={idx} className="flex flex-col gap-2 border-zinc-700 border rounded p-3">
      <select value={item.produto_id} onChange={(e) => updateItem(idx, { produto_id: e.target.value })}>
        {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
      </select>
      <input type="number" min={1} value={item.quantidade} onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })} />
      {canConsignar && (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            disabled={hasOtherConsignado && !item.is_consignado}
            checked={item.is_consignado}
            onChange={(e) => updateItem(idx, { is_consignado: e.target.checked })}
          />
          Marcar 2º barril como consignado
          <span className="text-xs text-zinc-400" title="So paga se usar. Mostra preco do 1º / 2º com desconto.">?</span>
        </label>
      )}
    </div>
  )
})}
```

- [ ] **Step 2: Add trigger button in `/admin` page**

Modify `app/app/admin/(authenticated)/page.tsx`:

```tsx
"use client"
// (page already is, or move to client-managed wrapper)

import { useState } from "react"
import ManualOrderDrawer from "@/components/admin/manual-order-drawer"

// ...
const [drawerOpen, setDrawerOpen] = useState(false)

// in render, top of orders list:
<button onClick={() => setDrawerOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded font-semibold">
  + Novo pedido manual
</button>

<ManualOrderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} produtos={produtos} />
```

(If `page.tsx` is server-component, extract the orders list into a client component and add the trigger there.)

- [ ] **Step 3: Manual verification**

1. Open `/admin`, click "Novo pedido manual"
2. Search existing cliente by telefone → select → form fills
3. Switch to "Criar novo cliente" → fill nome+telefone
4. Pick endereco via autocomplete
5. Add item: produto + quantidade=2 → consignado checkbox appears
6. Mark consignado on one item; verify checkbox locked on others
7. Submit → drawer closes, new pedido visible in list with consignado banner

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/manual-order-drawer.tsx app/app/admin/(authenticated)/page.tsx
git commit -m "feat(admin): ManualOrderDrawer + Novo pedido manual button"
```

---

### Task 14: Server action — `settleConsignado` + total recalc

**Files:**
- Modify: `app/lib/admin-actions.ts`

- [ ] **Step 1: Add `settleConsignado`**

```ts
export const settleConsignado = async (pedidoItemId: string, status: "usado" | "devolvido") => {
  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_items")
    .select("id, pedido_id, is_consignado, consignado_status")
    .eq("id", pedidoItemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  if (!item.is_consignado) throw new Error("Item nao eh consignado")
  if (item.consignado_status !== "pendente") throw new Error("Item ja foi settled")

  const oldStatus = item.consignado_status
  await supabase
    .from("pedido_items")
    .update({ consignado_status: status })
    .eq("id", pedidoItemId)

  // Recalculate pedido totals
  const { data: allItems } = await supabase
    .from("pedido_items")
    .select("subtotal, is_consignado, consignado_status")
    .eq("pedido_id", item.pedido_id)

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("frete, desconto")
    .eq("id", item.pedido_id)
    .single()

  const totals = calculateOrderTotals(allItems ?? [])
  const newSubtotal = totals.subtotalMin
  const newTotal = newSubtotal - (pedido?.desconto ?? 0) + (pedido?.frete ?? 0)

  await supabase
    .from("pedidos")
    .update({ subtotal: newSubtotal, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: `pedido_items.${pedidoItemId}.consignado_status`,
    old_value: oldStatus,
    new_value: status,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
  revalidatePath("/admin")
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): settleConsignado action with total recalc"
```

---

### Task 15: UI — `ConsignadoBanner` in order detail

**Files:**
- Create: `app/components/admin/consignado-banner.tsx`
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`

- [ ] **Step 1: Create banner**

```tsx
"use client"

import { useState } from "react"
import { settleConsignado } from "@/lib/admin-actions"
import type { PedidoItem, Produto } from "@/lib/types"

type Props = {
  item: PedidoItem
  produto: Produto
}

const ConsignadoBanner = ({ item, produto }: Props) => {
  const [loading, setLoading] = useState(false)

  const handleSettle = async (status: "usado" | "devolvido") => {
    if (!confirm(`Marcar consignado como ${status}?`)) return
    setLoading(true)
    try {
      await settleConsignado(item.id, status)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 flex flex-col gap-3 my-3">
      <div>
        <p className="text-yellow-400 font-semibold">Consignado pendente</p>
        <p className="text-zinc-300 text-sm">
          {produto.marca} {produto.volume_litros}L — R$ {item.subtotal.toFixed(2)} pendente de settlement
        </p>
      </div>
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => handleSettle("usado")}
          className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
        >
          Marcar como usado
        </button>
        <button
          disabled={loading}
          onClick={() => handleSettle("devolvido")}
          className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
        >
          Marcar como devolvido
        </button>
      </div>
    </div>
  )
}

export default ConsignadoBanner
```

- [ ] **Step 2: Wire into order detail**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, after fetching pedido items + produtos:

```tsx
import ConsignadoBanner from "@/components/admin/consignado-banner"

// in render, near order summary:
{items
  .filter((i) => i.is_consignado && i.consignado_status === "pendente")
  .map((item) => {
    const produto = produtos.find((p) => p.id === item.produto_id)!
    return <ConsignadoBanner key={item.id} item={item} produto={produto} />
  })}
```

- [ ] **Step 3: Update total display**

In the same page, where total is rendered, compute and show min/max:

```tsx
import { calculateOrderTotals } from "@/lib/pricing"

const totals = calculateOrderTotals(items)
const totalMin = totals.subtotalMin - pedido.desconto + pedido.frete
const totalMax = totals.subtotalMax - pedido.desconto + pedido.frete

// in render:
{totals.hasPendente ? (
  <span title="minimo / maximo com consignado">
    R$ {totalMin.toFixed(2)} / R$ {totalMax.toFixed(2)}
  </span>
) : (
  <span>R$ {pedido.total.toFixed(2)}</span>
)}
```

- [ ] **Step 4: Manual verification**

Create a pedido with consignado → open detail → banner shows. Click "Marcar como usado" → total updates, banner disappears. Repeat with "devolvido" → total stays minimum.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/consignado-banner.tsx app/app/admin/(authenticated)/pedidos/[id]/page.tsx
git commit -m "feat(admin): ConsignadoBanner with settle buttons + total min/max"
```

---

### Task 16: Server action — `updatePedido` + items mutations

**Files:**
- Modify: `app/lib/admin-actions.ts`

- [ ] **Step 1: Add `LOCKED_STATUSES` and `updatePedido`**

```ts
import { updatePedidoSchema, type UpdatePedidoInput } from "@/lib/schemas"

const LOCKED_STATUSES = ["entregue", "pago", "recolhido", "cancelado"]

export const updatePedido = async (pedidoId: string, input: UpdatePedidoInput) => {
  const parsed = updatePedidoSchema.parse(input)
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_STATUSES.includes(pedido.status)) {
    throw new Error(`Pedido em status ${pedido.status} nao pode ser editado`)
  }

  const diffs: { field: string; old_value: unknown; new_value: unknown }[] = []
  const updates: Record<string, unknown> = {}

  for (const [key, newValue] of Object.entries(parsed)) {
    if (newValue === undefined) continue
    const oldValue = (pedido as Record<string, unknown>)[key]
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
    updates[key] = newValue
    diffs.push({ field: key, old_value: oldValue, new_value: newValue })
  }

  if (Object.keys(updates).length === 0) return

  // If frete changed, recompute total
  if ("frete" in updates) {
    updates.total = (pedido.subtotal ?? 0) - (pedido.desconto ?? 0) + (updates.frete as number)
  }

  updates.updated_at = new Date().toISOString()
  await supabase.from("pedidos").update(updates).eq("id", pedidoId)

  await supabase
    .from("pedido_edit_log")
    .insert(diffs.map((d) => ({ ...d, pedido_id: pedidoId, changed_by: user.id })))

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin")
}
```

- [ ] **Step 2: Add item mutation actions**

```ts
export const addPedidoItem = async (pedidoId: string, produtoId: string, quantidade: number, isConsignado: boolean) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status, subtotal, desconto, frete")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_STATUSES.includes(pedido.status)) throw new Error("Pedido travado")

  // Check 1-consignado constraint
  if (isConsignado) {
    const { count } = await supabase
      .from("pedido_items")
      .select("id", { count: "exact", head: true })
      .eq("pedido_id", pedidoId)
      .eq("is_consignado", true)
    if ((count ?? 0) > 0) throw new Error("Pedido ja tem 1 item consignado")
  }

  const { data: produto } = await supabase
    .from("produtos")
    .select("preco_avista, preco_segundo_barril")
    .eq("id", produtoId)
    .single()
  if (!produto) throw new Error("Produto nao encontrado")

  const preco = isConsignado
    ? produto.preco_segundo_barril ?? produto.preco_avista
    : produto.preco_avista

  await supabase.from("pedido_items").insert({
    pedido_id: pedidoId,
    produto_id: produtoId,
    quantidade: isConsignado ? 1 : quantidade,
    preco_unitario: preco,
    subtotal: preco * (isConsignado ? 1 : quantidade),
    is_consignado: isConsignado,
    consignado_status: isConsignado ? "pendente" : null,
  })

  await recalcPedidoTotals(supabase, pedidoId)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: pedidoId,
    field: "items.added",
    old_value: null,
    new_value: { produto_id: produtoId, quantidade, is_consignado: isConsignado },
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

export const removePedidoItem = async (itemId: string) => {
  const { supabase, user } = await requireAdmin()
  const { data: item } = await supabase
    .from("pedido_items")
    .select("*, pedidos!inner(status)")
    .eq("id", itemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  if (LOCKED_STATUSES.includes((item.pedidos as { status: string }).status)) {
    throw new Error("Pedido travado")
  }

  await supabase.from("pedido_items").delete().eq("id", itemId)
  await recalcPedidoTotals(supabase, item.pedido_id)
  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "items.removed",
    old_value: { id: itemId, produto_id: item.produto_id, quantidade: item.quantidade },
    new_value: null,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
}

const recalcPedidoTotals = async (supabase: ReturnType<typeof createServiceClient>, pedidoId: string) => {
  const { data: items } = await supabase
    .from("pedido_items")
    .select("subtotal, is_consignado, consignado_status")
    .eq("pedido_id", pedidoId)
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("frete, desconto")
    .eq("id", pedidoId)
    .single()
  const totals = calculateOrderTotals(items ?? [])
  const newSubtotal = totals.subtotalMin
  const newTotal = newSubtotal - (pedido?.desconto ?? 0) + (pedido?.frete ?? 0)
  await supabase.from("pedidos").update({ subtotal: newSubtotal, total: newTotal }).eq("id", pedidoId)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): updatePedido + item mutations with edit log"
```

---

### Task 17: UI — `EditOrderDrawer` + button on order detail

**Files:**
- Create: `app/components/admin/edit-order-drawer.tsx`
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`

- [ ] **Step 1: Create the drawer**

Modeled on `ManualOrderDrawer` but pre-filled with current pedido data and submitting to `updatePedido`. Includes item add/remove using `addPedidoItem` and `removePedidoItem`. Disables save when pedido status is locked (defensive — button itself is hidden in locked cases, but defense in depth).

Structure (sketch):

```tsx
"use client"

import { useState } from "react"
import { updatePedido, addPedidoItem, removePedidoItem } from "@/lib/admin-actions"
import AddressAutocomplete from "@/components/address-autocomplete"
import type { Pedido, PedidoItem, Produto } from "@/lib/types"

type Props = {
  open: boolean
  onClose: () => void
  pedido: Pedido
  items: PedidoItem[]
  produtos: Produto[]
}

const EditOrderDrawer = ({ open, onClose, pedido, items, produtos }: Props) => {
  const [dataEvento, setDataEvento] = useState(pedido.data_evento)
  const [horarioEvento, setHorarioEvento] = useState(pedido.horario_evento)
  const [endereco, setEndereco] = useState(pedido.endereco)
  // ...other fields

  const handleSave = async () => {
    try {
      await updatePedido(pedido.id, {
        data_evento: dataEvento,
        horario_evento: horarioEvento,
        endereco,
        // ...
      })
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro")
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-zinc-900 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {/* Edit form fields */}
        <button onClick={handleSave} className="bg-amber-500 text-black px-4 py-2 rounded">Salvar alteracoes</button>
      </div>
    </div>
  )
}

export default EditOrderDrawer
```

- [ ] **Step 2: Wire trigger button in order detail page**

```tsx
"use client"

// (or extract to a client wrapper)
import { useState } from "react"
import EditOrderDrawer from "@/components/admin/edit-order-drawer"

const LOCKED = ["entregue", "pago", "recolhido", "cancelado"]

// in render:
{!LOCKED.includes(pedido.status) && (
  <button onClick={() => setEditOpen(true)} className="text-sm underline text-zinc-300">
    Editar pedido
  </button>
)}
{editOpen && <EditOrderDrawer pedido={pedido} items={items} produtos={produtos} open={editOpen} onClose={() => setEditOpen(false)} />}
```

- [ ] **Step 3: Manual verification**

Open pedido in `em_rota` → click Editar → change horario from 14:00 to 12:00 → save → close. Reopen — new value persisted. Open pedido in `entregue` → no Editar button visible.

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/edit-order-drawer.tsx app/app/admin/(authenticated)/pedidos/[id]/page.tsx
git commit -m "feat(admin): EditOrderDrawer with field-level diff log"
```

---

### Task 18: UI — Edit log section on order detail

**Files:**
- Create: `app/components/admin/edit-log.tsx`
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`

- [ ] **Step 1: Query the log**

In the page component, fetch the last 10 entries:

```tsx
const { data: editLog } = await supabase
  .from("pedido_edit_log")
  .select("*")
  .eq("pedido_id", pedido.id)
  .order("changed_at", { ascending: false })
  .limit(10)
```

- [ ] **Step 2: Create `EditLog` component**

```tsx
import type { PedidoEditLog } from "@/lib/types"

type Props = { entries: PedidoEditLog[] }

const EditLog = ({ entries }: Props) => {
  if (entries.length === 0) return null
  return (
    <details className="bg-zinc-800/50 rounded p-3 mt-4">
      <summary className="text-sm text-zinc-300 cursor-pointer">Historico de edicoes ({entries.length})</summary>
      <ul className="mt-2 space-y-1 text-xs text-zinc-400">
        {entries.map((e) => (
          <li key={e.id}>
            <span className="text-zinc-500">{new Date(e.changed_at).toLocaleString("pt-BR")}</span>
            {" — "}
            <span className="text-zinc-200">{e.field}</span>
            {" "}
            <span className="text-zinc-500">de</span>{" "}
            <code className="text-amber-400">{JSON.stringify(e.old_value)}</code>
            {" "}<span className="text-zinc-500">para</span>{" "}
            <code className="text-green-400">{JSON.stringify(e.new_value)}</code>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default EditLog
```

- [ ] **Step 3: Render in page**

```tsx
import EditLog from "@/components/admin/edit-log"
// at bottom of page:
<EditLog entries={editLog ?? []} />
```

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/edit-log.tsx app/app/admin/(authenticated)/pedidos/[id]/page.tsx
git commit -m "feat(admin): EditLog section on order detail"
```

---

### Task 19: Manual E2E tests

**Files:**
- Modify: `docs/superpowers/specs/2026-05-13-admin-operacional-design.md` — mark E2E checklist progress

- [ ] **Step 1: Run dev server**

Run: `cd app && pnpm dev`

- [ ] **Step 2: Execute scenarios**

Walk through each scenario in spec section "Integration / E2E (Playwright manual)":

1. Cliente novo via modal manual
2. Cliente existente por telefone via modal manual
3. Pedido manual com consignado (qty=2) → total `min/max`
4. Marcar consignado como usado → total ajusta
5. Marcar consignado como devolvido → total mantem minimo
6. Voltar status `em_rota → confirmado` → status_log gravado
7. Cliente sobe 1 foto identidade → admin ve 1
8. Cliente sobe 2 fotos → admin ve 2 lado a lado
9. Admin verifica doc → desverifica → documento_status volta para `enviado`
10. Admin edita horario em pedido `em_rota` → edit_log gravado
11. Admin abre pedido `entregue` → botao "Editar pedido" oculto

Note any failures, fix, re-run.

- [ ] **Step 3: Commit any fixes**

```bash
git add app/
git commit -m "fix(admin): adjustments from manual E2E"
```

---

### Task 20: Final typecheck + build

**Files:** none

- [ ] **Step 1: Typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS, no errors.

- [ ] **Step 2: Build**

Run: `cd app && pnpm build`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `cd app && pnpm vitest run`
Expected: PASS.

- [ ] **Step 4: Commit (only if there are fixes)**

```bash
git add app/
git commit -m "chore: final typecheck/build/test pass"
```

---

## Summary

20 tasks delivering 6 features driven by Jean's WhatsApp feedback:

- T1: migration 020 (schema)
- T2-T3: type updates + reference fix
- T4: pricing with consignado
- T5: schemas
- T6-T7: revert status (action + UI)
- T8: identidade frente+verso
- T9-T10: desverificar doc
- T11-T13: manual order (action + search + drawer)
- T14-T15: consignado settle + banner
- T16-T18: edit pedido (action + drawer + log UI)
- T19-T20: E2E + final checks
