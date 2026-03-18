drop policy if exists "Admin pode atualizar configuracoes" on configuracoes;
create policy "configuracoes_insert_admin" on configuracoes for insert with check (is_admin());
create policy "configuracoes_update_admin" on configuracoes for update using (is_admin());
create policy "configuracoes_delete_admin" on configuracoes for delete using (is_admin());

alter table clientes add column cpf text unique;
alter table clientes add column documento_url text;
alter table clientes add column documento_verificado boolean default false;
alter table clientes add column documento_verificado_em timestamptz;
alter table clientes add column documento_verificado_por uuid;

alter table pedidos add column endereco_completo jsonb;

create table zonas_exclusao (
  id uuid primary key default gen_random_uuid(),
  nome text,
  poligono jsonb not null,
  created_at timestamptz default now()
);

alter table zonas_exclusao enable row level security;
create policy "zonas_exclusao_select_public" on zonas_exclusao for select using (true);
create policy "zonas_exclusao_insert_admin" on zonas_exclusao for insert with check (is_admin());
create policy "zonas_exclusao_update_admin" on zonas_exclusao for update using (is_admin());
create policy "zonas_exclusao_delete_admin" on zonas_exclusao for delete using (is_admin());

create table conteudo_pagina (
  secao text primary key,
  dados jsonb not null,
  updated_at timestamptz default now()
);

alter table conteudo_pagina enable row level security;
create policy "conteudo_pagina_select_public" on conteudo_pagina for select using (true);
create policy "conteudo_pagina_insert_admin" on conteudo_pagina for insert with check (is_admin());
create policy "conteudo_pagina_update_admin" on conteudo_pagina for update using (is_admin());
create policy "conteudo_pagina_delete_admin" on conteudo_pagina for delete using (is_admin());

create trigger conteudo_pagina_updated_at
  before update on conteudo_pagina
  for each row execute function update_updated_at();

insert into configuracoes (chave, valor) values
  ('raio_km', '50'),
  ('centro_lat', '-22.9068'),
  ('centro_lng', '-43.1729')
on conflict (chave) do nothing;

insert into conteudo_pagina (secao, dados) values
  ('hero', '{"titulo": "Chopp gelado no seu evento", "subtitulo": "Delivery de chopp para festas e eventos no Rio de Janeiro e Baixada Fluminense.", "cta_texto": "Ver Catalogo", "cta_whatsapp_texto": "WhatsApp"}'::jsonb),
  ('features', '{"titulo": "Por que escolher a ALFA?", "subtitulo": "Tudo que voce precisa para seu evento, sem complicacao", "items": [{"titulo": "Chopp Gelado Garantido", "descricao": "Qualidade premium para seu evento. Consulte opcoes de equipamento pelo WhatsApp.", "icone": "beer"}, {"titulo": "Entrega e Retirada", "descricao": "Entregamos e recolhemos o equipamento. Voce so aproveita a festa.", "icone": "truck"}, {"titulo": "Assistencia no Evento", "descricao": "Oferecemos suporte tecnico durante seu evento, caso necessario.", "icone": "wrench"}, {"titulo": "Precos Promocionais", "descricao": "Condicoes especiais para pagamento a vista via Pix ou dinheiro.", "icone": "dollar-sign"}]}'::jsonb),
  ('faq', '{"titulo": "Perguntas Frequentes", "subtitulo": "Tire suas duvidas sobre nosso servico", "items": [{"pergunta": "Qual a area de entrega?", "resposta": "Entregamos em quase todo o Rio de Janeiro e Baixada Fluminense. Consulte disponibilidade para sua regiao."}, {"pergunta": "Preciso providenciar algo alem do chopp?", "resposta": "Entre em contato pelo WhatsApp para saber o que esta incluso no seu pedido."}, {"pergunta": "Quais formas de pagamento?", "resposta": "Aceitamos Pix, cartao de credito/debito e dinheiro. Os precos do catalogo sao para pagamento a vista (Pix ou dinheiro)."}, {"pergunta": "Com quanto tempo de antecedencia devo fazer o pedido?", "resposta": "Recomendamos pelo menos 3 dias de antecedencia para garantir a disponibilidade do chopp e equipamento."}, {"pergunta": "Posso cancelar meu pedido?", "resposta": "Sim, o cancelamento pode ser feito entrando em contato pelo WhatsApp. Consulte nossa politica de cancelamento."}, {"pergunta": "Como funciona a chopeira?", "resposta": "Entre em contato pelo WhatsApp para saber os detalhes sobre chopeira e equipamentos."}]}'::jsonb),
  ('footer', '{"texto": "ALFA Chopp Delivery", "links": [{"label": "WhatsApp", "url": "whatsapp"}]}'::jsonb)
on conflict (secao) do nothing;
