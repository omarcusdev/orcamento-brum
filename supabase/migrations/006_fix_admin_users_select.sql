drop policy if exists "admin_users_select_self" on admin_users;

create policy "admin_users_select_authenticated" on admin_users
  for select using (auth.role() = 'authenticated');
