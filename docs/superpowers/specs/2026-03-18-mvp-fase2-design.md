# MVP Fase 2 — Design Spec

## Overview

Three features requested by client for ALFA Chopp Delivery MVP:

1. **Delivery area validation** — Google Places Autocomplete + radius + exclusion polygons
2. **Identity document verification** — photo upload in checkout, admin verification, client-linked via CPF
3. **Customizable landing page content** — all landing texts editable via admin + product photo upload

## Current State

- Stack: Next.js 15, React 19, Tailwind v4, Framer Motion, Supabase (PostgreSQL, Auth, Storage, RLS)
- Tables: `produtos`, `clientes` (nome, telefone, email), `pedidos`, `pedido_itens`, `pedido_status_log`, `mensagens_whatsapp`, `configuracoes`
- Client lookup currently by `telefone` (unique) — changing to `cpf`
- `configuracoes` table exists (key-value, used for `whatsapp_numero`)
- `produtos.foto_url` column exists but currently uses static files in `/public/products/`
- Admin panel: login, orders list, order detail, catalog management, config page

---

## Feature 1: Delivery Area Validation

### Checkout — Address Autocomplete

- Replace free-text `endereco` field with Google Places Autocomplete
- On selection, auto-populate: rua, numero, bairro, cidade, estado, cep, lat, lng
- Separate free-text field for `complemento` (apartment, block, etc)
- After selection, validate server-side before order creation:
  - Haversine distance from configured center point
  - Point-in-polygon check against all exclusion zones
  - If outside radius OR inside any exclusion zone → reject with "Infelizmente não atendemos essa região"

### Admin — Area Configuration

- New page: `/admin/configuracoes/area-entrega`
- Google Maps JS API with:
  - Draggable marker for center point
  - Visual circle for radius (adjustable via numeric input in km)
  - `DrawingManager` for creating exclusion polygons
  - Sidebar list of exclusion zones with remove button per zone
- Persist to: `configuracoes` (raio_km, centro_lat, centro_lng) + `zonas_exclusao` table

### Schema Changes

```sql
-- New keys in configuracoes (existing table)
-- raio_km (e.g., "50")
-- centro_lat (e.g., "-22.9068")
-- centro_lng (e.g., "-43.1729")

create table zonas_exclusao (
  id uuid primary key default gen_random_uuid(),
  nome text,
  poligono jsonb not null,  -- [{lat: number, lng: number}, ...]
  created_at timestamptz default now()
);

alter table zonas_exclusao enable row level security;
create policy "zonas_exclusao_select_public" on zonas_exclusao for select using (true);
create policy "zonas_exclusao_all_admin" on zonas_exclusao for all using (auth.role() = 'authenticated');
```

### Address Storage on Orders

- Expand `pedidos` table:

```sql
alter table pedidos add column endereco_completo jsonb;
-- { rua, numero, bairro, cidade, estado, cep, complemento, lat, lng }
```

- Keep existing `endereco` text column as display string (formatted from components)
- `endereco_completo` stores structured data for future use (routing, analytics)

### Validation (Server-Side)

- Haversine formula in Server Action `createOrder`:
  - `d = 2R * arcsin(sqrt(sin²((φ₂-φ₁)/2) + cos(φ₁)cos(φ₂)sin²((λ₂-λ₁)/2)))`
  - If `d > raio_km` → reject
- Point-in-polygon (ray casting algorithm):
  - For each exclusion zone, check if address point is inside polygon
  - If inside any zone → reject

### API Configuration

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var (client-side, restricted by domain in Google Console)
- APIs enabled: Maps JavaScript API, Places API
- Estimated cost: ~$2.83/1000 autocomplete requests ($200/month free credit covers ~70k requests)

---

## Feature 2: Identity Document Verification

### Client Identification Change: Telefone → CPF

- Add `cpf` column to `clientes` (unique, not null for new clients)
- Checkout form gains CPF field with digit validation (mod 11 algorithm)
- Client lookup on order creation: search by CPF instead of telefone
- Telefone remains as contact field (needed for WhatsApp), not as identifier

### Checkout — Document Upload

- New field: "Documento de identidade (RG ou CNH)"
- If client found by CPF and `documento_verificado = true` → skip upload, show green badge "Documento verificado"
- If not verified → dropzone: click or drag to upload
  - Accepts: JPG, PNG, PDF
  - Max size: 5MB
  - Shows image preview after selection
- Upload happens on form submit, before order creation

### Admin — Document Verification

- Order detail page (`/admin/pedidos/[id]`) gains "Documento do cliente" section:
  - Clickable thumbnail (opens in modal or new tab via signed URL)
  - "Verificar documento" button → sets `documento_verificado = true` on client
  - If already verified → green "Verificado" badge with date
- Orders list: visual indicator for orders with pending document verification

