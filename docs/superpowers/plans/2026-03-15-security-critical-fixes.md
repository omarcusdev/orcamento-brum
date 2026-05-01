# Security Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/critical security vulnerabilities identified in the security audit before production deploy.

**Architecture:** Three layers of fixes: (1) WhatsApp API auth bypass, (2) Supabase migration for admin roles + RLS hardening + function security, (3) Next.js server action auth guards + server-side price validation.

**Tech Stack:** Supabase (PostgreSQL RLS, custom functions), Next.js Server Actions, Fastify (WhatsApp API), Zod (input validation)

---

## Chunk 1: WhatsApp API Auth Fixes

### Task 1: Fix auth middleware bypass + hardcoded key

**Files:**
- Modify: `whatsapp-api/src/routes.ts`

The auth middleware has two critical bugs:
1. Missing `return` after 401 response — handler continues executing for unauthorized requests
2. Fallback to hardcoded `"dev-api-key"` if env var is not set

- [ ] **Step 1: Fix authMiddleware — add return + remove fallback**

Replace the entire file content:

```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { sendMessage, getStatus } from "./baileys.js"

const API_KEY = process.env.WHATSAPP_API_KEY

if (!API_KEY) {
  throw new Error("WHATSAPP_API_KEY environment variable is required")
}

const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers["x-api-key"]
  if (apiKey !== API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" })
  }
}

const registerRoutes = (app: FastifyInstance) => {
  app.get("/status", { preHandler: authMiddleware }, async () => ({
    status: getStatus(),
    timestamp: new Date().toISOString(),
  }))

  app.post<{
    Body: { telefone: string; mensagem: string }
  }>("/send-message", { preHandler: authMiddleware }, async (request, reply) => {
    const { telefone, mensagem } = request.body

    if (!telefone || !mensagem) {
      return reply.code(400).send({ error: "telefone and mensagem are required" })
    }

    try {
      await sendMessage(telefone, mensagem)
      return { success: true, telefone }
    } catch {
      return reply.code(500).send({ error: "Failed to send message" })
    }
  })
}

export { registerRoutes }
```

Key changes:
- `return reply.code(401)` — prevents handler from continuing after rejection
- `throw new Error(...)` if `WHATSAPP_API_KEY` not set — no more hardcoded fallback
- `/status` now requires auth via `preHandler: authMiddleware`
- Proper Fastify types instead of `any`
- Error response sanitized (no `error.message` leak)

- [ ] **Step 2: Verify WhatsApp API starts correctly**

Run from `whatsapp-api/`:
```bash
WHATSAPP_API_KEY=test-key npm run dev
```
Expected: server starts. Without the env var, it should crash with "WHATSAPP_API_KEY environment variable is required".

- [ ] **Step 3: Commit**

```bash
git add whatsapp-api/src/routes.ts
git commit -m "fix(security): fix auth bypass in WhatsApp API middleware

Add return to authMiddleware, remove hardcoded fallback key,
protect /status endpoint, sanitize error responses."
```

---

## Chunk 2: Admin Role System + RLS Hardening (Migration)

### Task 2: Create migration 004_security_hardening

**Files:**
- Create: `supabase/migrations/004_security_hardening.sql`

Note: `003_configuracoes.sql` already exists, so this must be `004`.

This migration does four things:
1. Creates `admin_users` table to track which auth users are admins
2. Creates `is_admin()` helper function
3. Drops all overly permissive RLS policies and replaces with role-aware ones
4. Fixes SECURITY DEFINER functions (revoke direct access from public roles)

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- 004_security_hardening.sql
-- Fixes: admin roles, RLS policies, function access control
-- ============================================================

-- 1. ADMIN ROLE SYSTEM
-- -----------------------------------------------------------

create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

create policy "admin_users_select_self" on admin_users
  for select using (auth.uid() = user_id);

create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from admin_users where user_id = auth.uid()
  );
end;
$$ language plpgsql security definer;

-- Seed: promote existing admin user
insert into admin_users (user_id)
select id from auth.users where email = 'admin@alfachopp.com'
on conflict do nothing;


-- 2. RLS POLICY HARDENING — PRODUTOS
-- -----------------------------------------------------------

drop policy if exists "produtos_all_admin" on produtos;

create policy "produtos_insert_admin" on produtos
  for insert with check (is_admin());

create policy "produtos_update_admin" on produtos
  for update using (is_admin());

