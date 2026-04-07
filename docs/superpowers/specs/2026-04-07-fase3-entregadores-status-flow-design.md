# Fase 3 — Entregadores, Status Flow & Checkout Updates

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Same contract (R$21k). WhatsApp automation out of scope (last deliverable).

## Context

Client (Jean / ALFA Chopp) requested changes after initial deployment. Key needs:
- Expanded order status flow matching real-world delivery operations
- Driver management and assignment system
- Dispatch summary with copy-to-clipboard (manual WhatsApp bridge until bot is ready)
- Missing checkout fields that affect delivery logistics
- Frete (delivery fee) as a separate admin-managed field

## 1. Expanded Order Status Flow

### Current Flow
```
aguardando_documentos → aguardando_pagamento → confirmado → em_rota → entregue → recolhido → finalizado
```

### New Flow
```
aguardando_documentos → confirmado → enviar_para_entregador → em_rota → entregue → aguardando_pagamento → recolhido → finalizado
```

Plus `cancelado` available at any stage before `finalizado`.

### Changes from Current
- **Removed:** `aguardando_pagamento` as second status
- **Added:** `enviar_para_entregador` between `confirmado` and `em_rota`
- **Moved:** `aguardando_pagamento` to after `entregue` (most clients pay on delivery)

### Status Gates
- `aguardando_documentos → confirmado`: Documents must be verified (existing rule, unchanged)
- `confirmado → enviar_para_entregador`: Admin must select a driver from the dropdown (new gate)
- All other transitions: simple status advancement button (existing behavior)

### Affected Files
- `app/lib/types.ts` — `PedidoStatus` type union
- `app/components/order-status-badge.tsx` — colors/labels for new statuses
- `app/components/admin/status-actions.tsx` — flow order, gates, next-status logic
- `app/components/admin/status-filter.tsx` — filter options in orders list
- `app/components/admin/orders-list.tsx` — filter logic
- `app/lib/admin-actions.ts` — `advanceOrderStatus` server action
- `supabase/migrations/` — new migration to update status enum/check constraints

### Migration Strategy
Existing orders in `aguardando_pagamento` status need to be handled. Since the status still exists (just moved position), no data migration is needed — only the flow order changes in application code.

## 2. Entregadores Module

### Database Schema

New `entregadores` table:
```sql
create table entregadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
```

New column on `pedidos`:
```sql
alter table pedidos add column entregador_id uuid references entregadores(id);
```

RLS: Admin-only access (same pattern as existing admin tables).

### Admin UI — `/admin/entregadores`

Single page with:
- Table listing all drivers: nome, telefone (WhatsApp), status (ativo/inativo), edit action
- "Adicionar" button opens a modal with nome + telefone fields
- Edit via same modal pattern (click edit icon on row)
- Toggle ativo/inativo inline (switch or button)
- Only `ativo` drivers appear in the dispatch dropdown on order detail

### Server Actions
- `createEntregador(nome, telefone)` — add driver
- `updateEntregador(id, nome, telefone, ativo)` — edit driver
- `toggleEntregadorAtivo(id)` — quick toggle

### Validation
- `nome`: required, min 2 characters
- `telefone`: required, Brazilian phone format

## 3. Driver Assignment + Dispatch Summary

### Interaction Flow

When order status is `confirmado` and admin clicks "Enviar para Entregador":

1. A **dispatch modal** opens containing:
   - **Driver dropdown** — lists only `ativo` entregadores (nome + telefone)
   - **Formatted dispatch summary** — read-only preview of order details
   - **"Copiar e Confirmar"** button — copies summary to clipboard, assigns driver, advances status
   - **"Cancelar"** button — closes modal without changes

2. On confirm:
   - `pedidos.entregador_id` is set to selected driver
   - `pedidos.status` advances to `enviar_para_entregador`
   - Dispatch text is copied to clipboard
   - Status log entry is created (existing trigger)

