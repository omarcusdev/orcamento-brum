-- 032_create_manual_order_reuse_client.sql
-- FIX: create_manual_order 23505 duplicate-client crash on MANUAL orders.
--
-- Root cause (reproduced on PROD, rolled back): the "new" client branch did a plain
--   insert into clientes (nome, telefone, cpf, email)
-- with zero conflict handling. A repeat customer whose telefone (NOT NULL UNIQUE
-- clientes_telefone_key) -- or cpf when supplied (UNIQUE clientes_cpf_key) -- already
-- existed threw 23505, rolling back the whole SECURITY DEFINER transaction. The caller
-- re-threw, and Next.js prod masked the uncaught Server Action throw as the generic
-- "An error occurred in the Server Components render" red box.
--
-- In a delivery business a repeat phone == the same person, so the fix REUSES the existing
-- client instead of erroring. Match strategy (justified by the audited data: clientes.telefone
-- stores BOTH bare-digit '21999999999' AND masked '(21) 99999-9999' forms -- 124 bare / 34
-- masked in prod -- so a RAW-string compare both MISSES same-person/different-format dups and
-- still 23505s on identical-format ones):
--   1) telefone: match on telefone_digits (GENERATED ALWAYS STORED, indexed
--      idx_clientes_telefone_digits) vs the digits of the incoming telefone. Any raw
--      clientes_telefone_key collision has identical digits, so this is a strict superset of
--      that unique constraint -- every case that used to throw is now caught.
--   2) cpf: match on digit-normalized cpf on BOTH sides, ONLY when a non-empty cpf was
--      supplied. nullif(...,'') guards empty/garbage cpf from matching another blank cpf.
--   Precedence telefone-first: telefone is always present (NOT NULL + the form's submit gate),
--   cpf is optional/often blank on manual orders, and clientes_telefone_key is the constraint
--   that actually fires. Reuse is NON-DESTRUCTIVE: identity fields (nome/telefone/cpf) are
--   never overwritten; only a previously-NULL email is filled (safe enrichment).
--   Blank/garbage cpf is normalized to NULL on insert (clientes_cpf_key allows many NULLs).
-- DB-only hotfix (same pattern as consignado migration 031): no app redeploy required to stop
-- the crash. The pedido/itens/status_log body below is preserved verbatim from migration 028.

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
  v_pedido_id  uuid;
  v_tel_digits text := regexp_replace(coalesce(p_cliente->>'telefone', ''), '[^0-9]', '', 'g');
  v_cpf_digits text := nullif(regexp_replace(coalesce(p_cliente->>'cpf', ''), '[^0-9]', '', 'g'), '');
begin
  if p_cliente->>'kind' = 'existing' then
    v_cliente_id := (p_cliente->>'id')::uuid;
  else
    -- 1) Reuse by phone (digit-normalized; matches masked and bare-digit variants of one person).
    if v_tel_digits <> '' then
      select id into v_cliente_id
      from clientes
      where telefone_digits = v_tel_digits
      order by created_at
      limit 1;
    end if;

    -- 2) Else reuse by CPF, only when a real (non-empty) CPF was supplied.
    if v_cliente_id is null and v_cpf_digits is not null then
      select id into v_cliente_id
      from clientes
      where regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = v_cpf_digits
      order by created_at
      limit 1;
    end if;

    if v_cliente_id is null then
      -- 3) No existing client -> insert. Concurrency-safe: a racing insert that trips either
      --    unique constraint is caught and re-resolved to the row the other transaction created,
      --    instead of aborting the whole manual order.
      begin
        insert into clientes (nome, telefone, cpf, email)
        values (
          p_cliente->>'nome',
          p_cliente->>'telefone',            -- raw as typed; telefone_digits mirror is generated
          v_cpf_digits,                      -- normalized; NULL when blank/garbage (no '' unique clash)
          nullif(p_cliente->>'email', '')
        )
        returning id into v_cliente_id;
      exception when unique_violation then
        -- Lost the race (or a format-identical dup slipped in between select and insert):
        -- re-find the now-existing client and reuse it rather than crashing.
        if v_tel_digits <> '' then
          select id into v_cliente_id
          from clientes
          where telefone_digits = v_tel_digits
          order by created_at
          limit 1;
        end if;
        if v_cliente_id is null and v_cpf_digits is not null then
          select id into v_cliente_id
          from clientes
          where regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = v_cpf_digits
          order by created_at
          limit 1;
        end if;
        if v_cliente_id is null then
          raise;  -- genuinely unexpected (e.g. not-null/check); let it surface
        end if;
      end;
    else
      -- Non-destructive enrichment: fill a previously-missing email only. Never overwrite an
      -- existing name / phone / cpf / non-null email.
      update clientes
      set email = nullif(p_cliente->>'email', '')
      where id = v_cliente_id
        and email is null
        and nullif(p_cliente->>'email', '') is not null;
    end if;
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

-- Preserve the migration-028 grant surface (SECURITY DEFINER: keep off anon/public).
revoke all on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_manual_order(jsonb, jsonb, jsonb, uuid) to authenticated, service_role;
