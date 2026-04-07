# Fase 3 — Entregadores, Status Flow & Checkout Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand order lifecycle with driver assignment, new statuses, frete field, and checkout updates.

**Architecture:** Incremental changes to the existing Next.js 15 + Supabase app. Each task is independently deployable. DB migration first, then app code updates layer by layer. No new external dependencies.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (PostgreSQL + RLS), Tailwind CSS v4, Framer Motion, Zod

**Spec:** `docs/superpowers/specs/2026-04-07-fase3-entregadores-status-flow-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/011_fase3_entregadores_status_flow.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Fase 3: Entregadores, expanded status flow, new order fields

-- 1. Create entregadores table
create table entregadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table entregadores enable row level security;
create policy "entregadores_all_admin" on entregadores for all using (auth.role() = 'authenticated');
create policy "entregadores_select_public" on entregadores for select using (true);

-- 2. Add new columns to pedidos
alter table pedidos add column frete numeric(10,2) not null default 0;
alter table pedidos add column rampas_escadas text;
alter table pedidos add column entregador_id uuid references entregadores(id);

-- 3. Update status check constraint to include enviar_para_entregador
alter table pedidos drop constraint if exists pedidos_status_check;
alter table pedidos add constraint pedidos_status_check check (status in (
  'aguardando_documentos', 'aguardando_pagamento', 'confirmado',
  'enviar_para_entregador', 'em_rota', 'entregue',
  'recolhido', 'finalizado', 'cancelado'
));

-- 4. Index for driver lookups
create index idx_pedidos_entregador_id on pedidos(entregador_id);
create index idx_entregadores_ativo on entregadores(ativo);
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `npx supabase db push` or apply via Supabase dashboard SQL editor.

Verify: Run in SQL editor:
```sql
select column_name, data_type from information_schema.columns where table_name = 'pedidos' and column_name in ('frete', 'rampas_escadas', 'entregador_id');
select count(*) from information_schema.tables where table_name = 'entregadores';
```
Expected: 3 rows for pedidos columns, 1 row for entregadores table.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_fase3_entregadores_status_flow.sql
git commit -m "feat: add migration for entregadores, expanded status flow, new order fields"
```

---

### Task 2: Update Types & Schemas

**Files:**
- Modify: `app/lib/types.ts`
- Modify: `app/lib/schemas.ts`

- [ ] **Step 1: Update PedidoStatus type**

In `app/lib/types.ts`, replace lines 30-38:

```typescript
export type PedidoStatus =
  | "aguardando_documentos"
  | "aguardando_pagamento"
  | "confirmado"
  | "em_rota"
  | "entregue"
  | "recolhido"
  | "finalizado"
  | "cancelado"
```

With:

```typescript
export type PedidoStatus =
  | "aguardando_documentos"
  | "confirmado"
  | "enviar_para_entregador"
  | "em_rota"
  | "entregue"
  | "aguardando_pagamento"
  | "recolhido"
  | "finalizado"
  | "cancelado"
```

- [ ] **Step 2: Add frete, rampas_escadas, entregador_id to Pedido type**

In `app/lib/types.ts`, replace lines 40-58:

```typescript
export type Pedido = {
  id: string
  cliente_id: string
  status: PedidoStatus
  documento_status: DocumentoStatus
  endereco: string
  endereco_completo: EnderecoCompleto | null
  data_evento: string
  horario_evento: string
  observacoes: string | null
  tipo_chopeira: "gelo" | "eletrica"
  subtotal: number
  desconto: number
  total: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
  created_at: string
  updated_at: string
}
```

With:

```typescript
export type Pedido = {
  id: string
  cliente_id: string
  status: PedidoStatus
  documento_status: DocumentoStatus
  endereco: string
  endereco_completo: EnderecoCompleto | null
  data_evento: string
  horario_evento: string
  observacoes: string | null
  tipo_chopeira: "gelo" | "eletrica"
  rampas_escadas: string | null
  subtotal: number
  desconto: number
  frete: number
  total: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
  entregador_id: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Add Entregador type**

In `app/lib/types.ts`, after the `EnderecoCompleto` type (after line 88), add:

```typescript
export type Entregador = {
  id: string
  nome: string
  telefone: string
  ativo: boolean
  created_at: string
}
```

- [ ] **Step 4: Update createOrderSchema to add rampas_escadas**

In `app/lib/schemas.ts`, replace line 27:

```typescript
  observacoes: z.string().max(1000).optional().or(z.literal("")),
