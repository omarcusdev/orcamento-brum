-- Migration 021: add admin UPDATE/DELETE policies on pedido_itens
-- Settle consignado and edit pedido items (T14, T16) need these.

CREATE POLICY pedido_itens_update_admin ON pedido_itens
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY pedido_itens_delete_admin ON pedido_itens
  FOR DELETE
  USING (is_admin());