create policy "produtos_delete_admin" on produtos
  for delete using (is_admin());


-- 3. RLS POLICY HARDENING — CLIENTES
-- -----------------------------------------------------------

drop policy if exists "clientes_all_admin" on clientes;

create policy "clientes_select_admin" on clientes
  for select using (is_admin());

create policy "clientes_update_admin" on clientes
  for update using (is_admin());

create policy "clientes_delete_admin" on clientes
  for delete using (is_admin());


-- 4. RLS POLICY HARDENING — PEDIDOS
-- -----------------------------------------------------------

drop policy if exists "pedidos_select_admin" on pedidos;
drop policy if exists "pedidos_update_admin" on pedidos;
drop policy if exists "pedidos_select_by_id" on pedidos;

create policy "pedidos_select_admin" on pedidos
  for select using (is_admin());

create policy "pedidos_select_by_tracking" on pedidos
  for select using (true);

create policy "pedidos_update_admin" on pedidos
  for update using (is_admin());


-- 5. RLS POLICY HARDENING — PEDIDO_ITENS
-- -----------------------------------------------------------

drop policy if exists "pedido_itens_select" on pedido_itens;

create policy "pedido_itens_select_via_pedido" on pedido_itens
  for select using (
    exists (
      select 1 from pedidos where pedidos.id = pedido_itens.pedido_id
    )
  );


-- 6. RLS POLICY HARDENING — MENSAGENS_WHATSAPP
-- -----------------------------------------------------------

drop policy if exists "mensagens_whatsapp_all_admin" on mensagens_whatsapp;

create policy "mensagens_whatsapp_select_admin" on mensagens_whatsapp
  for select using (is_admin());

create policy "mensagens_whatsapp_insert_admin" on mensagens_whatsapp
  for insert with check (is_admin());

create policy "mensagens_whatsapp_update_admin" on mensagens_whatsapp
  for update using (is_admin());

create policy "mensagens_whatsapp_delete_admin" on mensagens_whatsapp
  for delete using (is_admin());


-- 7. RLS POLICY HARDENING — PEDIDO_STATUS_LOG
-- -----------------------------------------------------------

drop policy if exists "pedido_status_log_select_admin" on pedido_status_log;

create policy "pedido_status_log_select_admin" on pedido_status_log
  for select using (is_admin());

create policy "pedido_status_log_select_by_pedido" on pedido_status_log
  for select using (
    exists (
      select 1 from pedidos where pedidos.id = pedido_status_log.pedido_id
    )
  );


-- 8. FUNCTION ACCESS CONTROL
-- -----------------------------------------------------------
-- These functions legitimately need SECURITY DEFINER because they
-- are called by database triggers and pg_cron (no user context).
-- Restrict direct invocation by revoking EXECUTE from public roles.

revoke execute on function build_confirmation_message(uuid) from anon, authenticated;
revoke execute on function get_orders_needing_reminder() from anon, authenticated;
revoke execute on function register_whatsapp_message(uuid, text, text) from anon, authenticated;
```

**Design decisions explained:**

- `pedidos_select_by_tracking using (true)`: Kept public because the order tracking page (`/pedido/[id]/confirmacao`) needs access without auth. UUIDs are v4 (2^122 entropy) — enumeration is impractical. The page requires knowing the exact UUID.

- `pedido_itens_select_via_pedido`: Chains to the pedidos policy. You can only see items for orders you can access (either as admin or via direct UUID lookup).

- `pedido_status_log_select_by_pedido`: Same chaining — the order tracker shows the timeline, needs access.

- SECURITY DEFINER functions: They need DEFINER because triggers/cron run without user context. Instead of changing to INVOKER (which would break them), we REVOKE execute from anon/authenticated so users can't call them directly.

- `is_admin()` uses SECURITY DEFINER so it can read admin_users regardless of caller's RLS context.

- [ ] **Step 2: Apply migration to Supabase**

```bash
cd supabase && npx supabase db push
```

Expected: migration applies without errors.

- [ ] **Step 3: Verify admin user is in admin_users table**

```bash
npx supabase db execute "select * from admin_users;"
```

Expected: one row with the admin user UUID (`b067edbd-d4bd-47d5-be48-3699b86c66e0`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_security_hardening.sql
git commit -m "fix(security): add admin roles, harden RLS policies, restrict function access

Create admin_users table + is_admin() function.
Replace authenticated-only policies with admin-only for mutations.
Chain pedido_itens/status_log reads through pedidos policy.
Revoke direct invocation of SECURITY DEFINER functions."
```