```

With:

```typescript
  observacoes: z.string().max(1000).optional().or(z.literal("")),
  rampas_escadas: z.string().max(500).optional().or(z.literal("")),
```

- [ ] **Step 5: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build errors for files that still reference old status order (status-actions.tsx, admin-actions.ts, etc.) — this is expected and will be fixed in Task 3. The types and schemas themselves should compile.

- [ ] **Step 6: Commit**

```bash
git add app/lib/types.ts app/lib/schemas.ts
git commit -m "feat: update types and schemas for fase 3 — entregador, frete, rampas_escadas"
```

---

### Task 3: Update Status Flow Across the App

**Files:**
- Modify: `app/lib/admin-actions.ts:8-16`
- Modify: `app/components/admin/status-actions.tsx:15-22`
- Modify: `app/components/order-status-badge.tsx:3-12`
- Modify: `app/components/admin/status-filter.tsx:13-15`
- Modify: `app/lib/actions.ts:122-125`

- [ ] **Step 1: Update statusOrder in admin-actions.ts**

In `app/lib/admin-actions.ts`, replace lines 8-16:

```typescript
const statusOrder = [
  "aguardando_documentos",
  "aguardando_pagamento",
  "confirmado",
  "em_rota",
  "entregue",
  "recolhido",
  "finalizado",
] as const
```

With:

```typescript
const statusOrder = [
  "aguardando_documentos",
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "aguardando_pagamento",
  "recolhido",
  "finalizado",
] as const
```

Also in the same file, inside `advanceOrderStatus`, after the `documento_status` check (`if (pedido?.documento_status !== "verificado")`), add a guard to prevent bypassing the dispatch flow:

```typescript
  if (currentStatus === "confirmado") {
    throw new Error("Use despacho para entregador para avancar pedidos confirmados")
  }
```

This ensures `confirmado → enviar_para_entregador` can only happen through `dispatchToEntregador` (which also assigns the driver).

- [ ] **Step 2: Update nextStatusMap in status-actions.tsx**

In `app/components/admin/status-actions.tsx`, replace lines 15-22:

```typescript
const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  aguardando_documentos: "aguardando_pagamento",
  aguardando_pagamento: "confirmado",
  confirmado: "em_rota",
  em_rota: "entregue",
  entregue: "recolhido",
  recolhido: "finalizado",
}
```

With:

```typescript
const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  aguardando_documentos: "confirmado",
  confirmado: "enviar_para_entregador",
  enviar_para_entregador: "em_rota",
  em_rota: "entregue",
  entregue: "aguardando_pagamento",
  aguardando_pagamento: "recolhido",
  recolhido: "finalizado",
}
```

- [ ] **Step 3: Update statusConfig in order-status-badge.tsx**

In `app/components/order-status-badge.tsx`, replace lines 3-12:

```typescript
const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  aguardando_documentos: { label: "Aguardando Documentos", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  confirmado: { label: "Confirmado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  em_rota: { label: "Em Rota", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  entregue: { label: "Entregue", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  recolhido: { label: "Recolhido", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  finalizado: { label: "Finalizado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
}
```

With:

```typescript
const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  aguardando_documentos: { label: "Aguardando Documentos", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  confirmado: { label: "Confirmado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  enviar_para_entregador: { label: "Enviar p/ Entregador", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  em_rota: { label: "Em Rota", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  entregue: { label: "Entregue", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  recolhido: { label: "Recolhido", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  finalizado: { label: "Finalizado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
}
```

- [ ] **Step 4: Update allStatuses in status-filter.tsx**

In `app/components/admin/status-filter.tsx`, replace lines 13-15:

```typescript
const allStatuses: (PedidoStatus | "todos")[] = [
  "todos", "aguardando_documentos", "aguardando_pagamento", "confirmado", "em_rota", "entregue", "recolhido", "finalizado", "cancelado"
]
```

With:

```typescript
const allStatuses: (PedidoStatus | "todos")[] = [
  "todos", "aguardando_documentos", "confirmado", "enviar_para_entregador", "em_rota", "entregue", "aguardando_pagamento", "recolhido", "finalizado", "cancelado"
]
```

- [ ] **Step 5: Update createOrder auto-status for verified docs**

In `app/lib/actions.ts`, replace lines 122-125:

```typescript
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
        status: "aguardando_pagamento",
      }),
```

With:

```typescript
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
        status: "confirmado",
      }),
