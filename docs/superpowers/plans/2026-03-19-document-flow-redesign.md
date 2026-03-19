# Document Flow Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move document upload from checkout to the tracking page, support two document types (pessoal + residencia), and block order advancement until admin verifies documents.

**Architecture:** Remove document upload from checkout form to reduce friction. Add a document upload section to the order tracking page (client component). Add `documento_status` column to `pedidos` table. Admin verifies documents before advancing orders. Server actions use service-role Supabase client — no RLS changes needed.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (PostgreSQL + Storage), Tailwind CSS v4, Framer Motion

**Spec:** `docs/superpowers/specs/2026-03-19-document-flow-redesign.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/009_document_flow.sql` | DB migration |
| Create | `app/components/document-upload-section.tsx` | Tracking page document upload (2 slots + submit) |
| Modify | `app/lib/types.ts` | Add `documento_status` to Pedido, rename/add fields on Cliente |
| Modify | `app/lib/actions.ts` | Replace `uploadDocument` with `uploadDocuments` |
| Modify | `app/lib/admin-actions.ts` | Update `verifyDocument`, `advanceOrderStatus`, `getDocumentSignedUrl` |
| Modify | `app/components/checkout-form.tsx` | Remove document upload + client-check |
| Modify | `app/components/order-tracker.tsx` | Add document upload section |
| Modify | `app/app/pedido/[id]/page.tsx` | Pass `documento_status` + `cliente_id` to OrderTracker |
| Modify | `app/app/pedido/[id]/confirmacao/page.tsx` | Add document reminder message |
| Modify | `app/components/admin/order-card.tsx` | Add `documento_status` badge |
| Modify | `app/components/admin/orders-list.tsx` | Include `documento_status` in query + type |
| Modify | `app/components/admin/document-section.tsx` | Show two documents, accept `pedidoId` |
| Modify | `app/components/admin/status-actions.tsx` | Block advancement when docs not verified |
| Modify | `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` | Update query + pass new props |
| Delete | `app/app/api/client-check/route.ts` | Dead code after checkout cleanup |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/009_document_flow.sql`

- [ ] **Step 1: Write migration**

```sql
alter table pedidos add column documento_status text not null default 'pendente'
  check (documento_status in ('pendente', 'enviado', 'verificado'));

alter table clientes rename column documento_url to documento_pessoal_url;
alter table clientes add column comprovante_residencia_url text;
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `npx supabase db push --linked` or apply via Supabase dashboard SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_document_flow.sql
git commit -m "feat: add documento_status column and split document URLs"
```

---

### Task 2: Update Types

**Files:**
- Modify: `app/lib/types.ts:14-25` (Cliente type)
- Modify: `app/lib/types.ts:37-54` (Pedido type)

- [ ] **Step 1: Update Cliente type**

Change `documento_url: string | null` to `documento_pessoal_url: string | null` and add `comprovante_residencia_url`:

```typescript
export type Cliente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  cpf: string | null
  documento_pessoal_url: string | null
  comprovante_residencia_url: string | null
  documento_verificado: boolean
  documento_verificado_em: string | null
  documento_verificado_por: string | null
  created_at: string
}
```

- [ ] **Step 2: Add documento_status to Pedido type**

Add after `metodo_pagamento`:

```typescript
export type DocumentoStatus = 'pendente' | 'enviado' | 'verificado'

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

- [ ] **Step 3: Commit**

```bash
git add app/lib/types.ts
git commit -m "feat: add documento_status to Pedido type, split document URLs on Cliente"
```

---

### Task 3: Update Server Actions

**Files:**
- Modify: `app/lib/actions.ts` — replace `uploadDocument` with `uploadDocuments`
- Modify: `app/lib/admin-actions.ts` — update `verifyDocument`, `advanceOrderStatus`, `getDocumentSignedUrl`

- [ ] **Step 1: Replace uploadDocument with uploadDocuments in actions.ts**

Delete the old `uploadDocument` function (lines 136-152) and add:

```typescript
export const uploadDocuments = async (pedidoId: string, formData: FormData) => {
  const pessoal = formData.get("documento_pessoal") as File
  const residencia = formData.get("comprovante_residencia") as File
  if (!pessoal || !residencia) throw new Error("Ambos os documentos sao obrigatorios")

  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("cliente_id, documento_status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (pedido.documento_status !== "pendente") throw new Error("Documentos ja enviados")

  const clienteId = pedido.cliente_id

  const { error: err1 } = await supabase.storage
    .from("documentos")
    .upload(`${clienteId}/pessoal`, pessoal, { upsert: true, contentType: pessoal.type })
  if (err1) throw new Error("Erro ao enviar documento pessoal")

  const { error: err2 } = await supabase.storage
    .from("documentos")
    .upload(`${clienteId}/residencia`, residencia, { upsert: true, contentType: residencia.type })
  if (err2) throw new Error("Erro ao enviar comprovante de residencia")

  await supabase
    .from("clientes")
    .update({
      documento_pessoal_url: `${clienteId}/pessoal`,
      comprovante_residencia_url: `${clienteId}/residencia`,
    })
    .eq("id", clienteId)

  await supabase
    .from("pedidos")
    .update({ documento_status: "enviado" })
    .eq("id", pedidoId)
}
```

- [ ] **Step 2: Update verifyDocument in admin-actions.ts**

Change signature to accept `pedidoId` and update both tables:

```typescript
export const verifyDocument = async (clienteId: string, pedidoId: string) => {
  const { supabase, user } = await requireAdmin()

  const { error: clienteError } = await supabase
    .from("clientes")
    .update({
      documento_verificado: true,
      documento_verificado_em: new Date().toISOString(),
      documento_verificado_por: user.id,
    })
    .eq("id", clienteId)
  if (clienteError) throw clienteError

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update({ documento_status: "verificado" })
    .eq("id", pedidoId)
  if (pedidoError) throw pedidoError

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}
```

- [ ] **Step 3: Add document guard to advanceOrderStatus**

After getting `nextStatus`, add a check:

```typescript
export const advanceOrderStatus = async (pedidoId: string, currentStatus: string) => {
  const { supabase } = await requireAdmin()
  const currentIndex = statusOrder.indexOf(currentStatus as typeof statusOrder[number])

  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    throw new Error("Status invalido para avanco")
  }

  const nextStatus = statusOrder[currentIndex + 1]

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("documento_status")
    .eq("id", pedidoId)
    .single()

  if (pedido?.documento_status !== "verificado") {
    throw new Error("Documentos precisam ser verificados antes de avancar o pedido")
  }

  const { error } = await supabase
    .from("pedidos")
    .update({ status: nextStatus })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")

  return { status: nextStatus }
}
```

- [ ] **Step 4: Update getDocumentSignedUrl to accept tipo**

```typescript
export const getDocumentSignedUrl = async (clienteId: string, tipo: "pessoal" | "residencia") => {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(`${clienteId}/${tipo}`, 60)
  if (error) throw error
  return data.signedUrl
}
```

- [ ] **Step 5: Commit**

```bash
git add app/lib/actions.ts app/lib/admin-actions.ts
git commit -m "feat: replace uploadDocument with uploadDocuments, add doc verification guard"
```

---

### Task 4: Simplify Checkout Form

**Files:**
- Modify: `app/components/checkout-form.tsx`
- Delete: `app/app/api/client-check/route.ts`

- [ ] **Step 1: Remove document-related code from checkout-form.tsx**

Remove these imports:
- `import { createOrder, uploadDocument } from "@/lib/actions"` → `import { createOrder } from "@/lib/actions"`
- Delete `import DocumentUpload from "@/components/document-upload"`

Remove these state variables:
- `const [documentFile, setDocumentFile] = useState<File | null>(null)`
- `const [clientVerified, setClientVerified] = useState(false)`

Remove the `checkExistingClient` function entirely.

Remove the `onBlur` handler from the CPF input:
- Delete `onBlur={() => checkExistingClient(cpf)}`

Remove the document upload JSX block (lines ~453-459):
```tsx
<div>
  <label className={labelClassName}>Documento de identidade (RG ou CNH) *</label>
  <DocumentUpload
    onFileSelect={setDocumentFile}
    verified={clientVerified}
  />
</div>
```

Remove the document upload logic from `handleSubmit` (lines ~175-180):
```tsx
if (documentFile && !clientVerified) {
  const docFormData = new FormData()
  docFormData.set("clienteId", result.clienteId)
  docFormData.set("documento", documentFile)
  await uploadDocument(docFormData)
}
```

- [ ] **Step 2: Delete client-check API route**

Delete file: `app/app/api/client-check/route.ts`

- [ ] **Step 3: Verify build**

