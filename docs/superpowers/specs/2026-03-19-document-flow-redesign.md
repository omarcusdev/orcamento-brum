# Document Flow Redesign — Spec

## Problem

1. The checkout form requires document upload, creating friction that loses potential customers.
2. Production error: Server Components render error when placing orders.
3. Only one document type supported; business needs both personal document and proof of residence.

## Solution

Move document upload from checkout to the order tracking page. Customers place orders without documents (zero friction), then upload documents at their own pace on the tracking page. Admin verifies documents before advancing the order.

## Flow

```
Checkout (no documents) → Confirmation → Tracking page (upload documents here)
```

### Customer Journey

1. Customer browses catalog, adds items to cart
2. Fills checkout form (name, CPF, phone, email, address, date, time, payment method)
3. Submits order — no documents required
4. Redirected to confirmation page (success message)
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

### `pedidos` table

Add column:
- `documento_status text not null default 'pendente'` — values: `pendente`, `enviado`, `verificado`

### `clientes` table

Evolve existing columns:
- Rename `documento_url` → `documento_pessoal_url`
- Add `comprovante_residencia_url text`
- Keep `documento_verificado`, `documento_verificado_em`, `documento_verificado_por` (now mean "both docs verified")

### Constraint

Order status cannot advance past `novo` unless `documento_status = 'verificado'`. Enforced at application level (admin status action buttons disabled).

## Component Changes

### Remove from Checkout

- Remove `DocumentUpload` component from `CheckoutForm`
- Remove `uploadDocument` call from checkout submit flow
- Remove `documento` field from `createOrderSchema`

### Tracking Page (`/pedido/{id}`)

New section for document uploads. Three states:

**`pendente`** — Yellow alert box:
- Message: "Envie seus documentos para confirmarmos seu pedido"
- Two upload slots (reuse `DocumentUpload` component):
  - "Documento pessoal" (RG, CNH) — JPG/PNG/PDF, max 5MB
  - "Comprovante de residencia" — JPG/PNG/PDF, max 5MB
- Single "Enviar documentos" button

**`enviado`** — Blue info box:
- Message: "Documentos enviados — aguardando verificacao"

**`verificado`** — Green success box:
- Message: "Documentos verificados"

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

### New: `uploadDocuments(pedidoId, formData)`

- Receives two files: documento_pessoal + comprovante_residencia
- Uploads to Supabase Storage: `documentos/{clienteId}/pessoal` and `documentos/{clienteId}/residencia`
- Updates `clientes.documento_pessoal_url` and `clientes.comprovante_residencia_url`
- Updates `pedidos.documento_status` to `enviado`

### Modified: `verifyDocument(clienteId)`

- Now also updates `pedidos.documento_status` to `verificado` for the relevant order
- Updates `clientes.documento_verificado`, `documento_verificado_em`, `documento_verificado_por`

### Modified: `updateOrderStatus(pedidoId, newStatus)`

- Add guard: if advancing past `novo` and `documento_status !== 'verificado'`, throw error

### Modified: `getDocumentSignedUrl(clienteId)`

- Now accepts a `tipo` parameter (`pessoal` | `residencia`) to get signed URL for either document

## Production Error Fix

- Add error boundaries to Server Components (confirmation + tracking pages)
- Add null checks on Supabase query results
- Fix `pedido_itens` → `produtos` type mapping in tracking page

## Migration

Single migration file: `004_document_flow.sql`

```sql
alter table pedidos add column documento_status text not null default 'pendente';
alter table clientes rename column documento_url to documento_pessoal_url;
alter table clientes add column comprovante_residencia_url text;
```

Existing orders get `documento_status = 'pendente'` by default.
