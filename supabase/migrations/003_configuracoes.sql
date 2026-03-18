create table if not exists configuracoes (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

insert into configuracoes (chave, valor) values
  ('whatsapp_numero', '5521999999999')
on conflict (chave) do nothing;

alter table configuracoes enable row level security;

create policy "Qualquer um pode ler configuracoes" on configuracoes for select using (true);
create policy "Admin pode atualizar configuracoes" on configuracoes for update using (true);