Run: `cd app && npm run build`
Expected: Build passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/checkout-form.tsx
git rm app/app/api/client-check/route.ts
git commit -m "feat: remove document upload from checkout to reduce friction"
```

---

### Task 5: Document Upload Section Component

**Files:**
- Create: `app/components/document-upload-section.tsx`

- [ ] **Step 1: Create the document upload section**

This is a client component for the tracking page that shows two document upload slots.

```tsx
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { uploadDocuments } from "@/lib/actions"
import DocumentUpload from "@/components/document-upload"

type DocumentUploadSectionProps = {
  pedidoId: string
  documentoStatus: "pendente" | "enviado" | "verificado"
}

const DocumentUploadSection = ({ pedidoId, documentoStatus }: DocumentUploadSectionProps) => {
  const [status, setStatus] = useState(documentoStatus)

  useEffect(() => { setStatus(documentoStatus) }, [documentoStatus])
  const [pessoalFile, setPessoalFile] = useState<File | null>(null)
  const [residenciaFile, setResidenciaFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!pessoalFile || !residenciaFile) return
    setLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set("documento_pessoal", pessoalFile)
      formData.set("comprovante_residencia", residenciaFile)
      await uploadDocuments(pedidoId, formData)
      setStatus("enviado")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar documentos")
    }
    setLoading(false)
  }

  if (status === "verificado") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-xl border border-green-500/30 p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-green-400 font-medium text-sm">Documentos verificados</p>
            <p className="text-brand-warm-gray text-xs">Seus documentos foram aprovados</p>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status === "enviado") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-xl border border-blue-500/30 p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-blue-400 font-medium text-sm">Documentos enviados</p>
            <p className="text-brand-warm-gray text-xs">Aguardando verificacao da equipe</p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-surface rounded-xl border border-brand-yellow/30 p-6 space-y-4"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-brand-yellow/20 rounded-full flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-yellow">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div>
          <p className="text-brand-yellow font-medium text-sm">Envie seus documentos</p>
          <p className="text-brand-warm-gray text-xs">Para confirmarmos seu pedido</p>
        </div>
      </div>

      <div>
        <p className="text-sm text-brand-gray-light mb-1.5">Documento pessoal (RG ou CNH) *</p>
        <DocumentUpload onFileSelect={setPessoalFile} />
      </div>

      <div>
        <p className="text-sm text-brand-gray-light mb-1.5">Comprovante de residencia *</p>
        <DocumentUpload onFileSelect={setResidenciaFile} />
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      <motion.button
        onClick={handleSubmit}
        disabled={loading || !pessoalFile || !residenciaFile}
        whileHover={{ opacity: 0.85 }}
        whileTap={{ scale: 0.97 }}
        className="w-full bg-brand-yellow text-brand-black font-medium py-3 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Enviando..." : "Enviar documentos"}
      </motion.button>
    </motion.div>
  )
}

export default DocumentUploadSection
```

- [ ] **Step 2: Commit**

```bash
git add app/components/document-upload-section.tsx
git commit -m "feat: add document upload section component for tracking page"
```

---

### Task 6: Update Tracking Page

**Files:**
- Modify: `app/app/pedido/[id]/page.tsx`
- Modify: `app/components/order-tracker.tsx`

- [ ] **Step 1: Pass documento_status and cliente_id from the page**

Update `app/app/pedido/[id]/page.tsx` to pass the new fields:

```typescript
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import OrderTracker from "@/components/order-tracker"

type Props = {
  params: Promise<{ id: string }>
}

const PedidoPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(nome)")
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const { data: rawItems } = await supabase
    .from("pedido_itens")
    .select("quantidade, preco_unitario, produtos(marca, volume_litros)")
    .eq("pedido_id", id)

  const items = (rawItems ?? []).map((item) => ({
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
  })) as { quantidade: number; preco_unitario: number; produtos: { marca: string; volume_litros: number } }[]

  const { data: logs } = await supabase
    .from("pedido_status_log")
    .select("*")
    .eq("pedido_id", id)
    .order("changed_at", { ascending: false })

  return <OrderTracker pedido={pedido} items={items} logs={logs ?? []} />
}

