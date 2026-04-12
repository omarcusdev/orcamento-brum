# Fase 4 — Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `aguardando_documentos` as a blocking status (docs become parallel reminders), limit checkout to 2 orders per hour slot, and add chopeira type tooltips.

**Architecture:** Three independent changes touching the DB constraint, server actions, and checkout UI. Migration removes the status and updates existing records. Server action gains a slot-count query before insert. Checkout form fetches booked slots and shows descriptions per chopeira type.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), React 19, Tailwind CSS v4, Framer Motion

**Spec:** `docs/superpowers/specs/2026-04-12-fase4-adjustments-design.md`

---

### Task 1: Migration — remove `aguardando_documentos` status

**Files:**
- Create: `supabase/migrations/013_remove_aguardando_documentos.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migrate existing orders
UPDATE pedidos SET status = 'confirmado' WHERE status = 'aguardando_documentos';

-- Update status log references
UPDATE pedido_status_log SET status_anterior = 'confirmado' WHERE status_anterior = 'aguardando_documentos';
UPDATE pedido_status_log SET status_novo = 'confirmado' WHERE status_novo = 'aguardando_documentos';

-- Replace constraint without aguardando_documentos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN (
  'confirmado', 'enviar_para_entregador', 'em_rota', 'entregue',
  'pago', 'recolhido', 'cancelado'
));
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `cd supabase && npx supabase db push`

Verify: `npx supabase db lint` — no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_remove_aguardando_documentos.sql
git commit -m "migrate: remove aguardando_documentos status from pedidos"
```

---

### Task 2: Update TypeScript types and status config

**Files:**
- Modify: `app/lib/types.ts:30-38` — remove `aguardando_documentos` from `PedidoStatus`
- Modify: `app/components/order-status-badge.tsx:4` — remove entry from `statusConfig`

- [ ] **Step 1: Update PedidoStatus type**

In `app/lib/types.ts`, change the `PedidoStatus` type from:

```typescript
export type PedidoStatus =
  | "aguardando_documentos"
  | "confirmado"
  | "enviar_para_entregador"
  | "em_rota"
  | "entregue"
  | "pago"
  | "recolhido"
  | "cancelado"
```

To:

```typescript
export type PedidoStatus =
  | "confirmado"
  | "enviar_para_entregador"
  | "em_rota"
  | "entregue"
  | "pago"
  | "recolhido"
  | "cancelado"
```

- [ ] **Step 2: Update statusConfig**

In `app/components/order-status-badge.tsx`, remove the `aguardando_documentos` entry from `statusConfig`:

```typescript
const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  confirmado: { label: "Confirmado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  enviar_para_entregador: { label: "Enviar p/ Entregador", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  em_rota: { label: "Em Rota", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  entregue: { label: "Entregue", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  recolhido: { label: "Recolhido", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: no errors (if any reference to `aguardando_documentos` remains, the compiler will catch it).

- [ ] **Step 4: Commit**

```bash
git add app/lib/types.ts app/components/order-status-badge.tsx
git commit -m "refactor: remove aguardando_documentos from PedidoStatus and statusConfig"
```

---

### Task 3: Update admin status filter

**Files:**
- Modify: `app/components/admin/status-filter.tsx:13-15` — remove `aguardando_documentos` from `allStatuses`

- [ ] **Step 1: Update allStatuses array**

In `app/components/admin/status-filter.tsx`, change:

```typescript
const allStatuses: (PedidoStatus | "todos")[] = [
  "todos", "aguardando_documentos", "confirmado", "enviar_para_entregador", "em_rota", "entregue", "pago", "recolhido", "cancelado"
]
```

To:

```typescript
const allStatuses: (PedidoStatus | "todos")[] = [
  "todos", "confirmado", "enviar_para_entregador", "em_rota", "entregue", "pago", "recolhido", "cancelado"
]
```

- [ ] **Step 2: Commit**

```bash
git add app/components/admin/status-filter.tsx
git commit -m "refactor: remove aguardando_documentos from admin status filter"
```

---

### Task 4: Update server actions — remove doc-blocking logic

**Files:**
- Modify: `app/lib/admin-actions.ts:8-16` — remove `aguardando_documentos` from `statusOrder`
- Modify: `app/lib/admin-actions.ts:40-42` — remove doc-verification guard
- Modify: `app/lib/actions.ts:109-127` — order always starts as `confirmado`

- [ ] **Step 1: Update statusOrder in admin-actions.ts**

In `app/lib/admin-actions.ts`, change `statusOrder` from:

```typescript
const statusOrder = [
  "aguardando_documentos",
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "pago",
  "recolhido",
] as const
```

To:

```typescript
const statusOrder = [
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "pago",
  "recolhido",
] as const
```

- [ ] **Step 2: Remove doc-verification guard in advanceOrderStatus**

In `app/lib/admin-actions.ts`, remove these lines from `advanceOrderStatus`:

```typescript
  if (pedido.documento_status !== "verificado") {
    throw new Error("Documentos precisam ser verificados antes de avancar o pedido")
  }