```

- [ ] **Step 6: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds. All status references should be consistent.

- [ ] **Step 7: Commit**

```bash
git add app/lib/admin-actions.ts app/components/admin/status-actions.tsx app/components/order-status-badge.tsx app/components/admin/status-filter.tsx app/lib/actions.ts
git commit -m "feat: reorder status flow — enviar_para_entregador, aguardando_pagamento after entregue"
```

---

### Task 4: Frete Field on Admin Order Detail

**Files:**
- Modify: `app/lib/admin-actions.ts` (add updateFrete action)
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` (add frete to ITENS section)

- [ ] **Step 1: Add updateFrete server action**

In `app/lib/admin-actions.ts`, after the `cancelOrder` function (after line 63), add:

```typescript
export const updateFrete = async (pedidoId: string, frete: number) => {
  const { supabase } = await requireAdmin()

  if (frete < 0) throw new Error("Frete nao pode ser negativo")

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("subtotal, desconto, status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")

  const lockedStatuses = ["enviar_para_entregador", "em_rota", "entregue", "aguardando_pagamento", "recolhido", "finalizado", "cancelado"]
  if (lockedStatuses.includes(pedido.status)) {
    throw new Error("Frete nao pode ser alterado apos despacho")
  }

  const total = pedido.subtotal - pedido.desconto + frete

  const { error } = await supabase
    .from("pedidos")
    .update({ frete, total })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}
```

- [ ] **Step 2: Create FreteInput client component**

Create `app/components/admin/frete-input.tsx`:

```tsx
"use client"

import { useState } from "react"
import { updateFrete } from "@/lib/admin-actions"

type FreteInputProps = {
  pedidoId: string
  initialFrete: number
  readOnly: boolean
}

const FreteInput = ({ pedidoId, initialFrete, readOnly }: FreteInputProps) => {
  const [value, setValue] = useState(String(initialFrete || ""))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleBlur = async () => {
    const parsed = parseFloat(value.replace(",", "."))
    if (isNaN(parsed) || parsed === initialFrete) return

    setSaving(true)
    await updateFrete(pedidoId, parsed)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (readOnly) {
    return (
      <span className="font-medium text-white">
        {initialFrete > 0 ? `R$ ${initialFrete.toFixed(2).replace(".", ",")}` : "—"}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-brand-warm-gray text-sm">R$</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="0,00"
        className="w-20 px-2 py-1 rounded border border-white/10 bg-brand-dark text-white text-sm text-right focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none"
      />
      {saving && <span className="text-xs text-brand-warm-gray">...</span>}
      {saved && <span className="text-xs text-green-400">✓</span>}
    </div>
  )
}

export default FreteInput
```

- [ ] **Step 3: Update order detail page ITENS section**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, add the import at the top (after line 9):

```typescript
import FreteInput from "@/components/admin/frete-input"
```

Then replace the ITENS section (lines 135-155) — from `<FadeIn delay={0.2}>` through its closing `</FadeIn>`:

```tsx
          <FadeIn delay={0.2}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ITENS</h2>
              {(items ?? []).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-brand-gray-light">
                    {item.quantidade}x {item.produtos?.marca ?? item.produtos?.[0]?.marca} {item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros}L
                  </span>
                  <span className="font-medium text-white">{formatPrice(item.preco_unitario * item.quantidade)}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-warm-gray">Subtotal</span>
                  <span className="text-white">{formatPrice(pedido.subtotal)}</span>
                </div>
                {pedido.desconto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-warm-gray">Desconto</span>
                    <span className="text-green-400">- {formatPrice(pedido.desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm items-center">
                  <span className="text-brand-yellow font-medium">Frete</span>
                  <FreteInput
                    pedidoId={pedido.id}
                    initialFrete={pedido.frete}
                    readOnly={["enviar_para_entregador", "em_rota", "entregue", "aguardando_pagamento", "recolhido", "finalizado", "cancelado"].includes(pedido.status)}
                  />
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-white/10">
                  <span className="text-white">Total</span>
                  <span className="text-brand-yellow">{formatPrice(pedido.total)}</span>
                </div>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-brand-warm-gray">Pagamento</span>
                <span className="text-brand-yellow">{pedido.metodo_pagamento ?? "—"}</span>
              </div>
            </div>
          </FadeIn>
```

