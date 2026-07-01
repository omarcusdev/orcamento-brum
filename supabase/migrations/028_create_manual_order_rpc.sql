create or replace function public.create_manual_order(
  p_cliente jsonb,
  p_pedido jsonb,
  p_itens jsonb,
  p_user uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_pedido_id uuid;
begin
  if p_cliente->>'kind' = 'existing' then
    v_cliente_id := (p_cliente->>'id')::uuid;
  else
    insert into clientes (nome, telefone, cpf, email)
    values (p_cliente->>'nome', p_cliente->>'telefone', p_cliente->>'cpf', p_cliente->>'email')
    returning id into v_cliente_id;
  end if;

  insert into pedidos (
    cliente_id, status, documento_status, endereco, endereco_completo,
    data_evento, horario_evento, tipo_chopeira, rampas_escadas, observacoes,
    subtotal, desconto, frete, total, metodo_pagamento, pago
  ) values (
    v_cliente_id, 'confirmado', 'pendente', p_pedido->>'endereco', nullif(p_pedido->'endereco_completo', 'null'::jsonb),
    (p_pedido->>'data_evento')::date, (p_pedido->>'horario_evento')::time, p_pedido->>'tipo_chopeira',
    p_pedido->>'rampas_escadas', p_pedido->>'observacoes',
    (p_pedido->>'subtotal')::numeric, (p_pedido->>'desconto')::numeric, (p_pedido->>'frete')::numeric,
    (p_pedido->>'total')::numeric, p_pedido->>'metodo_pagamento', (p_pedido->>'pago')::boolean
  ) returning id into v_pedido_id;

  insert into pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, subtotal, is_consignado, consignado_status)
  select v_pedido_id, (i->>'produto_id')::uuid, (i->>'quantidade')::int, (i->>'preco_unitario')::numeric,
         (i->>'subtotal')::numeric, (i->>'is_consignado')::boolean, (i->>'consignado_status')
  from jsonb_array_elements(p_itens) as i;

  insert into pedido_status_log (pedido_id, status_anterior, status_novo, changed_by)
  values (v_pedido_id, null, 'confirmado', p_user);

  return v_pedido_id;
end;
$$;

revoke all on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) to authenticated, service_role;
