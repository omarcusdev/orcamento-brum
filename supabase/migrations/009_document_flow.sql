alter table pedidos add column documento_status text not null default 'pendente'
  constraint pedidos_documento_status_check check (documento_status in ('pendente', 'enviado', 'verificado'));

alter table clientes rename column documento_url to documento_pessoal_url;
alter table clientes add column comprovante_residencia_url text;