- [ ] **Step 4: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions.ts app/components/admin/frete-input.tsx app/app/admin/\(authenticated\)/pedidos/\[id\]/page.tsx
git commit -m "feat: add editable frete field to admin order detail with total recalculation"
```

---

### Task 5: Entregadores CRUD

**Files:**
- Modify: `app/components/admin/admin-nav.tsx:8-14` (add nav item)
- Modify: `app/lib/admin-actions.ts` (add entregador actions)
- Modify: `app/lib/schemas.ts` (add entregador schema)
- Create: `app/app/admin/(authenticated)/entregadores/page.tsx`
- Create: `app/components/admin/entregadores-list.tsx`
- Create: `app/components/admin/entregador-modal.tsx`

- [ ] **Step 1: Add entregador validation schema**

In `app/lib/schemas.ts`, after the `productSchema` (after line 47), add:

```typescript
export const entregadorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200),
  telefone: z.string().regex(phoneRegex, "Telefone invalido"),
})

export type EntregadorInput = z.infer<typeof entregadorSchema>
```

- [ ] **Step 2: Add entregador server actions**

In `app/lib/admin-actions.ts`, after the `updateFrete` function, add:

```typescript
export const createEntregador = async (nome: string, telefone: string) => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("entregadores")
    .insert({ nome, telefone })
    .select("id")
    .single()

  if (error) throw error
  revalidatePath("/admin/entregadores")
  return data
}

export const updateEntregador = async (id: string, nome: string, telefone: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("entregadores")
    .update({ nome, telefone })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/admin/entregadores")
}

export const toggleEntregadorAtivo = async (id: string, ativo: boolean) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("entregadores")
    .update({ ativo })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/admin/entregadores")
}
```

- [ ] **Step 3: Add "Entregadores" nav item**

In `app/components/admin/admin-nav.tsx`, replace lines 8-14:

```typescript
const navItems = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/catalogo", label: "Catalogo" },
  { href: "/admin/area-entrega", label: "Area" },
  { href: "/admin/conteudo", label: "Conteudo" },
  { href: "/admin/configuracoes", label: "Config" },
]
```

With:

```typescript
const navItems = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/entregadores", label: "Entregadores" },
  { href: "/admin/catalogo", label: "Catalogo" },
  { href: "/admin/area-entrega", label: "Area" },
  { href: "/admin/conteudo", label: "Conteudo" },
  { href: "/admin/configuracoes", label: "Config" },
]
```

- [ ] **Step 4: Create EntregadorModal component**

Create `app/components/admin/entregador-modal.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createEntregador, updateEntregador } from "@/lib/admin-actions"
import type { Entregador } from "@/lib/types"

