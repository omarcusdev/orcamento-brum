UPDATE pedidos SET status = 'confirmado' WHERE status = 'aguardando_documentos';

UPDATE pedido_status_log SET status_anterior = 'confirmado' WHERE status_anterior = 'aguardando_documentos';
UPDATE pedido_status_log SET status_novo = 'confirmado' WHERE status_novo = 'aguardando_documentos';

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check CHECK (status IN (
  'confirmado', 'enviar_para_entregador', 'em_rota', 'entregue',
  'pago', 'recolhido', 'cancelado'
));
