-- Saudação automática (FRE-25 etapa 1) passa a vir LIGADA por padrão, consistente com
-- confirmação/status de entrega/lembrete, que já nascem ligados (migrations 023/024/025).
-- O gate em código continua fail-closed (erro de leitura da config -> não saúda); isto apenas
-- define o valor inicial da flag. A janela (24h) e a mensagem têm default no código (módulo puro),
-- então só a flag precisa ser semeada.
-- Idempotente e não-destrutivo: só insere se a chave ainda não existir (preserva o que o
-- operador já tiver escolhido).
insert into configuracoes (chave, valor)
values ('whatsapp_bot_saudacao_ativo', 'true')
on conflict (chave) do nothing;