### Schema Changes

```sql
alter table clientes add column cpf text unique;
alter table clientes add column documento_url text;
alter table clientes add column documento_verificado boolean default false;
alter table clientes add column documento_verificado_em timestamptz;
alter table clientes add column documento_verificado_por uuid references admin_users(user_id);
```

### Supabase Storage

- Bucket: `documentos` (private)
- Path: `documentos/{cliente_id}/documento.{ext}`
- Access: signed URLs (60-second expiry) generated by Server Action for admin viewing
- RLS: admin-only access

### Server Actions

- `verifyDocument(clienteId)` — requires admin, updates verification fields
- Upload integrated into `createOrder` flow — if client has no verified doc, upload file to Storage before creating order

### Checkout Form Schema Update

```typescript
// additions to createOrderSchema
cpf: z.string().refine(validateCpf, "CPF inválido"),
documento: z.instanceof(File).optional(),
// documento required if client not yet verified (validated in action, not schema)
```

---

## Feature 3: Customizable Landing Page Content

### Architecture: Hybrid Storage

- **Simple values** → `configuracoes` table (existing): whatsapp_numero, raio_km, centro_lat, centro_lng
- **Rich content** → new `conteudo_pagina` table (JSONB per section)

### Schema Changes

```sql
create table conteudo_pagina (
  secao text primary key,  -- 'hero', 'features', 'faq', 'footer'
  dados jsonb not null,
  updated_at timestamptz default now()
);

alter table conteudo_pagina enable row level security;
create policy "conteudo_pagina_select_public" on conteudo_pagina for select using (true);
create policy "conteudo_pagina_all_admin" on conteudo_pagina for all using (auth.role() = 'authenticated');
```

### JSONB Structure Per Section

**hero:**
```json
{
  "titulo": "Chopp Gelado no Seu Evento",
  "subtitulo": "Delivery de chopp para festas e eventos no RJ e Baixada",
  "cta_texto": "Peça Agora",
  "cta_whatsapp_texto": "Fale no WhatsApp"
}
```

**features:**
```json
{
  "items": [
    { "titulo": "Entrega Rápida", "descricao": "Entregamos no dia do evento", "icone": "truck" }
  ]
}
```

**faq:**
```json
{
  "items": [
    { "pergunta": "Como funciona a entrega?", "resposta": "Entregamos no local..." }
  ]
}
```

**footer:**
```json
{
  "texto": "ALFA Chopp Delivery © 2026",
  "links": [
    { "label": "Instagram", "url": "https://instagram.com/alfachopp" }
  ]
}
```

### Admin — Content Editor

- New page: `/admin/conteudo`
- Accordion or tabs per section (Hero, Features, FAQ, Footer)
- Simple form fields (inputs, textareas) — no rich text editor
- FAQ: dynamic list with "Adicionar pergunta" / remove buttons
- Features: dynamic list with "Adicionar" / remove buttons
- Save per section independently

### Admin — Product Photo Upload

- Product form (create/edit in `/admin/catalogo`) gains image upload field
- Upload to Supabase Storage bucket `produtos` (public)
- Path: `produtos/{produto_id}.{ext}`
- `foto_url` updated to point to Storage public URL
- Thumbnail preview in form (shows current image if editing)

### Landing Page — Reading Content

- `page.tsx` fetches sections via `getConteudo(secao)` query
- Fallback: if no content in DB, use current hardcoded texts (zero-downtime migration)
- Each component (Hero, Features, FAQ, Footer) receives dynamic props
- Content cached via Next.js ISR or `revalidatePath` on admin save

### Supabase Storage Buckets

- `produtos` — **public** (product images visible to everyone)
- `documentos` — **private** (signed URLs, admin only)

---

## Migration Strategy

Single migration file: `004_fase2.sql`

1. Create `zonas_exclusao` table
2. Create `conteudo_pagina` table
3. Alter `clientes`: add cpf, documento_url, documento_verificado, documento_verificado_em, documento_verificado_por
4. Alter `pedidos`: add endereco_completo (jsonb)
5. Seed `configuracoes` with raio_km, centro_lat, centro_lng defaults
6. Seed `conteudo_pagina` with current hardcoded content as defaults
7. Create Storage buckets: documentos (private), produtos (public)
8. RLS policies for new tables

## Environment Variables

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps/Places API key (client-side)

## Dependencies

- `@googlemaps/js-api-loader` or `@react-google-maps/api` — Google Maps React wrapper
- No other new dependencies expected

## Testing Reminders

- **Delivery area validation**: test center point, radius boundary, inside/outside exclusion zones, edge cases near polygon borders, mobile behavior
- **Document upload**: test file size limits, file type validation, signed URL expiry, re-upload flow
- **Content editor**: test empty states, long texts, special characters, FAQ add/remove, content fallback
