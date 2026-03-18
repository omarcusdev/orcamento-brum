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
- `admin_users` table exists (created manually in Supabase dashboard, not in migration chain)

### Known RLS Limitation

All admin-only write policies use `auth.role() = 'authenticated'` rather than checking against `admin_users`. This works because only the admin has a Supabase Auth account. If customer-facing auth is ever added, all these policies must be tightened. This applies to existing tables and all new tables in this spec.

---

## Feature 1: Delivery Area Validation

### Checkout — Address Autocomplete

- Replace free-text `endereco` field with Google Places Autocomplete
- On selection, auto-populate: rua, numero, bairro, cidade, estado, cep, lat, lng
- Separate free-text field for `complemento` (apartment, block, etc)
- **Client-side pre-validation**: immediately after address selection, run Haversine + point-in-polygon in JS to give instant feedback ("Atendemos sua região!" or "Infelizmente não atendemos essa região") before the user fills the rest of the form
- **Server-side authoritative validation** in `createOrder` Server Action (same checks, cannot be bypassed)
- **Fallback**: if Google Places API fails to load (key issue, quota, network), show manual text input for address. Delivery area validation is skipped (admin reviews manually)

### Admin — Area Configuration

- New page: `/admin/configuracoes/area-entrega`
- Google Maps JS API with:
  - Draggable marker for center point
  - Visual circle for radius (adjustable via numeric input in km)
  - `DrawingManager` for creating exclusion polygons
  - Sidebar list of exclusion zones with remove button per zone
- Persist to: `configuracoes` (raio_km, centro_lat, centro_lng) + `zonas_exclusao` table
- `revalidatePath("/")` and `revalidatePath("/checkout")` on save

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

- Add `cpf` column to `clientes` (unique, nullable for existing rows — enforced as required in Zod schema for new orders)
- Checkout form gains CPF field with digit validation (mod 11 algorithm)
- Client lookup on order creation: search by CPF instead of telefone
- Telefone remains as contact field (needed for WhatsApp), not as identifier

### Anonymous Client Lookup via CPF

The `createOrder` Server Action runs with the anon Supabase key. Currently there is no anonymous SELECT policy on `clientes`. To enable CPF lookup:

```sql
create policy "clientes_select_by_cpf" on clientes
  for select using (true)
  with check (true);
-- Scoped in application code: only select id, documento_verificado where cpf matches
```

Alternative: use service role client for the client lookup/upsert portion of `createOrder`. Given that `pedidos` already has a public SELECT policy and the data exposed (id + verificado boolean) is not sensitive, the anon SELECT policy is acceptable.

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
alter table clientes add column documento_verificado_por uuid;
```

Note: `documento_verificado_por` is a plain uuid (no FK to `admin_users` since that table is not in the migration chain). Application code sets it from the authenticated user's ID.

### Supabase Storage

- Bucket: `documentos` (private)
- Path: `documentos/{cliente_id}/documento` (no extension — use `upsert: true` to overwrite on re-upload, Content-Type header handles format)
- Access: signed URLs (60-second expiry) generated by Server Action for admin viewing
- RLS: admin-only access

### Server Actions

- `verifyDocument(clienteId)` — requires admin, updates verification fields
- Upload integrated into `createOrder` flow — if client has no verified doc, upload file to Storage before creating order

### Checkout Form Schema Update

```typescript
// additions to createOrderSchema
cpf: z.string().refine(validateCpf, "CPF invalido"),
// documento is NOT in the Zod schema — extracted from FormData separately
// and validated manually (type check: jpg/png/pdf, size check: max 5MB)
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

create trigger conteudo_pagina_updated_at
  before update on conteudo_pagina
  for each row execute function update_updated_at();
```

### JSONB Structure Per Section

**hero:**
```json
{
  "titulo": "Chopp Gelado no Seu Evento",
  "subtitulo": "Delivery de chopp para festas e eventos no RJ e Baixada",
  "cta_texto": "Peca Agora",
  "cta_whatsapp_texto": "Fale no WhatsApp"
}
```

**features:**
```json
{
  "items": [
    { "titulo": "Entrega Rapida", "descricao": "Entregamos no dia do evento", "icone": "truck" }
  ]
}
```

Icon mapping: fixed set of Lucide icon keys (truck, clock, beer, shield, etc.) mapped to Lucide React components via lookup object. Admin selects from dropdown of available icons.

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
  "texto": "ALFA Chopp Delivery 2026",
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
- Features: dynamic list with "Adicionar" / remove buttons, icon dropdown
- Save per section independently
- `revalidatePath("/")` on save

### Admin — Product Photo Upload

- Product form (create/edit in `/admin/catalogo`) gains image upload field
- Upload to Supabase Storage bucket `produtos` (public)
- Path: `produtos/{produto_id}` (fixed path, no extension — `upsert: true` overwrites on re-upload, Content-Type header handles format)
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

1. Fix existing `configuracoes` RLS: drop permissive UPDATE policy, add admin-only INSERT/UPDATE/DELETE
2. Add anonymous SELECT policy on `clientes` (for CPF lookup)
3. Create `zonas_exclusao` table with RLS
4. Create `conteudo_pagina` table with RLS + `updated_at` trigger
5. Alter `clientes`: add cpf, documento_url, documento_verificado, documento_verificado_em, documento_verificado_por
6. Alter `pedidos`: add endereco_completo (jsonb)
7. Seed `configuracoes` with raio_km (50), centro_lat (-22.9068), centro_lng (-43.1729) defaults
8. Seed `conteudo_pagina` with current hardcoded content as defaults
9. Create Storage buckets via Supabase dashboard or CLI: `documentos` (private), `produtos` (public)

## TypeScript Updates

- `CreateOrderInput`: add `cpf` field, replace `endereco` string with structured address fields
- Add `Cliente` type with new columns (cpf, documento_url, documento_verificado, etc.)
- Add `ZonaExclusao` type
- Add `ConteudoPagina` type with per-section JSONB types
- Update `Pedido` type with `endereco_completo`

## Environment Variables

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps/Places API key (client-side)

## Dependencies

- `@react-google-maps/api` — Google Maps React wrapper (includes Places, DrawingManager)
- `lucide-react` — icon library for dynamic feature icons (if not already installed)

## Testing Reminders

- **Delivery area validation**: test center point, radius boundary, inside/outside exclusion zones, edge cases near polygon borders, mobile behavior, Google API failure fallback
- **Document upload**: test file size limits, file type validation, signed URL expiry, re-upload flow, CPF lookup for returning clients
- **Content editor**: test empty states, long texts, special characters, FAQ add/remove, content fallback when DB is empty
