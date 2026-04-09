update pedidos set status = 'entregue' where status = 'aguardando_pagamento';
update pedidos set status = 'recolhido' where status = 'finalizado';

update pedido_status_log set status_anterior = 'entregue' where status_anterior = 'aguardando_pagamento';
update pedido_status_log set status_novo = 'entregue' where status_novo = 'aguardando_pagamento';
update pedido_status_log set status_anterior = 'recolhido' where status_anterior = 'finalizado';
update pedido_status_log set status_novo = 'recolhido' where status_novo = 'finalizado';

alter table pedidos drop constraint if exists pedidos_status_check;
alter table pedidos add constraint pedidos_status_check check (status in (
  'aguardando_documentos', 'confirmado',
  'enviar_para_entregador', 'em_rota', 'entregue',
  'pago', 'recolhido', 'cancelado'
));