export default PedidoPage
```

Note: `pedido` already includes `documento_status` and `cliente_id` via `select("*")`. No page changes needed beyond ensuring the type flows through.

- [ ] **Step 2: Add DocumentUploadSection to OrderTracker**

Update `app/components/order-tracker.tsx`:

Add import:
```typescript
import DocumentUploadSection from "@/components/document-upload-section"
import type { Pedido, PedidoStatusLog, PedidoStatus, DocumentoStatus } from "@/lib/types"
```

Update the `OrderTrackerProps` type to include `documento_status`:
```typescript
type OrderTrackerProps = {
  pedido: Pedido & { clientes: { nome: string } }
  items: { quantidade: number; preco_unitario: number; produtos: { marca: string; volume_litros: number } }[]
  logs: PedidoStatusLog[]
}
```

The `Pedido` type already includes `documento_status` (after Task 2). Add the section in the JSX, after the status card and before the items card:

```tsx
<DocumentUploadSection
  pedidoId={pedido.id}
  documentoStatus={pedido.documento_status}
/>
```

- [ ] **Step 3: Commit**

```bash
git add app/app/pedido/[id]/page.tsx app/components/order-tracker.tsx
git commit -m "feat: add document upload section to order tracking page"
```

---

### Task 7: Update Confirmation Page

**Files:**
- Modify: `app/app/pedido/[id]/confirmacao/page.tsx`

- [ ] **Step 1: Add document reminder message**

Add a reminder box between the order details card and the "Acompanhar Pedido" button:

```tsx
<div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-4 flex items-start gap-3">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-yellow mt-0.5 shrink-0">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
  <div>
    <p className="text-brand-yellow text-sm font-medium">Envie seus documentos</p>
    <p className="text-brand-warm-gray text-xs">Na pagina de acompanhamento, envie seu documento pessoal e comprovante de residencia para agilizar a confirmacao.</p>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add app/app/pedido/[id]/confirmacao/page.tsx
git commit -m "feat: add document upload reminder on confirmation page"
```

---

### Task 8: Update Admin Order Card

**Files:**
- Modify: `app/components/admin/order-card.tsx`
- Modify: `app/components/admin/orders-list.tsx`

- [ ] **Step 1: Add documento_status to OrderCard type and render badge**

Update the `OrderCardProps` type to include `documento_status`:

```typescript
type OrderCardProps = {
  pedido: {
    id: string
    status: string
    documento_status: string
    total: number
    data_evento: string
    horario_evento: string
    endereco: string
    metodo_pagamento: string | null
    pago: boolean
    created_at: string
    clientes: { nome: string; telefone: string }
  }
  index?: number
}
```

Add a badge in the card JSX, after the price line:

```tsx
const docStatusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Docs pendentes", className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  enviado: { label: "Docs enviados", className: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  verificado: { label: "Docs verificados", className: "text-green-400 bg-green-400/10 border-green-400/30" },
}
```

Render it below the address line:

```tsx
<div className="mt-2">
  <span className={`text-xs px-2 py-0.5 rounded-full border ${docStatusConfig[pedido.documento_status]?.className ?? ""}`}>
    {docStatusConfig[pedido.documento_status]?.label ?? pedido.documento_status}
  </span>
</div>
```

- [ ] **Step 2: Update OrdersList type and query**

Update the `OrderWithClient` type in `orders-list.tsx`:

```typescript
type OrderWithClient = {
  id: string
  status: string
  documento_status: string
  total: number
  data_evento: string
  horario_evento: string
  endereco: string
  metodo_pagamento: string | null
  pago: boolean
  created_at: string
  clientes: { nome: string; telefone: string }
}
```

Update the Supabase query inside the realtime callback to include `documento_status`:

```typescript
const { data } = await supabase
  .from("pedidos")
  .select("id, status, documento_status, total, data_evento, horario_evento, endereco, metodo_pagamento, pago, created_at, clientes(nome, telefone)")
  .order("created_at", { ascending: false })
```

- [ ] **Step 3: Update the admin pedidos page initial query**

In `app/app/admin/(authenticated)/pedidos/page.tsx`:

Update the select query (line 28) to include `documento_status`:

```typescript
.select("id, status, documento_status, total, data_evento, horario_evento, endereco, metodo_pagamento, pago, created_at, clientes(nome, telefone)")
```

Update the `normalizeOrders` return type assertion (lines 10-21) to include `documento_status`:

```typescript
  })) as {
    id: string
    status: string
    documento_status: string
    total: number
    data_evento: string
    horario_evento: string
    endereco: string
    metodo_pagamento: string | null
    pago: boolean
    created_at: string
    clientes: { nome: string; telefone: string }
  }[]
