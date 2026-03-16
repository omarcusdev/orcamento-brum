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
