-- WhatsApp feature flags (liga/desliga). Default LIGADO para preservar comportamento atual.
insert into configuracoes (chave, valor) values
  ('whatsapp_confirmacao_ativo', 'true'),
  ('whatsapp_atendimento_ativo', 'true'),
  ('whatsapp_alerta_ativo', 'true')
on conflict (chave) do nothing;