```

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/order-card.tsx app/components/admin/orders-list.tsx app/app/admin/\(authenticated\)/pedidos/page.tsx
git commit -m "feat: show documento_status badge on admin order cards"
```

---

### Task 9: Update Admin Document Section

**Files:**
- Modify: `app/components/admin/document-section.tsx`

- [ ] **Step 1: Rewrite DocumentSection for two documents**

```tsx
"use client"

import { useState } from "react"
import { verifyDocument, getDocumentSignedUrl } from "@/lib/admin-actions"

type DocumentSectionProps = {
  clienteId: string
  pedidoId: string
  documentoStatus: string
  documentoPessoalUrl: string | null
  comprovanteResidenciaUrl: string | null
  documentoVerificado: boolean
  documentoVerificadoEm: string | null
}

const DocumentSection = ({
  clienteId,
  pedidoId,
  documentoStatus: initialStatus,
  documentoPessoalUrl,
  comprovanteResidenciaUrl,
  documentoVerificado,
  documentoVerificadoEm,
}: DocumentSectionProps) => {
  const [status, setStatus] = useState(initialStatus)
  const [verified, setVerified] = useState(documentoVerificado)
  const [verifiedAt, setVerifiedAt] = useState(documentoVerificadoEm)
  const [verifying, setVerifying] = useState(false)
  const [pessoalUrl, setPessoalUrl] = useState<string | null>(null)
  const [residenciaUrl, setResidenciaUrl] = useState<string | null>(null)
  const [loadingPessoal, setLoadingPessoal] = useState(false)
  const [loadingResidencia, setLoadingResidencia] = useState(false)

  const handleViewDocument = async (tipo: "pessoal" | "residencia") => {
    const setUrl = tipo === "pessoal" ? setPessoalUrl : setResidenciaUrl
    const setLoading = tipo === "pessoal" ? setLoadingPessoal : setLoadingResidencia
    setLoading(true)
    try {
      const url = await getDocumentSignedUrl(clienteId, tipo)
      setUrl(url)
    } catch {
      setUrl(null)
    }
    setLoading(false)
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await verifyDocument(clienteId, pedidoId)
      setVerified(true)
      setStatus("verificado")
      setVerifiedAt(new Date().toISOString())
    } catch { /* ignore */ }
    setVerifying(false)
  }

  if (status === "pendente") {
    return (
      <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTOS</h2>
        <p className="text-sm text-brand-warm-gray">Nenhum documento enviado pelo cliente</p>
      </div>
    )
  }

  const renderDocViewer = (
    label: string,
    hasUrl: boolean,
    signedUrl: string | null,
    loading: boolean,
    tipo: "pessoal" | "residencia"
  ) => (
    <div>
      <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-2">{label}</p>
      {!hasUrl ? (
        <p className="text-sm text-brand-warm-gray">Nao enviado</p>
      ) : signedUrl ? (
        <div>
          <img src={signedUrl} alt={label} className="max-h-48 rounded-lg border border-white/10" />
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-brand-yellow text-sm hover:underline mt-1 inline-block">
            Abrir em nova aba
          </a>
        </div>
      ) : (
        <button
          onClick={() => handleViewDocument(tipo)}
          disabled={loading}
          className="px-4 py-2 bg-brand-dark border border-white/10 rounded-lg text-sm text-brand-gray-light hover:border-brand-yellow/30 transition cursor-pointer disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Ver documento"}
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
      <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTOS</h2>

      {verified ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-green-500/30 bg-green-900/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-green-400 text-sm font-medium">
            Verificados {verifiedAt ? `em ${new Date(verifiedAt).toLocaleDateString("pt-BR")}` : ""}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {renderDocViewer("Documento pessoal", !!documentoPessoalUrl, pessoalUrl, loadingPessoal, "pessoal")}
          {renderDocViewer("Comprovante de residencia", !!comprovanteResidenciaUrl, residenciaUrl, loadingResidencia, "residencia")}
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition cursor-pointer disabled:opacity-50"
          >
            {verifying ? "Verificando..." : "Verificar documentos"}
          </button>
        </div>
      )}
    </div>
  )
}

export default DocumentSection
```

- [ ] **Step 2: Commit**