```

- [ ] **Step 3: Update createOrder to always start as confirmado**

In `app/lib/actions.ts`, change the pedido insert (lines 109-127) from:

```typescript
  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      endereco: enderecoDisplay,
      endereco_completo: enderecoCompleto,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      observacoes: data.observacoes || null,
      tipo_chopeira: data.tipo_chopeira,
      rampas_escadas: data.rampas_escadas || null,
      metodo_pagamento: data.metodo_pagamento,
      subtotal,
      total: subtotal,
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
        status: "confirmado",
      }),
    })
    .select("id")
    .single()
```

To:

```typescript
  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      endereco: enderecoDisplay,
      endereco_completo: enderecoCompleto,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      observacoes: data.observacoes || null,
      tipo_chopeira: data.tipo_chopeira,
      rampas_escadas: data.rampas_escadas || null,
      metodo_pagamento: data.metodo_pagamento,
      subtotal,
      total: subtotal,
      status: "confirmado",
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
      }),
    })
    .select("id")
    .single()
```

Also remove the `docsAlreadyVerified` variable (line 60) since it's only used for the spread — but keep it because it still controls `documento_status`.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions.ts app/lib/actions.ts
git commit -m "feat: remove doc-blocking gates — orders always start as confirmado"
```

---

### Task 5: Update status-actions — doc warning banner + confirm on dispatch

**Files:**
- Modify: `app/components/admin/status-actions.tsx` — remove doc block, add warning banner + confirm dialog

- [ ] **Step 1: Update StatusActions component**

Replace the full content of `app/components/admin/status-actions.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"
import { advanceOrderStatus, cancelOrder } from "@/lib/admin-actions"
import DispatchModal from "@/components/admin/dispatch-modal"

type StatusActionsProps = {
  pedidoId: string
  currentStatus: PedidoStatus
  documentoStatus: string
  frete: number
  dispatchText?: string
}

const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  confirmado: "enviar_para_entregador",
  enviar_para_entregador: "em_rota",
  em_rota: "entregue",
  entregue: "pago",
  pago: "recolhido",
}

const StatusActions = ({ pedidoId, currentStatus, documentoStatus, frete, dispatchText }: StatusActionsProps) => {
  const [loading, setLoading] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)

  const nextStatus = nextStatusMap[currentStatus]
  const docsVerified = documentoStatus === "verificado"

  const handleAdvance = async () => {
    if (currentStatus === "confirmado") {
      setShowDispatch(true)
      return
    }
    if (frete === 0 && !confirm("Frete nao definido. Deseja continuar sem frete?")) return
    setLoading(true)
    await advanceOrderStatus(pedidoId, currentStatus)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return
    setLoading(true)
    await cancelOrder(pedidoId)
    setLoading(false)
  }

  if (currentStatus === "recolhido" || currentStatus === "cancelado") return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-brand-warm-gray">Status atual:</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${statusConfig[currentStatus].color}`}>
          {statusConfig[currentStatus].label}
        </span>
      </div>

      {!docsVerified && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <span className="text-yellow-400 text-sm">Documentacao pendente de verificacao</span>
        </div>
      )}

      {nextStatus && (
        <motion.button
          onClick={handleAdvance}
          disabled={loading}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
        >
          {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
        </motion.button>
      )}
      <motion.button
        onClick={handleCancel}
        disabled={loading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full border border-red-500/30 text-red-400 font-medium py-3 rounded-lg hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50"
      >
        Cancelar Pedido
      </motion.button>

      {showDispatch && dispatchText && (
        <DispatchModal
          pedidoId={pedidoId}
          dispatchText={dispatchText}
          frete={frete}
          documentoStatus={documentoStatus}
          onClose={() => setShowDispatch(false)}
        />
      )}
    </div>
  )
}

