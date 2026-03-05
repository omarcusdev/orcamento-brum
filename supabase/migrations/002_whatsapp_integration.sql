create or replace function build_confirmation_message(pedido_id uuid)
returns text as $$
declare
  pedido record;
  items_text text := '';
  item record;
begin
  select p.*, c.nome, c.telefone
  into pedido
  from pedidos p
  join clientes c on c.id = p.cliente_id
  where p.id = pedido_id;

  for item in
    select pi.quantidade, pr.marca, pr.volume_litros
    from pedido_itens pi
    join produtos pr on pr.id = pi.produto_id
    where pi.pedido_id = build_confirmation_message.pedido_id
  loop
    items_text := items_text || item.quantidade || 'x ' || item.marca || ' ' || item.volume_litros || 'L, ';
  end loop;

  items_text := rtrim(items_text, ', ');

  return 'Ola ' || pedido.nome || '! Seu pedido #' || left(pedido_id::text, 8) ||
    ' foi recebido. ' || items_text || '. Evento em ' ||
    to_char(pedido.data_evento, 'DD/MM/YYYY') || ' as ' ||
    to_char(pedido.horario_evento, 'HH24:MI') || '.';
end;
$$ language plpgsql security definer;

create or replace function get_orders_needing_reminder()
returns table(pedido_id uuid, telefone text, mensagem text) as $$
begin
  return query
  select p.id, c.telefone,
    'Ola ' || c.nome || '! Lembrete: amanha (' ||
    to_char(p.data_evento, 'DD/MM/YYYY') || ') as ' ||
    to_char(p.horario_evento, 'HH24:MI') ||
    ' entregaremos seu chopp em ' || p.endereco || '.' as mensagem
  from pedidos p
  join clientes c on c.id = p.cliente_id
  where p.status = 'confirmado'
    and p.data_evento = current_date + interval '1 day'
    and not exists (
      select 1 from mensagens_whatsapp mw
      where mw.pedido_id = p.id and mw.tipo = 'lembrete' and mw.status = 'enviada'
    );
end;
$$ language plpgsql security definer;

create or replace function register_whatsapp_message(
  p_pedido_id uuid,
  p_tipo text,
  p_status text default 'pendente'
)
returns uuid as $$
declare
  msg_id uuid;
begin
  insert into mensagens_whatsapp (pedido_id, tipo, status, enviada_em)
  values (p_pedido_id, p_tipo, p_status, case when p_status = 'enviada' then now() else null end)
  returning id into msg_id;
  return msg_id;
end;
$$ language plpgsql security definer;
