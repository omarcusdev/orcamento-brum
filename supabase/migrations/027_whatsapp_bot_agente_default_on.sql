-- Atendente automático (IA, FRE-25 etapa 2) passa a vir LIGADO por padrão, junto com as
-- demais auto-features. O agente é "primeiro": quando ligado, ele assume o turno e suprime a
-- saudação automática (esta vira fallback pra quando o agente estiver desligado).
--
-- ⚠️ ORDEM NO GO-LIVE (FRE-21): o agente SÓ responde com o Bedrock provisionado (envs
-- AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION). Se esta migration for aplicada em
-- prod ANTES de provisionar o Bedrock, o agente fica em silêncio E suprime a saudação ->
-- o cliente não recebe nada. Em prod: provisionar o Bedrock PRIMEIRO, depois aplicar isto.
--
-- O gate em código segue fail-closed (config ausente/erro -> OFF); a FAQ tem default no código.
-- Idempotente e não-destrutivo: só semeia se a chave ainda não existir.
insert into configuracoes (chave, valor)
values ('whatsapp_bot_agente_ativo', 'true')
on conflict (chave) do nothing;