---

## Chunk 3: Server Action Auth Guards + Price Validation

### Task 3: Create requireAdmin helper

**Files:**
- Create: `app/lib/auth.ts`

A reusable function that verifies the current user is an admin. Used by all admin server actions.

- [ ] **Step 1: Create auth helper**

```typescript
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const requireAdmin = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin")
  }

  const { data: adminRecord } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .single()

  if (!adminRecord) {
    throw new Error("Acesso negado")
  }

  return { user, supabase }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/auth.ts
git commit -m "feat(security): add requireAdmin helper for server actions"
```

---

### Task 4: Add auth guards to admin-actions.ts

**Files:**
- Modify: `app/lib/admin-actions.ts`

Every admin server action must verify the caller is an admin before mutating data.

- [ ] **Step 1: Replace admin-actions.ts with guarded version**

```typescript
"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"

const statusOrder = [
  "novo",
  "aguardando_pagamento",
  "confirmado",
  "em_rota",
  "entregue",
  "recolhido",
  "finalizado",
] as const

export const advanceOrderStatus = async (pedidoId: string, currentStatus: string) => {
  const { supabase } = await requireAdmin()
  const currentIndex = statusOrder.indexOf(currentStatus as typeof statusOrder[number])

  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    throw new Error("Status invalido para avanco")
  }

  const nextStatus = statusOrder[currentIndex + 1]

  const { error } = await supabase
    .from("pedidos")
    .update({ status: nextStatus })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")

  return { status: nextStatus }
}

export const cancelOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const markAsPaid = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ pago: true })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

export const createProduct = async (formData: FormData) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("produtos").insert({
    marca: formData.get("marca") as string,
    descricao: (formData.get("descricao") as string) || null,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo") as string,
  })

  if (error) throw error
  revalidatePath("/admin/catalogo")
}

export const updateProduct = async (id: string, formData: FormData) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("produtos").update({
    marca: formData.get("marca") as string,
    descricao: (formData.get("descricao") as string) || null,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo") as string,
  }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
}

export const toggleProductActive = async (id: string, ativo: boolean) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
}
```

Key change: every function now starts with `const { supabase } = await requireAdmin()` instead of `const supabase = await createClient()`.

- [ ] **Step 2: Verify admin panel still works**

Start the app (`npm run dev` in `app/`), log in as admin@alfachopp.com, navigate to Pedidos and Catalogo. Verify:
- Order status advance works
- Product creation/editing works
- Marking as paid works

- [ ] **Step 3: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "fix(security): add admin auth guards to all admin server actions"
```

---

### Task 5: Fix server-side price validation in createOrder

**Files:**
- Modify: `app/lib/actions.ts`

Currently `createOrder` accepts `preco_unitario` from the client and uses it directly. An attacker can set any price via DevTools. The fix: ignore the client-provided price and fetch the real price from the database.

- [ ] **Step 1: Replace actions.ts with price-validated version**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"

type CreateOrderInput = {
  nome: string
  telefone: string
  email?: string
  data_evento: string
  horario_evento: string
  endereco: string
  observacoes?: string
  tipo_chopeira: "gelo" | "eletrica"
  metodo_pagamento: "pix" | "cartao" | "dinheiro"
  items: { produto_id: string; quantidade: number }[]
}

export const createOrder = async (input: CreateOrderInput) => {
  const supabase = await createClient()

  if (!input.items.length) {
    throw new Error("Pedido deve ter pelo menos um item")
  }

  const productIds = input.items.map((item) => item.produto_id)
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, preco_avista, ativo")
    .in("id", productIds)

  if (productsError || !products) {
    throw new Error("Erro ao buscar produtos")
  }

  const priceMap = new Map(products.map((p) => [p.id, p]))

  for (const item of input.items) {
    const product = priceMap.get(item.produto_id)
    if (!product) throw new Error("Produto nao encontrado")
    if (!product.ativo) throw new Error("Produto indisponivel")
    if (item.quantidade < 1) throw new Error("Quantidade invalida")
  }

  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefone", input.telefone)
    .single()

  let clienteId: string

  if (existingClient) {
    clienteId = existingClient.id
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clientes")
      .insert({ nome: input.nome, telefone: input.telefone, email: input.email || null })
      .select("id")
      .single()

    if (clientError || !newClient) throw new Error("Erro ao criar cliente")
    clienteId = newClient.id
  }

  const itemsWithServerPrice = input.items.map((item) => {
    const serverPrice = priceMap.get(item.produto_id)!.preco_avista
    return {
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: serverPrice,
      subtotal: serverPrice * item.quantidade,
    }
  })

  const subtotal = itemsWithServerPrice.reduce((sum, item) => sum + item.subtotal, 0)

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      endereco: input.endereco,
      data_evento: input.data_evento,
      horario_evento: input.horario_evento,
      observacoes: input.observacoes || null,
      tipo_chopeira: input.tipo_chopeira,
      metodo_pagamento: input.metodo_pagamento,
      subtotal,
      total: subtotal,
    })
    .select("id")
    .single()

  if (pedidoError || !pedido) throw new Error("Erro ao criar pedido")

  const itemsToInsert = itemsWithServerPrice.map((item) => ({
    ...item,
    pedido_id: pedido.id,
  }))

  const { error: itensError } = await supabase.from("pedido_itens").insert(itemsToInsert)

  if (itensError) throw new Error("Erro ao criar itens do pedido")

  return { pedidoId: pedido.id }
}
```

