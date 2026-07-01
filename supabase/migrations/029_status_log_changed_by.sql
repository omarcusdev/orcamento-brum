-- The pedidos_status_log trigger left changed_by NULL, so revertOrderStatus added its own explicit
-- pedido_status_log insert (with changed_by) — double-logging every revert (one NULL row from the
-- trigger + one attributed row from the app). Populate changed_by from auth.uid() in the trigger
-- instead: exactly one log row per status change, with the acting admin captured on ALL paths
-- (advance / cancel / dispatch / revert). All status-change UPDATEs run through the auth-aware
-- Supabase client, so auth.uid() resolves to the admin inside the trigger. The redundant app-side
-- insert in revertOrderStatus is removed in the same change.
create or replace function log_pedido_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into pedido_status_log (pedido_id, status_anterior, status_novo, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql;
