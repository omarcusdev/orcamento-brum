-- 030_whatsapp_midia.sql
-- WhatsApp inbound media (Workstream B, Task B1): media columns on
-- mensagens_conversa_whatsapp, register_inbound_whatsapp recreated to accept + store media
-- metadata, a private Storage bucket for the bytes, and a list-view efficiency fix for the
-- Task A2 "sistema" flag (folded in from code review).

-- 1. Media columns on mensagens_conversa_whatsapp. Nullable: most messages carry no media.
--    midia_path is the object path inside the new whatsapp-media bucket (bytes live in
--    Storage, not Postgres); mime_type is the raw content-type reported by WhatsApp.
alter table mensagens_conversa_whatsapp
  add column if not exists midia_tipo text check (midia_tipo in ('image', 'audio', 'video', 'document', 'sticker')),
  add column if not exists midia_path text,
  add column if not exists mime_type text;

-- 2. register_inbound_whatsapp — RPC SIGNATURE TRAP: Postgres treats a different parameter
--    COUNT as a distinct overload, not a replacement. `create or replace` alone on the new
--    10-arg signature would leave migration 022's 7-arg function callable side-by-side (no
--    media support, and its own revoke would no longer describe the live callable surface).
--    Drop the old overload explicitly first.
drop function if exists register_inbound_whatsapp(text, uuid, text, text, text, text, timestamptz);

-- Same upsert-conversa / de-dupe-insert / bump-aggregates logic as migration 022, plus 3 new
-- trailing media params (defaulted so existing non-media callers keep working unchanged).
create or replace function register_inbound_whatsapp(
  p_telefone text,
  p_cliente_id uuid,
  p_nome text,
  p_wa_message_id text,
  p_direcao text,
  p_corpo text,
  p_ocorrida_em timestamptz,
  p_midia_tipo text default null,
  p_midia_path text default null,
  p_mime_type text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  conv_id uuid;
  msg_id uuid;
begin
  if p_wa_message_id is null or p_wa_message_id = '' then
    raise exception 'wa_message_id is required';
  end if;

  insert into conversas_whatsapp (telefone, cliente_id, nome_exibicao)
  values (p_telefone, p_cliente_id, p_nome)
  on conflict (telefone) do update set
    cliente_id    = coalesce(excluded.cliente_id, conversas_whatsapp.cliente_id),
    nome_exibicao = coalesce(excluded.nome_exibicao, conversas_whatsapp.nome_exibicao)
  returning id into conv_id;

  insert into mensagens_conversa_whatsapp
    (conversa_id, wa_message_id, direcao, corpo, ocorrida_em, midia_tipo, midia_path, mime_type)
  values
    (conv_id, p_wa_message_id, p_direcao, p_corpo, p_ocorrida_em, p_midia_tipo, p_midia_path, p_mime_type)
  on conflict (wa_message_id) do nothing
  returning id into msg_id;

  -- Duplicate (echo/reentrega): conversa already upserted, do not double-count.
  if msg_id is null then
    return conv_id;
  end if;

  update conversas_whatsapp set
    nao_lidas               = nao_lidas + case when p_direcao = 'entrada' then 1 else 0 end,
    ultima_mensagem_preview = case
                                when p_ocorrida_em >= coalesce(ultima_mensagem_em, p_ocorrida_em) then left(p_corpo, 120)
                                else ultima_mensagem_preview
                              end,
    ultima_mensagem_em      = greatest(coalesce(ultima_mensagem_em, p_ocorrida_em), p_ocorrida_em)
  where id = conv_id;

  return conv_id;
end;
$$;

-- SECURITY DEFINER bypassa RLS: só o service role pode chamar (padrão da migration 004/022).
-- Re-issued for the NEW 10-arg signature — the revoke tied to the dropped 7-arg one went with it.
revoke execute on function register_inbound_whatsapp(text, uuid, text, text, text, text, timestamptz, text, text, text) from anon, authenticated;

-- 3. Private Storage bucket for inbound media bytes. RLS admin-only, mirroring how `documentos`
--    is used (service-role upload from the app route bypasses RLS entirely; these policies gate
--    any access through the authenticated/dashboard path). NOTE: the `documentos` bucket and its
--    storage.objects policies were never checked into a migration — they were created out-of-band
--    on prod (staging is missing them entirely; see pending-cleanup notes). There is no migration
--    text to literally copy, so this mirrors the codebase's own is_admin()-gated CRUD convention
--    (identical shape to migration 022's table policies), applied to storage.objects and scoped
--    to this bucket only.
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict do nothing;

drop policy if exists "whatsapp_media_select_admin" on storage.objects;
drop policy if exists "whatsapp_media_insert_admin" on storage.objects;
drop policy if exists "whatsapp_media_update_admin" on storage.objects;
drop policy if exists "whatsapp_media_delete_admin" on storage.objects;

create policy "whatsapp_media_select_admin" on storage.objects
  for select using (bucket_id = 'whatsapp-media' and public.is_admin());
create policy "whatsapp_media_insert_admin" on storage.objects
  for insert with check (bucket_id = 'whatsapp-media' and public.is_admin());
create policy "whatsapp_media_update_admin" on storage.objects
  for update using (bucket_id = 'whatsapp-media' and public.is_admin());
create policy "whatsapp_media_delete_admin" on storage.objects
  for delete using (bucket_id = 'whatsapp-media' and public.is_admin());

-- 4. Efficiency fix (code review, Important finding on Task A2): getConversas() fetched EVERY
--    message's direcao+corpo over PostgREST (mensagens_conversa_whatsapp(direcao, corpo) embed)
--    just to reduce a single boolean client-side (isConversaSistema in chat-actions.ts). That
--    ships full message bodies to the browser on every list render/realtime refresh purely to
--    compute a flag. Move the computation into Postgres instead: one boolean column, no message
--    bodies leave the DB for this purpose. Mirrors TRANSBORDO_MARKERS
--    (app/lib/whatsapp/transbordo.ts) — keep both in sync if the markers ever change.
--    security_invoker=true so conversas_whatsapp / mensagens_conversa_whatsapp RLS (is_admin())
--    still applies to callers of the view, exactly as if they queried the tables directly.
create or replace view conversas_whatsapp_lista
with (security_invoker = true)
as
select
  c.*,
  (
    exists (
      select 1 from mensagens_conversa_whatsapp m where m.conversa_id = c.id
    )
    and not exists (
      select 1 from mensagens_conversa_whatsapp m
      where m.conversa_id = c.id and m.direcao = 'entrada'
    )
    and not exists (
      select 1 from mensagens_conversa_whatsapp m
      where m.conversa_id = c.id
        and not (m.corpo like '%AVISO DE TRANSBORDO%' and m.corpo like '%Anotei aqui%')
    )
  ) as sistema
from conversas_whatsapp c;
