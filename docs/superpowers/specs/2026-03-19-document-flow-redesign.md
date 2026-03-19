# Document Flow Redesign — Spec

## Problem

1. The checkout form requires document upload, creating friction that loses potential customers.
2. Production error: Server Components render error when placing orders.
3. Only one document type supported; business needs both personal document and proof of residence.

## Solution

Move document upload from checkout to the order tracking page. Customers place orders without documents (zero friction), then upload documents at their own pace on the tracking page. Admin verifies documents before advancing the order.

## Flow

```
Checkout (no documents) → Confirmation (CTA to upload docs) → Tracking page (upload documents here)
```

### Customer Journey

1. Customer browses catalog, adds items to cart
2. Fills checkout form (name, CPF, phone, email, address, date, time, payment method)
3. Submits order — no documents required
4. Redirected to confirmation page — shows success + reminder: "Envie seus documentos para agilizar a confirmacao"
5. On tracking page (`/pedido/{id}`), sees document upload section
6. Uploads documento pessoal + comprovante de residencia
7. Waits for admin verification
8. Admin verifies → order advances

### Admin Journey

1. Sees new order with `documento_status: pendente` (yellow badge)
2. Customer uploads docs → status becomes `enviado` (blue badge)
3. Admin opens order detail, views both documents via signed URLs
4. Clicks "Verificar documentos" → status becomes `verificado` (green badge)
5. Can now advance order to "Confirmado" and beyond

## Database Changes

### Migration: `009_document_flow.sql`

```sql
alter table pedidos add column documento_status text not null default 'pendente'
  check (documento_status in ('pendente', 'enviado', 'verificado'));

alter table clientes rename column documento_url to documento_pessoal_url;
alter table clientes add column comprovante_residencia_url text;
```

Existing orders get `documento_status = 'pendente'` by default.

### `pedidos` table

- `documento_status text not null default 'pendente'` — CHECK constraint enforces valid values

### `clientes` table

- Rename `documento_url` → `documento_pessoal_url`
- Add `comprovante_residencia_url text`
- Keep `documento_verificado`, `documento_verificado_em`, `documento_verificado_por` (now mean "both docs verified")

### Constraint

Order status cannot advance past `novo` unless `documento_status = 'verificado'`. Enforced at application level (admin status action buttons disabled) + server-side guard in `updateOrderStatus`.

## Type Updates

### `app/lib/types.ts`

- `Pedido` type: add `documento_status: 'pendente' | 'enviado' | 'verificado'`
- `Cliente` type: rename `documento_url` → `documento_pessoal_url`, add `comprovante_residencia_url: string | null`

## Component Changes

### Remove from Checkout

- Remove `DocumentUpload` component from `CheckoutForm`
- Remove `uploadDocument` call from checkout submit flow
- Remove `documento` field from `createOrderSchema`
- Remove `clientVerified` state and `/api/client-check` call from checkout (dead code after this change)

### Confirmation Page (`/pedido/{id}/confirmacao`)

- Add reminder message: "Envie seus documentos na pagina de acompanhamento para agilizar a confirmacao do pedido"
- The existing "Acompanhar Pedido" button already links to the tracking page

### Tracking Page (`/pedido/{id}`)

New section for document uploads. Three states:

**`pendente`** — Yellow alert box:
- Message: "Envie seus documentos para confirmarmos seu pedido"
- Two upload slots (reuse `DocumentUpload` component):
  - "Documento pessoal" (RG, CNH) — JPG/PNG/PDF, max 5MB
  - "Comprovante de residencia" — JPG/PNG/PDF, max 5MB
- Single "Enviar documentos" button (requires both files selected)

**`enviado`** — Blue info box:
- Message: "Documentos enviados — aguardando verificacao"
- No re-upload option (admin must reject to allow re-upload — out of scope for MVP)

**`verificado`** — Green success box:
- Message: "Documentos verificados"

**Security:** Tracking page uses UUID-based secret URL pattern (existing design). Upload is only allowed when `documento_status === 'pendente'` — the server action rejects uploads in any other state.

### Admin Orders List (`/admin/pedidos`)

Each order card shows document status badge:
- `pendente` → yellow "Docs pendentes"
- `enviado` → blue "Docs enviados"
- `verificado` → green "Docs verificados"

### Admin Order Detail (`/admin/pedidos/{id}`)

DOCUMENTO section evolves:
- Shows both documents with thumbnails/links (signed URLs from Supabase Storage)
- "Verificar documentos" button (visible only when `documento_status = 'enviado'`)
- Verification updates: `documento_status` on pedido + `documento_verificado` fields on cliente

### Admin Status Actions

Status advancement buttons (Confirmar, Em preparo, etc.) disabled with message "Verifique os documentos primeiro" when `documento_status !== 'verificado'`.

## Server Actions

All server actions use the server-side Supabase client (`createClient()` from `@/lib/supabase/server`) which uses service role credentials. This bypasses RLS — no new RLS policies needed.

### New: `uploadDocuments(pedidoId, formData)`

- Guard: reject if `documento_status !== 'pendente'`
- Receives two files: documento_pessoal + comprovante_residencia (both required)
- Fetches the order to get `cliente_id`
- Uploads to Supabase Storage: `documentos/{clienteId}/pessoal` and `documentos/{clienteId}/residencia` (upsert: true — one set of docs per client)
- On partial failure (one upload succeeds, other fails): do NOT update status, return error, let customer retry both
- Updates `clientes.documento_pessoal_url` and `clientes.comprovante_residencia_url`
- Updates `pedidos.documento_status` to `enviado`

### Modified: `verifyDocument(clienteId, pedidoId)`

- Signature changes: now receives `pedidoId` in addition to `clienteId`
- Updates `pedidos.documento_status` to `verificado` for the specific order
- Updates `clientes.documento_verificado`, `documento_verificado_em`, `documento_verificado_por`

### Modified: `updateOrderStatus(pedidoId, newStatus)`

- Add guard: if advancing past `novo` and `documento_status !== 'verificado'`, throw error

### Modified: `getDocumentSignedUrl(clienteId, tipo)`

- Now accepts a `tipo` parameter (`pessoal` | `residencia`) to get signed URL for either document
- Storage paths: `{clienteId}/pessoal` and `{clienteId}/residencia`

### Removed: `uploadDocument(formData)`

- Delete the old single-document upload function from `actions.ts`

## Files Impacted by Column Rename (`documento_url` → `documento_pessoal_url`)

- `app/lib/types.ts` — `Cliente` type
- `app/lib/actions.ts` — `uploadDocument` function (being deleted)
- `app/lib/admin-actions.ts` — `getDocumentSignedUrl`, `verifyDocument`
- `app/components/admin/document-section.tsx` — `documentoUrl` prop
- `app/app/admin/(authenticated)/pedidos/[id]/page.tsx` — Supabase select query

## Production Error Fix

- Add error boundaries to Server Components (confirmation + tracking pages)
- Add null checks on Supabase query results
- Fix `pedido_itens` → `produtos` type mapping in tracking page