### Dispatch Summary Template
```
📍 Data do evento: {data_evento formatted DD/MM/YYYY}
◼ Quantidade de Barris: {items list — qty x marca volume}
◼ Preferência de Chopeira: {tipo_chopeira}
◼ Responsável: {cliente.nome}
◼ Contato: {cliente.telefone}
◼ Município: {endereco_completo.cidade}
◼ Bairro: {endereco_completo.bairro}
◼ Endereço: {endereco_completo.rua}, {endereco_completo.numero} {complemento}
◼ Rampas/Escadas: {rampas_escadas ? detalhes : "Não"}
◼ Valor: R$ {subtotal formatted}
◼ Frete: R$ {frete formatted}
◼ Forma de pagamento: {metodo_pagamento}
◼ Observações: {observacoes || "—"}
```

### Server Action
- `dispatchToEntregador(pedidoId, entregadorId)` — validates status is `confirmado`, assigns driver, advances status

### Order Detail Page Changes
- When order has `entregador_id`, show assigned driver info (nome + telefone) in the order detail
- Display in a section between status actions and order items

## 4. Checkout Form — New Fields

### Chopeira Preference
- **Field:** `tipo_chopeira` (already exists in DB as `gelo | eletrica`)
- **UI:** Two radio-style cards with icons — Elétrica (⚡) / Gelo (🧊)
- **Placement:** "Evento" section, after date/time pickers
- **Required:** Yes
- **Change:** Remove hardcoded "gelo" default; customer must choose

### Rampas ou Escadas
- **Field:** `rampas_escadas` (new, text, nullable)
- **UI:** Two radio buttons — Sim / Não
  - If "Sim": text input appears for details (e.g., "3º andar sem elevador")
  - If "Não": field value is null
- **Placement:** "Endereço" section, after complement field
- **Required:** The yes/no selection is required. Details text is required only if "Sim"

### Database
```sql
alter table pedidos add column rampas_escadas text;
```

### Schema Changes
- `app/lib/schemas.ts` — add `rampas_escadas` to checkout schema, update `tipo_chopeira` to be required (remove default)
- `app/lib/types.ts` — add `rampas_escadas` to `Pedido` type
- `app/components/checkout-form.tsx` — add both field UIs

## 5. Frete Field

### Database
```sql
alter table pedidos add column frete numeric not null default 0;
```

### Admin Order Detail
- New editable input in the pricing section (between desconto and total)
- Shows "R$" prefix with numeric input
- **Editable** when status is before `enviar_para_entregador`
- **Read-only** after dispatch
- Total recalculates: `subtotal - desconto + frete`

### Total Calculation
When frete is updated, `pedidos.total` is recomputed as `subtotal - desconto + frete` and saved to DB. This keeps the total field as the source of truth (consistent with current behavior where total = subtotal - desconto).

### Server Action
- `updateFrete(pedidoId, valor)` — validates admin auth, validates status, updates frete AND recalculates total

### Checkout Impact
- None — frete is admin-only. Customer sees subtotal at checkout.
- The total shown to the customer does NOT include frete (it's set later by admin).

## 6. Out of Scope

- WhatsApp automation (bot not deployed — last part of contract)
- Customer tracking page changes (existing page auto-reflects new statuses via badge component)
- Driver-facing interface (no login, no app)
- Delivery route optimization
- Commission tracking for drivers
- Web push notifications

## Implementation Order

Incremental, each step independently deployable:

1. **DB migration** — new statuses, entregadores table, new columns (frete, rampas_escadas, entregador_id)
2. **Status flow update** — types, badge, status-actions, filters, admin-actions
3. **Entregadores CRUD** — admin page with modal add/edit
4. **Dispatch modal** — driver assignment + summary + clipboard on order detail
5. **Checkout updates** — chopeira preference + rampas/escadas fields
6. **Frete field** — admin editable field on order detail with total recalculation
