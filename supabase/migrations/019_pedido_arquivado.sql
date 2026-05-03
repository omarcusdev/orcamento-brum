alter table pedidos
  add column arquivado_em timestamptz;

create index idx_pedidos_arquivado_em on pedidos(arquivado_em);
create index idx_pedidos_arquivado_em_status_updated on pedidos(arquivado_em, status, updated_at);