type EntregadorModalProps = {
  entregador: Entregador | null
  onClose: () => void
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const EntregadorModal = ({ entregador, onClose }: EntregadorModalProps) => {
  const [nome, setNome] = useState(entregador?.nome ?? "")
  const [telefone, setTelefone] = useState(entregador?.telefone ?? "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNome(entregador?.nome ?? "")
    setTelefone(entregador?.telefone ?? "")
    setError(null)
  }, [entregador])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (entregador) {
        await updateEntregador(entregador.id, nome, telefone)
      } else {
        await createEntregador(nome, telefone)
      }
      onClose()
    } catch (err: any) {
      setError(err.message ?? "Erro ao salvar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-surface border border-white/10 rounded-xl p-6 w-full max-w-md mx-4"
        >
          <h3 className="font-display text-lg font-bold text-white tracking-wide mb-4">
            {entregador ? "EDITAR ENTREGADOR" : "NOVO ENTREGADOR"}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-gray-light mb-1.5">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors"
                placeholder="Nome do entregador"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-gray-light mb-1.5">WhatsApp *</label>
              <input
                type="tel"
                required
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                maxLength={15}
                className="w-full px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors"
                placeholder="(21) 99999-9999"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-brand-gray-light text-sm font-medium hover:bg-white/5 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-lg bg-brand-yellow text-brand-black text-sm font-bold hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EntregadorModal
```

- [ ] **Step 5: Create EntregadoresList component**

Create `app/components/admin/entregadores-list.tsx`:

```tsx
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Entregador } from "@/lib/types"
import { toggleEntregadorAtivo } from "@/lib/admin-actions"
import EntregadorModal from "@/components/admin/entregador-modal"

const EntregadoresList = ({ initialEntregadores }: { initialEntregadores: Entregador[] }) => {
  const [showModal, setShowModal] = useState(false)
  const [editingEntregador, setEditingEntregador] = useState<Entregador | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const handleEdit = (entregador: Entregador) => {
    setEditingEntregador(entregador)
    setShowModal(true)
  }

  const handleAdd = () => {
    setEditingEntregador(null)
    setShowModal(true)
  }

  const handleToggle = async (entregador: Entregador) => {
    setToggling(entregador.id)
    await toggleEntregadorAtivo(entregador.id, !entregador.ativo)
    setToggling(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAdd}
          className="bg-brand-yellow text-brand-black font-bold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition cursor-pointer"
        >
          + Adicionar
        </motion.button>
      </div>

      {initialEntregadores.length === 0 ? (
        <div className="text-center py-12 text-brand-warm-gray">
          Nenhum entregador cadastrado
        </div>
      ) : (
        <div className="bg-brand-surface rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">WhatsApp</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-brand-warm-gray uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {initialEntregadores.map((entregador) => (
                <tr key={entregador.id} className="border-b border-white/5 last:border-0">
                  <td className={`px-5 py-4 text-sm font-medium ${entregador.ativo ? "text-white" : "text-brand-warm-gray"}`}>
                    {entregador.nome}
                  </td>
                  <td className={`px-5 py-4 text-sm ${entregador.ativo ? "text-brand-gray-light" : "text-brand-warm-gray/60"}`}>
                    {entregador.telefone}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggle(entregador)}
                      disabled={toggling === entregador.id}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition ${
                        entregador.ativo
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30"
                      } disabled:opacity-50`}
                    >
                      {entregador.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleEdit(entregador)}
                      className="text-brand-warm-gray hover:text-brand-yellow text-sm transition cursor-pointer"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <EntregadorModal
          entregador={editingEntregador}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

export default EntregadoresList
```

- [ ] **Step 6: Create entregadores page**

Create `app/app/admin/(authenticated)/entregadores/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server"
import FadeIn from "@/components/admin/fade-in"
import EntregadoresList from "@/components/admin/entregadores-list"
import type { Entregador } from "@/lib/types"

const EntregadoresPage = async () => {
  const supabase = await createClient()

  const { data } = await supabase
    .from("entregadores")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome")

  const entregadores = (data ?? []) as Entregador[]

  return (
    <div>
      <FadeIn>
        <h1 className="font-display text-3xl font-bold text-white tracking-wide mb-6">ENTREGADORES</h1>
      </FadeIn>
      <FadeIn delay={0.05}>
        <EntregadoresList initialEntregadores={entregadores} />
      </FadeIn>
    </div>
  )
}

export default EntregadoresPage
```

- [ ] **Step 7: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds. Navigate to `/admin/entregadores` to verify the page renders.

- [ ] **Step 8: Commit**

```bash
git add app/lib/schemas.ts app/lib/admin-actions.ts app/components/admin/admin-nav.tsx app/components/admin/entregador-modal.tsx app/components/admin/entregadores-list.tsx app/app/admin/\(authenticated\)/entregadores/page.tsx
git commit -m "feat: add entregadores CRUD — admin page with modal add/edit and toggle ativo"
```

---

### Task 6: Dispatch Modal — Driver Assignment + Clipboard

**Files:**
- Modify: `app/lib/admin-actions.ts` (add dispatchToEntregador action)
- Create: `app/components/admin/dispatch-modal.tsx`
- Modify: `app/components/admin/status-actions.tsx` (add dispatch flow at confirmado)
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` (show assigned driver, pass data to status-actions)

- [ ] **Step 1: Add dispatchToEntregador server action**

In `app/lib/admin-actions.ts`, after the `toggleEntregadorAtivo` function, add:

```typescript
export const dispatchToEntregador = async (pedidoId: string, entregadorId: string) => {
  const { supabase } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (pedido.status !== "confirmado") throw new Error("Pedido precisa estar confirmado para despachar")

  const { data: entregador } = await supabase
    .from("entregadores")
    .select("id, ativo")
    .eq("id", entregadorId)
    .single()

  if (!entregador || !entregador.ativo) throw new Error("Entregador invalido ou inativo")

  const { error } = await supabase
    .from("pedidos")
    .update({ entregador_id: entregadorId, status: "enviar_para_entregador" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const fetchActiveEntregadores = async () => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("entregadores")
    .select("id, nome, telefone")
    .eq("ativo", true)
    .order("nome")

  if (error) throw error
  return data ?? []
}
```

- [ ] **Step 2: Create DispatchModal component**

Create `app/components/admin/dispatch-modal.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { dispatchToEntregador, fetchActiveEntregadores } from "@/lib/admin-actions"

type DispatchModalProps = {
  pedidoId: string
  dispatchText: string
  onClose: () => void
}

type EntregadorOption = {
  id: string
  nome: string
  telefone: string
}

const DispatchModal = ({ pedidoId, dispatchText, onClose }: DispatchModalProps) => {
  const [entregadores, setEntregadores] = useState<EntregadorOption[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchActiveEntregadores()
      .then((data) => {
        setEntregadores(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Erro ao carregar entregadores"))
      .finally(() => setLoadingList(false))
  }, [])

  const handleConfirm = async () => {
    if (!selectedId) return
    setLoading(true)
    setError(null)

    try {
      await navigator.clipboard.writeText(dispatchText)
      setCopied(true)
      await dispatchToEntregador(pedidoId, selectedId)
      onClose()
    } catch (err: any) {
      setError(err.message ?? "Erro ao despachar")
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-surface border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <h3 className="font-display text-lg font-bold text-white tracking-wide mb-4">
            ENVIAR PARA ENTREGADOR
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-brand-warm-gray uppercase tracking-wider mb-1.5">
                Selecionar Entregador
              </label>
              {loadingList ? (
                <div className="px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-brand-warm-gray text-sm">
                  Carregando...
                </div>
              ) : entregadores.length === 0 ? (
                <div className="px-4 py-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                  Nenhum entregador ativo. Cadastre um em Entregadores.
                </div>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-white text-sm focus:border-brand-yellow outline-none cursor-pointer appearance-none"
                >
                  {entregadores.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} — {e.telefone}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-warm-gray uppercase tracking-wider mb-1.5">
                Resumo do Pedido
              </label>
              <pre className="px-4 py-3 rounded-md border border-white/10 bg-brand-dark text-brand-gray-light text-xs leading-relaxed whitespace-pre-wrap font-mono">
                {dispatchText}
              </pre>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-brand-gray-light text-sm font-medium hover:bg-white/5 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || !selectedId || loadingList}
                className="flex-[2] px-4 py-3 rounded-lg bg-brand-yellow text-brand-black text-sm font-bold hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {copied ? "Copiado! Despachando..." : loading ? "Despachando..." : "📋 Copiar e Confirmar"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default DispatchModal
```

- [ ] **Step 3: Update StatusActions to show dispatch modal at confirmado**

Replace the entire file `app/components/admin/status-actions.tsx`:

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
  dispatchText?: string
}

const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  aguardando_documentos: "confirmado",
  confirmado: "enviar_para_entregador",
  enviar_para_entregador: "em_rota",
  em_rota: "entregue",
  entregue: "aguardando_pagamento",
  aguardando_pagamento: "recolhido",
  recolhido: "finalizado",
}

const StatusActions = ({ pedidoId, currentStatus, documentoStatus, dispatchText }: StatusActionsProps) => {
  const [loading, setLoading] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)

  const nextStatus = nextStatusMap[currentStatus]

  const handleAdvance = async () => {
    if (currentStatus === "confirmado") {
      setShowDispatch(true)
      return
    }
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

  if (currentStatus === "finalizado" || currentStatus === "cancelado") return null

  const docsVerified = documentoStatus === "verificado"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-brand-warm-gray">Status atual:</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${statusConfig[currentStatus].color}`}>
          {statusConfig[currentStatus].label}
        </span>
      </div>

      {nextStatus && (
        <>
          <motion.button
            onClick={handleAdvance}
            disabled={loading || !docsVerified}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
          </motion.button>
          {!docsVerified && (
            <p className="text-yellow-400 text-xs text-center">Verifique os documentos primeiro</p>
          )}
        </>
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
          onClose={() => setShowDispatch(false)}
        />
      )}
    </div>
  )
}

export default StatusActions
```

- [ ] **Step 4: Update order detail page to build dispatch text and show assigned driver**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, add this helper function after the `formatPrice` function (after line 16):

```typescript
const buildDispatchText = (pedido: any, items: any[], cliente: any) => {
  const itemLines = (items ?? []).map((item: any) => {
    const marca = item.produtos?.marca ?? item.produtos?.[0]?.marca ?? ""
    const volume = item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros ?? ""
    return `${item.quantidade}x ${marca} ${volume}L`
  }).join(", ")

  const dataFormatted = new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")
  const endereco = pedido.endereco_completo
  const enderecoLine = endereco
    ? `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ` (${endereco.complemento})` : ""}`
    : pedido.endereco

  return [
    `📍 Data do evento: ${dataFormatted}`,
    `◼ Quantidade de Barris: ${itemLines}`,
    `◼ Preferencia de Chopeira: ${pedido.tipo_chopeira}`,
    `◼ Responsavel: ${cliente.nome}`,
    `◼ Contato: ${cliente.telefone}`,
    `◼ Municipio: ${endereco?.cidade ?? "—"}`,
    `◼ Bairro: ${endereco?.bairro ?? "—"}`,
    `◼ Endereco: ${enderecoLine}`,
    `◼ Rampas/Escadas: ${pedido.rampas_escadas || "Nao"}`,
    `◼ Valor: R$ ${pedido.subtotal.toFixed(2).replace(".", ",")}`,
    `◼ Frete: R$ ${(pedido.frete || 0).toFixed(2).replace(".", ",")}`,
    `◼ Forma de pagamento: ${pedido.metodo_pagamento ?? "—"}`,
    `◼ Observacoes: ${pedido.observacoes || "—"}`,
  ].join("\n")
}
```

Then update the data query to also fetch the assigned driver. Replace lines 22-26:

```typescript
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(id, nome, telefone, email, cpf, documento_pessoal_url, comprovante_residencia_url, documento_verificado, documento_verificado_em)")
    .eq("id", id)
    .single()
```

With:

```typescript
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(id, nome, telefone, email, cpf, documento_pessoal_url, comprovante_residencia_url, documento_verificado, documento_verificado_em), entregadores(id, nome, telefone)")
    .eq("id", id)
    .single()
```

Then update the StatusActions usage. Replace line 162:

```tsx
              <StatusActions pedidoId={pedido.id} currentStatus={pedido.status as PedidoStatus} documentoStatus={pedido.documento_status} />
```

With:

```tsx
              <StatusActions
                pedidoId={pedido.id}
                currentStatus={pedido.status as PedidoStatus}
                documentoStatus={pedido.documento_status}
                dispatchText={buildDispatchText(pedido, items ?? [], pedido.clientes)}
              />
```

Then add an "ENTREGADOR" section after the ACOES section. After the closing `</FadeIn>` of the ACOES block (after line 164), add:

```tsx
          {pedido.entregadores && (
            <FadeIn delay={0.15}>
              <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ENTREGADOR</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">Nome</span>
                    <span className="text-white">{pedido.entregadores.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">WhatsApp</span>
                    <a
                      href={`https://wa.me/${pedido.entregadores.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:underline"
                    >
                      {pedido.entregadores.telefone}
                    </a>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}
```

- [ ] **Step 5: Also add rampas_escadas to the EVENTO section on order detail**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, in the EVENTO section, after the Endereco block (after line 124 `<span className="text-sm text-white">{pedido.endereco}</span>`), and before the observacoes block, add:

```tsx
                {pedido.rampas_escadas && (
                  <div>
                    <span className="text-brand-warm-gray block mb-1">Rampas/Escadas</span>
                    <span className="text-sm text-white">{pedido.rampas_escadas}</span>
                  </div>
                )}
```

- [ ] **Step 6: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/lib/admin-actions.ts app/components/admin/dispatch-modal.tsx app/components/admin/status-actions.tsx app/app/admin/\(authenticated\)/pedidos/\[id\]/page.tsx
git commit -m "feat: add dispatch modal with driver selection and clipboard copy"
```

---

### Task 7: Checkout Form Updates — Chopeira & Rampas/Escadas

**Files:**
- Modify: `app/components/checkout-form.tsx`
- Modify: `app/lib/actions.ts:117` (pass rampas_escadas to insert)

- [ ] **Step 1: Add state variables to checkout form**

In `app/components/checkout-form.tsx`, after line 78 (`const [addressInArea, setAddressInArea] = useState<boolean | null>(null)`), add:

```typescript
  const [tipoChopeira, setTipoChopeira] = useState<"gelo" | "eletrica" | "">("")
  const [temRampas, setTemRampas] = useState<"sim" | "nao" | "">("")
  const [rampasDetalhes, setRampasDetalhes] = useState("")
```

- [ ] **Step 2: Add chopeira preference UI**

In `app/components/checkout-form.tsx`, after the horario section (after line 430, the closing `</div>` of the horario block), add:

```tsx
          <div>
            <label className={labelClassName}>Preferencia de Chopeira *</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "eletrica" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="eletrica" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} className="sr-only" />
                <span className="text-xl">⚡</span>
                <span className="font-medium">Eletrica</span>
              </label>
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "gelo" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="gelo" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} className="sr-only" />
                <span className="text-xl">🧊</span>
                <span className="font-medium">Gelo</span>
              </label>
            </div>
          </div>
```

- [ ] **Step 3: Add rampas/escadas UI**

In `app/components/checkout-form.tsx`, after the complemento/numero section (after line 355, the closing `</motion.div>` of the address details block), add:

```tsx
          {address && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <label className={labelClassName}>Local possui rampas ou escadas? *</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${temRampas === "sim" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                  <input type="radio" name="rampas" value="sim" checked={temRampas === "sim"} onChange={() => setTemRampas("sim")} className="sr-only" />
                  <span className="font-medium">Sim</span>
                </label>
                <label className={`flex items-center justify-center px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${temRampas === "nao" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                  <input type="radio" name="rampas" value="nao" checked={temRampas === "nao"} onChange={() => setTemRampas("nao")} className="sr-only" />
                  <span className="font-medium">Nao</span>
                </label>
              </div>
              {temRampas === "sim" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3"
                >
                  <input
                    type="text"
                    required
                    value={rampasDetalhes}
                    onChange={(e) => setRampasDetalhes(e.target.value)}
                    className={inputClassName}
                    placeholder="Descreva (ex: 3o andar sem elevador)"
                  />
                </motion.div>
              )}
            </motion.div>
          )}
```

- [ ] **Step 4: Update form submission to pass new fields**

In `app/components/checkout-form.tsx`, replace line 154:

```typescript
      tipo_chopeira: "gelo" as const,
```

With:

```typescript
      tipo_chopeira: tipoChopeira as "gelo" | "eletrica",
      rampas_escadas: temRampas === "sim" ? rampasDetalhes : undefined,
```

- [ ] **Step 5: Add validation for required new fields**

In `app/components/checkout-form.tsx`, before the `const formData = new FormData(e.currentTarget)` line (before line 135), add:

```typescript
    if (!tipoChopeira) {
      setError("Selecione o tipo de chopeira")
      setLoading(false)
      return
    }

    if (address && !temRampas) {
      setError("Informe se o local possui rampas ou escadas")
      setLoading(false)
      return
    }
```

- [ ] **Step 6: Disable submit button if required fields missing**

In `app/components/checkout-form.tsx`, update the submit button disabled condition. Replace line 473:

```typescript
            disabled={loading || addressInArea === false || !!diaInvalida}
```

With:

```typescript
            disabled={loading || addressInArea === false || !!diaInvalida || !tipoChopeira || (!!address && !temRampas)}
```

- [ ] **Step 7: Update createOrder action to save rampas_escadas**

In `app/lib/actions.ts`, update the pedido insert. Replace lines 109-126:

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
      metodo_pagamento: data.metodo_pagamento,
      subtotal,
      total: subtotal,
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
        status: "aguardando_pagamento",
      }),
    })
    .select("id")
    .single()
```

With:

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

- [ ] **Step 8: Verify build**

Run: `cd app && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/components/checkout-form.tsx app/lib/actions.ts
git commit -m "feat: add chopeira preference and rampas/escadas to checkout form"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full build check**

Run: `cd app && npx next build 2>&1 | tail -30`

Expected: Build succeeds with no errors or type issues.

- [ ] **Step 2: Manual verification checklist**

Test in browser at `http://localhost:3000`:

1. **Checkout form**: New chopeira picker (eletrica/gelo) appears. Rampas/escadas appears after address selection. Both required.
2. **Admin orders list**: New filter tabs include "Enviar p/ Entregador". Status badge colors correct.
3. **Admin order detail**: Frete field is editable, total recalculates. Rampas/escadas shows in EVENTO section.
4. **Admin entregadores**: Page accessible from nav. Can add/edit/toggle drivers.
5. **Dispatch flow**: On a `confirmado` order, clicking "Mover para: Enviar p/ Entregador" opens dispatch modal with driver dropdown and formatted summary. "Copiar e Confirmar" copies text and advances status.
6. **Assigned driver**: After dispatch, order detail shows ENTREGADOR section with name and WhatsApp link.

- [ ] **Step 3: Commit any fixes**

If any issues found during verification, fix and commit.
