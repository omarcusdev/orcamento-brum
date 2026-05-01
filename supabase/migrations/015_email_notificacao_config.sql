-- Adiciona configurações default pra notificação por email a cada novo pedido.
-- Lidas em runtime por sendNewOrderEmail() em app/lib/email.ts.

insert into configuracoes (chave, valor) values
  ('email_notificacao_destinatario', 'huno.cfo@gmail.com'),
  ('email_notificacao_ativo', 'true')
on conflict (chave) do nothing;
