-- FRE-23: lembrete de vespera (D-1) no WhatsApp.
-- pg_cron acorda /api/whatsapp/lembrete de hora em hora; a rota faz o trabalho em TS.

-- Extensoes (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Redefinir get_orders_needing_reminder: retorna LINHAS (mensagem montada em TS),
-- corrige o filtro de status (inclui enviar_para_entregador) e usa o fuso BR para "amanha".
-- drop antes do create porque a assinatura de retorno mudou.
drop function if exists get_orders_needing_reminder();

create or replace function get_orders_needing_reminder()
returns table(pedido_id uuid, nome text, telefone text, data_evento date, horario_evento time) as $$
begin
  return query
  select p.id, c.nome, c.telefone, p.data_evento, p.horario_evento
  from pedidos p
  join clientes c on c.id = p.cliente_id
  where p.status in ('confirmado', 'enviar_para_entregador')
    and p.data_evento = (now() at time zone 'America/Sao_Paulo')::date + 1
    and not exists (
      select 1 from mensagens_whatsapp mw
      where mw.pedido_id = p.id and mw.tipo = 'lembrete' and mw.status = 'enviada'
    );
end;
$$ language plpgsql security definer;

-- drop+create reseta os grants; re-revoga (a migracao 004 ja revogava esta funcao).
revoke execute on function get_orders_needing_reminder() from anon, authenticated;

-- Configs (default ligado/preenchido para a feature nascer funcional).
insert into configuracoes (chave, valor) values
  ('whatsapp_lembrete_vespera_ativo', 'true'),
  ('whatsapp_lembrete_vespera_hora',  '9'),
  ('whatsapp_lembrete_vespera_msg',   'Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!')
on conflict (chave) do nothing;

-- Agendamento horario, idempotente. URL e segredo vem do Vault (sem segredo na migracao).
-- Os secrets 'lembrete_route_url' e 'lembrete_cron_secret' sao inseridos manualmente por
-- ambiente: select vault.create_secret('<valor>', '<nome>');
select cron.unschedule('lembrete-vespera-d1')
where exists (select 1 from cron.job where jobname = 'lembrete-vespera-d1');

select cron.schedule('lembrete-vespera-d1', '0 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_route_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