Key changes:
- `CreateOrderInput.items` no longer includes `preco_unitario` — only `produto_id` and `quantidade`
- Server fetches real prices from `produtos` table
- Validates product exists and is active
- Validates quantity is positive
- Validates at least one item
- Calculates subtotal/total from server-side prices

- [ ] **Step 2: Update checkout-form.tsx to stop sending price**

In `app/components/checkout-form.tsx`, change the items mapping (around line 92-96):

```typescript
// Before:
items: items.map((item) => ({
  produto_id: item.produto.id,
  quantidade: item.quantidade,
  preco_unitario: item.produto.preco_avista,
})),

// After:
items: items.map((item) => ({
  produto_id: item.produto.id,
  quantidade: item.quantidade,
})),
```

- [ ] **Step 3: Verify checkout flow**

1. Add products to cart
2. Go to checkout, fill form, submit
3. Verify order is created with correct server-side prices
4. Verify confirmation page loads

- [ ] **Step 4: Commit**

```bash
git add app/lib/actions.ts app/components/checkout-form.tsx
git commit -m "fix(security): validate prices server-side in createOrder

Fetch product prices from database instead of trusting client input.
Validate products exist, are active, and quantities are positive."
```

---

## Verification Checklist

After all tasks are complete, verify end-to-end:

- [ ] **V1: WhatsApp API rejects requests without valid API key**
  Run: `curl -X POST http://localhost:3001/send-message -H "Content-Type: application/json" -d '{"telefone":"123","mensagem":"test"}'`
  Expected: 401 Unauthorized

- [ ] **V2: WhatsApp API rejects requests with wrong key**
  Run: `curl -X POST http://localhost:3001/send-message -H "x-api-key: wrong" -H "Content-Type: application/json" -d '{"telefone":"123","mensagem":"test"}'`
  Expected: 401 Unauthorized

- [ ] **V3: Admin panel requires admin role, not just authentication**
  Verify by checking Supabase RLS: a non-admin authenticated user should get empty results for `produtos` mutations.

- [ ] **V4: Order tracking page still works for customers**
  Navigate to `/pedido/[valid-uuid]/confirmacao` without being logged in.
  Expected: order details visible (items, timeline).

- [ ] **V5: Price cannot be manipulated**
  In DevTools, modify localStorage cart prices to R$0.01. Submit checkout.
  Expected: order is created with real server prices, not the manipulated ones.

- [ ] **V6: Non-admin can't access admin actions**
  Try calling `advanceOrderStatus` without admin session.
  Expected: redirect to `/admin` login or "Acesso negado" error.

- [ ] **V7: Admin can still perform all actions after migration**
  Log in as admin@alfachopp.com. Verify:
  - Can view orders list
  - Can advance order status
  - Can create/edit products
  - Can mark order as paid
  Expected: all admin operations work normally.

- [ ] **V8: WhatsApp API accepts valid requests**
  Run: `curl -X POST http://localhost:3001/send-message -H "x-api-key: $WHATSAPP_API_KEY" -H "Content-Type: application/json" -d '{"telefone":"5521999999999","mensagem":"test"}'`
  Expected: 200 with `{ success: true }`