export default StatusActions
```

- [ ] **Step 2: Commit**

```bash
git add app/components/admin/status-actions.tsx
git commit -m "feat: replace doc-blocking with warning banner in status actions"
```

---

### Task 6: Add doc-check confirm to dispatch modal

**Files:**
- Modify: `app/components/admin/dispatch-modal.tsx` — accept `documentoStatus` prop, show confirm if docs pending

- [ ] **Step 1: Update DispatchModal props and confirm logic**

In `app/components/admin/dispatch-modal.tsx`, update the type and component:

Change the type from:

```typescript
type DispatchModalProps = {
  pedidoId: string
  dispatchText: string
  frete: number
  onClose: () => void
}
```

To:

```typescript
type DispatchModalProps = {
  pedidoId: string
  dispatchText: string
  frete: number
  documentoStatus: string
  onClose: () => void
}
```

Update the component signature from:

```typescript
const DispatchModal = ({ pedidoId, dispatchText, frete, onClose }: DispatchModalProps) => {
```

To:

```typescript
const DispatchModal = ({ pedidoId, dispatchText, frete, documentoStatus, onClose }: DispatchModalProps) => {
```

In `handleConfirm`, add the docs check before the frete check. Change:

```typescript
  const handleConfirm = async () => {
    if (!selectedId) return
    if (frete === 0 && !confirm("Frete nao definido. Apos o despacho, o valor do frete nao podera mais ser alterado. Deseja continuar sem frete?")) return
```

To:

```typescript
  const handleConfirm = async () => {
    if (!selectedId) return
    if (documentoStatus !== "verificado" && !confirm("Documentacao ainda nao verificada. Deseja despachar mesmo assim?")) return
    if (frete === 0 && !confirm("Frete nao definido. Apos o despacho, o valor do frete nao podera mais ser alterado. Deseja continuar sem frete?")) return
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/dispatch-modal.tsx
git commit -m "feat: add doc-verification confirm dialog to dispatch modal"
```

---

### Task 7: Slot limit — backend validation + getBookedSlots action

**Files:**
- Modify: `app/lib/actions.ts` — add slot-count check in `createOrder`, add `getBookedSlots` action

- [ ] **Step 1: Add getBookedSlots server action**

In `app/lib/actions.ts`, add this export after the `uploadDocuments` function:

```typescript
export const getBookedSlots = async (dataEvento: string): Promise<Record<number, number>> => {
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("horario_evento")
    .eq("data_evento", dataEvento)
    .neq("status", "cancelado")

  const counts: Record<number, number> = {}
  for (const p of pedidos ?? []) {
    const hour = parseInt(p.horario_evento.split(":")[0], 10)
    counts[hour] = (counts[hour] ?? 0) + 1
  }

  return counts
}
```

- [ ] **Step 2: Add slot validation in createOrder**

In `app/lib/actions.ts`, inside `createOrder`, add this check right before the pedido insert (before `const { data: pedido, error: pedidoError } = ...`):

```typescript
  const hora = parseInt(data.horario_evento.split(":")[0], 10)
  const { count: slotCount } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("data_evento", data.data_evento)
    .gte("horario_evento", `${String(hora).padStart(2, "0")}:00`)
    .lt("horario_evento", `${String(hora + 1).padStart(2, "0")}:00`)
    .neq("status", "cancelado")

  if ((slotCount ?? 0) >= 2) return { error: "Horario indisponivel. Escolha outro horario." }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/lib/actions.ts
git commit -m "feat: add 2-orders-per-hour slot limit with getBookedSlots action"
```

---

### Task 8: Slot limit — frontend (checkout form)

**Files:**
- Modify: `app/components/checkout-form.tsx` — fetch booked slots, disable full hours

- [ ] **Step 1: Add booked slots state and fetch**

In `app/components/checkout-form.tsx`, add the import at the top — change:

```typescript
import { createOrder } from "@/lib/actions"
```

To:

```typescript
import { createOrder, getBookedSlots } from "@/lib/actions"
```

Add state after the existing state declarations (after line 81, `const [rampasDetalhes, setRampasDetalhes] = useState("")`):

```typescript
  const [bookedSlots, setBookedSlots] = useState<Record<number, number>>({})
```

Add an effect to fetch slots when the date changes. Place it after the `handleAddressSelect` function (after line 109):

```typescript
  useEffect(() => {
    if (!dataEvento) {
      setBookedSlots({})
      return
    }
    getBookedSlots(dataEvento).then(setBookedSlots).catch(() => setBookedSlots({}))
  }, [dataEvento])

  useEffect(() => {
    if (hora && (bookedSlots[parseInt(hora, 10)] ?? 0) >= 2) {
      setHora("")
      setMinuto("")
    }
  }, [bookedSlots, hora])
```

Add the `useEffect` import — change:

```typescript
import { useState } from "react"
```

To:

```typescript
import { useState, useEffect } from "react"
```

- [ ] **Step 2: Update hora select to show unavailable slots**

In `app/components/checkout-form.tsx`, change the hora `<option>` rendering inside the hora `<select>` from:

```tsx
                {HORAS.map((h) => (
                  <option key={h} value={String(h)}>{String(h).padStart(2, "0")}h</option>
                ))}
```

To:

```tsx
                {HORAS.map((h) => {
                  const full = (bookedSlots[h] ?? 0) >= 2
                  return (
                    <option key={h} value={String(h)} disabled={full}>
                      {String(h).padStart(2, "0")}h{full ? " (indisponivel)" : ""}
                    </option>
                  )
                })}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/components/checkout-form.tsx
git commit -m "feat: show unavailable hour slots in checkout when 2+ orders booked"
```

---

### Task 9: Chopeira tooltips

**Files:**
- Modify: `app/components/checkout-form.tsx` — add description text under each chopeira option

- [ ] **Step 1: Update chopeira labels**

In `app/components/checkout-form.tsx`, change the eletrica label from:

```tsx
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "eletrica" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="eletrica" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} className="sr-only" />
                <span className="text-xl">⚡</span>
                <span className="font-medium">Eletrica</span>
              </label>
```

To:

```tsx
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "eletrica" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="eletrica" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} className="sr-only" />
                <span className="text-xl">⚡</span>
                <span className="font-medium">Eletrica</span>
                <span className="text-xs text-brand-warm-gray text-center leading-tight">Refrigeracao propria — mantem o chopp gelado sem gelo</span>
              </label>
```

Change the gelo label from:

```tsx
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "gelo" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="gelo" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} className="sr-only" />
                <span className="text-xl">🧊</span>
                <span className="font-medium">Gelo</span>
              </label>
```

To:

```tsx
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "gelo" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="gelo" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} className="sr-only" />
                <span className="text-xl">🧊</span>
                <span className="font-medium">Gelo</span>
                <span className="text-xs text-brand-warm-gray text-center leading-tight">Resfriada com gelo — simples e sem energia eletrica</span>
              </label>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add app/components/checkout-form.tsx
