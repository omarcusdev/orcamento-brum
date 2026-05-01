-- Add tables to the supabase_realtime publication so the order-tracking
-- screen (components/order-tracker.tsx) receives live UPDATE/INSERT events.
-- Without this, client subscriptions reach SUBSCRIBED state but never fire.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table pedidos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedido_status_log'
  ) then
    alter publication supabase_realtime add table pedido_status_log;
  end if;
end $$;