```bash
git add app/components/admin/document-section.tsx
git commit -m "feat: update admin document section for two document types"
```

---

### Task 10: Update Admin Order Detail + Status Actions

**Files:**
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`
- Modify: `app/components/admin/status-actions.tsx`

- [ ] **Step 1: Update admin order detail query and props**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, update the Supabase select to use the new column name:

```typescript
const { data: pedido } = await supabase
  .from("pedidos")
  .select("*, clientes(id, nome, telefone, email, cpf, documento_pessoal_url, comprovante_residencia_url, documento_verificado, documento_verificado_em)")
  .eq("id", id)
  .single()
```

Update the DocumentSection props:

```tsx
<DocumentSection
  clienteId={pedido.clientes.id}
  pedidoId={pedido.id}
  documentoStatus={pedido.documento_status}
  documentoPessoalUrl={pedido.clientes.documento_pessoal_url}
  comprovanteResidenciaUrl={pedido.clientes.comprovante_residencia_url}
  documentoVerificado={pedido.clientes.documento_verificado}
  documentoVerificadoEm={pedido.clientes.documento_verificado_em}
/>
```

Update StatusActions to include `documentoStatus`:

```tsx
<StatusActions
  pedidoId={pedido.id}
  currentStatus={pedido.status as PedidoStatus}
  pago={pedido.pago}
  documentoStatus={pedido.documento_status}
/>
```

- [ ] **Step 2: Add documento guard to StatusActions**

Update props type:

```typescript
type StatusActionsProps = {
  pedidoId: string
  currentStatus: PedidoStatus
  pago: boolean
  documentoStatus: string
}
```

Update component to disable advance button when docs not verified:

```typescript
const StatusActions = ({ pedidoId, currentStatus, pago, documentoStatus }: StatusActionsProps) => {
```

In the advance button, add the disabled condition and a warning:

```tsx
{nextStatus && (
  <>
    <motion.button
      onClick={handleAdvance}
      disabled={loading || (documentoStatus !== "verificado" && currentStatus !== "cancelado")}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
    >
      {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
    </motion.button>
    {documentoStatus !== "verificado" && (
      <p className="text-yellow-400 text-xs text-center">Verifique os documentos primeiro</p>
    )}
  </>
)}
```

- [ ] **Step 3: Commit**

```bash
git add app/app/admin/\(authenticated\)/pedidos/\[id\]/page.tsx app/components/admin/status-actions.tsx
git commit -m "feat: block order advancement until documents verified"
```

---

### Task 11: Production Error Fix + Build Verification

**Files:**
- Modify: `app/app/pedido/[id]/confirmacao/page.tsx` (null safety)
- Modify: `app/app/pedido/[id]/page.tsx` (null safety)

- [ ] **Step 1: Add null safety to confirmation page**

Ensure `pedido.clientes` and `pedido.pedido_itens` are safely accessed:

```typescript
const cliente = pedido.clientes as { nome: string; telefone: string } | null
const itens = ((pedido.pedido_itens as any[]) || []).map((item: any) => ({
  ...item,
  produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
}))
```

Use optional chaining throughout: `cliente?.nome`, `item.produtos?.marca`, etc.

- [ ] **Step 2: Verify full build passes**

Run: `cd app && npm run build`
Expected: Build passes with all routes present and no errors.

- [ ] **Step 3: Commit**

```bash
git add app/app/pedido/[id]/confirmacao/page.tsx app/app/pedido/[id]/page.tsx
git commit -m "fix: add null safety to order pages, fix production render error"
```

---

### Task 12: Deploy and Verify

- [ ] **Step 1: Push to GitHub**

Run: `git push origin main`

- [ ] **Step 2: Deploy to Vercel**

Run: `cd app && vercel --prod`

- [ ] **Step 3: Apply migration to production Supabase**

Run the SQL from `009_document_flow.sql` in the Supabase dashboard SQL editor for project `rhuqttionnpfnftkmvmq`.

- [ ] **Step 4: End-to-end test on production**

1. Place an order (no document upload in checkout)
2. Verify confirmation page shows document reminder
3. Go to tracking page — verify document upload section shows "pendente" state
4. Upload two test documents
5. Verify tracking page shows "enviado" state
6. Login to admin — verify order card shows "Docs enviados" badge
7. Open order detail — verify both documents visible
8. Click "Verificar documentos"
9. Verify "Mover para" button is now enabled
10. Advance order status
