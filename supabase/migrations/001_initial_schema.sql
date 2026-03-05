create extension if not exists "pgcrypto";

create table produtos (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  descricao text,
  volume_litros int not null check (volume_litros in (30, 50)),
  preco_avista numeric(10,2) not null,
  preco_cartao numeric(10,2),
  tipo text not null default 'chopp' check (tipo in ('chopp', 'vinho')),
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,
  email text,
  created_at timestamptz not null default now()
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  status text not null default 'novo' check (status in (
    'novo', 'aguardando_pagamento', 'confirmado', 'em_rota',
    'entregue', 'recolhido', 'finalizado', 'cancelado'
  )),
  endereco text not null,
  data_evento date not null,
  horario_evento time not null,
  observacoes text,
  tipo_chopeira text not null default 'gelo' check (tipo_chopeira in ('gelo', 'eletrica')),
  subtotal numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  metodo_pagamento text check (metodo_pagamento in ('pix', 'cartao', 'dinheiro')),
  pago boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create table pedido_status_log (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

create table mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('confirmacao', 'lembrete')),
  enviada_em timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'enviada', 'falha'))
);

create index idx_pedidos_status on pedidos(status);
create index idx_pedidos_data_evento on pedidos(data_evento);
create index idx_pedidos_cliente_id on pedidos(cliente_id);
create index idx_pedido_itens_pedido_id on pedido_itens(pedido_id);
create index idx_mensagens_whatsapp_pedido_id on mensagens_whatsapp(pedido_id);
create index idx_clientes_telefone on clientes(telefone);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pedidos_updated_at
  before update on pedidos
  for each row execute function update_updated_at();

create or replace function log_pedido_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into pedido_status_log (pedido_id, status_anterior, status_novo)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger pedidos_status_log
  after update on pedidos
  for each row execute function log_pedido_status_change();

alter table produtos enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pedido_status_log enable row level security;
alter table mensagens_whatsapp enable row level security;

create policy "produtos_select_public" on produtos for select using (true);
create policy "produtos_all_admin" on produtos for all using (auth.role() = 'authenticated');

create policy "clientes_all_admin" on clientes for all using (auth.role() = 'authenticated');
create policy "clientes_insert_anon" on clientes for insert with check (true);

create policy "pedidos_select_admin" on pedidos for select using (auth.role() = 'authenticated');
create policy "pedidos_insert_anon" on pedidos for insert with check (true);
create policy "pedidos_update_admin" on pedidos for update using (auth.role() = 'authenticated');
create policy "pedidos_select_by_id" on pedidos for select using (true);

create policy "pedido_itens_select" on pedido_itens for select using (true);
create policy "pedido_itens_insert_anon" on pedido_itens for insert with check (true);

create policy "pedido_status_log_select_admin" on pedido_status_log for select using (auth.role() = 'authenticated');

create policy "mensagens_whatsapp_all_admin" on mensagens_whatsapp for all using (auth.role() = 'authenticated');
