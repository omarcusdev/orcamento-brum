-- Migration 020: admin operacional
-- - clientes.documento_pessoal_url -> documento_pessoal_urls (array, 1-2 items)
-- - pedido_itens: is_consignado, consignado_status (max 1 consignado per pedido, qty=1)
-- - pedido_edit_log table

-- Cliente: documento_pessoal_url -> documento_pessoal_urls
ALTER TABLE clientes ADD COLUMN documento_pessoal_urls TEXT[];

UPDATE clientes
SET documento_pessoal_urls = ARRAY[documento_pessoal_url]
WHERE documento_pessoal_url IS NOT NULL;

ALTER TABLE clientes
ADD CONSTRAINT documento_pessoal_urls_size
CHECK (
  documento_pessoal_urls IS NULL
  OR (array_length(documento_pessoal_urls, 1) BETWEEN 1 AND 2)
);

ALTER TABLE clientes DROP COLUMN documento_pessoal_url;

-- Pedido items: consignado
ALTER TABLE pedido_itens
  ADD COLUMN is_consignado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN consignado_status TEXT NULL
    CHECK (consignado_status IN ('pendente', 'usado', 'devolvido'));

ALTER TABLE pedido_itens
  ADD CONSTRAINT pedido_itens_consignado_status_when_consignado
  CHECK (is_consignado = false OR consignado_status IS NOT NULL);

ALTER TABLE pedido_itens
  ADD CONSTRAINT pedido_itens_consignado_qty_one
  CHECK (is_consignado = false OR quantidade = 1);

CREATE UNIQUE INDEX pedido_itens_um_consignado_por_pedido
  ON pedido_itens (pedido_id)
  WHERE is_consignado = true;

-- pedido_edit_log
CREATE TABLE pedido_edit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pedido_edit_log_pedido_id_idx
  ON pedido_edit_log(pedido_id, changed_at DESC);

ALTER TABLE pedido_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY pedido_edit_log_admin_select
  ON pedido_edit_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY pedido_edit_log_admin_insert
  ON pedido_edit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
