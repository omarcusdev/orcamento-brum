-- Rename status 'novo' to 'aguardando_documentos'
-- Every new order starts awaiting document verification

-- 1. Drop the old check constraint
alter table pedidos drop constraint if exists pedidos_status_check;

-- 2. Update existing rows
update pedidos set status = 'aguardando_documentos' where status = 'novo';

-- 3. Update the default
alter table pedidos alter column status set default 'aguardando_documentos';

-- 4. Add new check constraint with updated values
alter table pedidos add constraint pedidos_status_check check (status in (
  'aguardando_documentos', 'aguardando_pagamento', 'confirmado', 'em_rota',
  'entregue', 'recolhido', 'finalizado', 'cancelado'
));

-- 5. Update any existing status log entries
update pedido_status_log set status_anterior = 'aguardando_documentos' where status_anterior = 'novo';
update pedido_status_log set status_novo = 'aguardando_documentos' where status_novo = 'novo';
