-- 022_whatsapp_conversas.sql
-- WhatsApp atendimento inbox (v1 "chat solto"): per-contact conversations + messages.
-- No retention job in v1 (deferred — see spec "Gates de produção").

create table if not exists conversas_whatsapp (
  id                      uuid primary key default gen_random_uuid(),
  telefone                text not null unique,          -- E.164
  cliente_id              uuid references clientes(id) on delete set null,
  nome_exibicao           text,                          -- snapshot do nome (null = "sem cadastro")
  ultima_mensagem_em      timestamptz,
  ultima_mensagem_preview text,
  nao_lidas               int not null default 0,
  created_at              timestamptz not null default now()
);

create table if not exists mensagens_conversa_whatsapp (
  id            uuid primary key default gen_random_uuid(),
  conversa_id   uuid not null references conversas_whatsapp(id) on delete cascade,
  wa_message_id text unique,                              -- de-dupe (echo + reentrega)
  direcao       text not null check (direcao in ('entrada','saida')),
  corpo         text not null,
  ocorrida_em   timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_mensagens_conversa on mensagens_conversa_whatsapp (conversa_id, ocorrida_em);
create index if not exists idx_conversas_ultima on conversas_whatsapp (ultima_mensagem_em desc nulls last);

-- RLS: admin-only (mirror of mensagens_whatsapp, migration 004). Service role bypasses RLS.
alter table conversas_whatsapp enable row level security;
alter table mensagens_conversa_whatsapp enable row level security;

create policy "conversas_whatsapp_select_admin" on conversas_whatsapp for select using (is_admin());
create policy "conversas_whatsapp_insert_admin" on conversas_whatsapp for insert with check (is_admin());
create policy "conversas_whatsapp_update_admin" on conversas_whatsapp for update using (is_admin());
create policy "conversas_whatsapp_delete_admin" on conversas_whatsapp for delete using (is_admin());

create policy "mensagens_conversa_whatsapp_select_admin" on mensagens_conversa_whatsapp for select using (is_admin());
create policy "mensagens_conversa_whatsapp_insert_admin" on mensagens_conversa_whatsapp for insert with check (is_admin());
create policy "mensagens_conversa_whatsapp_update_admin" on mensagens_conversa_whatsapp for update using (is_admin());
create policy "mensagens_conversa_whatsapp_delete_admin" on mensagens_conversa_whatsapp for delete using (is_admin());

-- Realtime (mirror of migration 014).
alter publication supabase_realtime add table conversas_whatsapp;
alter publication supabase_realtime add table mensagens_conversa_whatsapp;

-- Upsert conversa + insert message (de-duped) + bump aggregates only on a real insert.
create or replace function register_inbound_whatsapp(
  p_telefone text,
  p_cliente_id uuid,
  p_nome text,
  p_wa_message_id text,
  p_direcao text,
  p_corpo text,
  p_ocorrida_em timestamptz
) returns uuid as $$
declare
  conv_id uuid;
  msg_id uuid;
begin
  insert into conversas_whatsapp (telefone, cliente_id, nome_exibicao)
  values (p_telefone, p_cliente_id, p_nome)
  on conflict (telefone) do update set
    cliente_id    = coalesce(excluded.cliente_id, conversas_whatsapp.cliente_id),
    nome_exibicao = coalesce(excluded.nome_exibicao, conversas_whatsapp.nome_exibicao)
  returning id into conv_id;

  insert into mensagens_conversa_whatsapp (conversa_id, wa_message_id, direcao, corpo, ocorrida_em)
  values (conv_id, p_wa_message_id, p_direcao, p_corpo, p_ocorrida_em)
  on conflict (wa_message_id) do nothing
  returning id into msg_id;

  -- Duplicate (echo/reentrega): conversa already upserted, do not double-count.
  if msg_id is null then
    return conv_id;
  end if;

  update conversas_whatsapp set
    ultima_mensagem_em      = greatest(coalesce(ultima_mensagem_em, p_ocorrida_em), p_ocorrida_em),
    ultima_mensagem_preview = left(p_corpo, 120),
    nao_lidas               = nao_lidas + case when p_direcao = 'entrada' then 1 else 0 end
  where id = conv_id;

  return conv_id;
end;
$$ language plpgsql security definer;
