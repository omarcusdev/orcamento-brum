create table entregadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table entregadores enable row level security;
create policy "entregadores_all_admin" on entregadores for all using (auth.role() = 'authenticated');
create policy "entregadores_select_public" on entregadores for select using (true);

alter table pedidos add column frete numeric(10,2) not null default 0;
alter table pedidos add column rampas_escadas text;
alter table pedidos add column entregador_id uuid references entregadores(id);

alter table pedidos drop constraint if exists pedidos_status_check;
alter table pedidos add constraint pedidos_status_check check (status in (
  'aguardando_documentos', 'aguardando_pagamento', 'confirmado',
  'enviar_para_entregador', 'em_rota', 'entregue',
  'recolhido', 'finalizado', 'cancelado'
));

create index idx_pedidos_entregador_id on pedidos(entregador_id);
create index idx_entregadores_ativo on entregadores(ativo);