git commit -m "feat: add chopeira type descriptions in checkout"
```

---

### Task 10: Visual QA — dev server verification

- [ ] **Step 1: Start dev server**

Run: `cd app && npm run dev`

- [ ] **Step 2: Verify checkout page**

Navigate to checkout with items in cart:
1. Select a date — verify hora select shows "(indisponivel)" for slots with 2+ orders
2. Verify chopeira options show description text below "Eletrica" and "Gelo"
3. Complete a test order — verify it starts as `confirmado` (not `aguardando_documentos`)

- [ ] **Step 3: Verify admin order detail**

Navigate to `/admin/pedidos/[id]`:
1. For an order with `documento_status: "pendente"` — verify yellow banner shows "Documentacao pendente de verificacao"
2. Verify the advance button is enabled (not blocked by docs)
3. Click "Mover para: Enviar p/ Entregador" — verify dispatch modal opens
4. In dispatch modal, click confirm — verify the "Documentacao ainda nao verificada" confirm dialog appears

- [ ] **Step 4: Verify admin status filter**

Navigate to `/admin/pedidos`:
1. Verify "Aguardando Documentos" filter tab is gone
2. Verify existing orders show as "Confirmado"

- [ ] **Step 5: Deploy**

Run: `cd app && vercel --prod`
