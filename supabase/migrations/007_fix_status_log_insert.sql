create policy "pedido_status_log_insert_on_update" on pedido_status_log
  for insert with check (is_admin());
