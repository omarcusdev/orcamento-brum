-- FRE-22: avisar status de entrega no WhatsApp.
-- Feature master + flag por status + mensagens editaveis. Default LIGADO/preenchido.
insert into configuracoes (chave, valor) values
  ('whatsapp_status_entrega_ativo', 'true'),
  ('whatsapp_status_em_rota_ativo', 'true'),
  ('whatsapp_status_entregue_ativo', 'true'),
  ('whatsapp_status_cancelado_ativo', 'true'),
  ('whatsapp_status_recolhido_ativo', 'true'),
  ('whatsapp_status_em_rota_msg', 'Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚 — ALFA Chopp Delivery'),
  ('whatsapp_status_entregue_msg', 'Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento! — ALFA Chopp Delivery'),
  ('whatsapp_status_cancelado_msg', 'Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante. — ALFA Chopp Delivery'),
  ('whatsapp_status_recolhido_msg', 'Recolhemos tudo certinho! 🍺 Valeu demais pela parceria, {nome}. Bora repetir! — ALFA Chopp Delivery')
on conflict (chave) do nothing;

-- Permitir os novos tipos de mensagem de status no log mensagens_whatsapp.
alter table mensagens_whatsapp drop constraint mensagens_whatsapp_tipo_check;
alter table mensagens_whatsapp add constraint mensagens_whatsapp_tipo_check
  check (tipo in ('confirmacao', 'lembrete', 'status_em_rota', 'status_entregue', 'status_cancelado', 'status_recolhido'));
