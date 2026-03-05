# ALFA Chopp Delivery — MVP Design

## Resumo

MVP de plataforma de delivery de chopp para eventos. Landing page com catalogo visual, formulario de pedido, automacao WhatsApp (confirmacao + lembrete), painel admin mobile-first com status de pedidos em tempo real.

**Budget:** R$21.000 (3x R$7.000) | **Prazo:** 40 dias
**Area:** Rio de Janeiro e Baixada Fluminense

---

## Stack

| Camada | Tecnologia | Deploy |
|--------|-----------|--------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4 | Vercel |
| Backend | Supabase (PostgreSQL, Auth, Storage, Realtime, Webhooks, pg_cron, RLS) | Supabase Cloud |
| WhatsApp | Node.js + Baileys, Express/Fastify, PM2, Nginx | VPS (EC2) |

**Abordagem hibrida:** Server Actions para mutacoes, Supabase client direto para leituras (RLS), Server Components para SEO na landing page.

---

## Estrutura de Paginas

```
/                        → Landing page (catalogo + formulario de pedido)
/pedido/[id]             → Acompanhamento do pedido (cliente)
/pedido/[id]/confirmacao → Pedido confirmado (pos-pagamento)
/admin                   → Login do painel
/admin/pedidos           → Lista de pedidos (filtro por status, data, regiao)
/admin/pedidos/[id]      → Detalhe do pedido (mudar status, ver cliente)
/admin/catalogo          → CRUD de produtos (precos, fotos, disponibilidade)
/admin/configuracoes     → Configuracoes (area de entrega, horarios, etc.)
```

---

## Modelo de Dados

### produtos
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| marca | text | Nome da marca (Donzela, Vila Imperio, etc.) |
| descricao | text | Descricao do produto |
| volume_litros | int | 30 ou 50 |
| preco_avista | numeric | Preco pix/dinheiro |
| preco_cartao | numeric | Preco cartao (nullable) |
| tipo | text | chopp ou vinho |
| foto_url | text | URL no Supabase Storage |
| ativo | boolean | Visivel no catalogo |
| created_at | timestamptz | Criacao |

### clientes
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| nome | text | Nome do cliente |
| telefone | text | Telefone (identificador unico) |
| email | text | Opcional |
| created_at | timestamptz | Criacao |

### pedidos
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| cliente_id | uuid | FK → clientes |
| status | text | enum: novo, aguardando_pagamento, confirmado, em_rota, entregue, recolhido, finalizado, cancelado |
| endereco | text | Endereco completo (texto livre) |
| data_evento | date | Data do evento |
| horario_evento | time | Horario do evento |
| observacoes | text | Escada, portao, referencia |
| tipo_chopeira | text | gelo ou eletrica |
| subtotal | numeric | Soma dos itens |
| desconto | numeric | Desconto aplicado |
| total | numeric | Valor final |
| metodo_pagamento | text | pix, cartao, dinheiro |
| pago | boolean | Status do pagamento |
| created_at | timestamptz | Criacao |
| updated_at | timestamptz | Ultima atualizacao |

### pedido_itens
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| pedido_id | uuid | FK → pedidos |
| produto_id | uuid | FK → produtos |
| quantidade | int | Qtd de barris |
| preco_unitario | numeric | Preco no momento da compra |
| subtotal | numeric | quantidade * preco_unitario |

### pedido_status_log
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| pedido_id | uuid | FK → pedidos |
| status_anterior | text | Status antes da mudanca |
| status_novo | text | Status depois da mudanca |
| changed_at | timestamptz | Quando mudou |
| changed_by | uuid | Quem mudou (admin user id) |

### mensagens_whatsapp
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| pedido_id | uuid | FK → pedidos |
| tipo | text | confirmacao ou lembrete |
| enviada_em | timestamptz | Quando foi enviada |
| status | text | enviada, falha, pendente |

---

## Fluxo do Cliente

1. Acessa landing page
2. Navega catalogo de chopps (cards com foto, marca, volume, preco)
3. Adiciona itens ao carrinho
4. Seleciona tipo de chopeira (a gelo ou eletrica)
5. Carrinho como bottom sheet (mobile) ou sidebar (desktop)
6. Clica "Finalizar Pedido"
7. Preenche: nome, telefone, email (opcional), data/horario do evento, endereco, observacoes
8. Resumo do pedido com total
9. Escolhe forma de pagamento (gateway TBD)
10. Confirma → status "novo"
11. Recebe confirmacao por WhatsApp (automatico)
12. Brum valida endereco/disponibilidade → muda para "confirmado"
13. Lembrete automatico 24h antes do evento via WhatsApp
14. Acompanha status em /pedido/[id]

**Sem login/cadastro** para o cliente. Telefone como identificador. Carrinho em React state ate o checkout.

---

## Painel Admin

- **Login:** Supabase Auth (email + senha)
- **Lista de pedidos:** cards (nao tabela), filtro por status (chips), data, busca
- **Detalhe:** dados do cliente, itens, evento, timeline de status, botoes de acao
- **Catalogo:** CRUD de produtos, toggle ativo/inativo, editar preco/foto
- **Configuracoes:** dados do negocio, templates WhatsApp
- **Realtime:** pedidos novos aparecem sem refresh (Supabase Realtime)
- **Mobile-first:** botoes grandes, cards, swipe-friendly

---

## WhatsApp (Baileys na VPS)

### API
```
POST /send-message  { telefone, mensagem }
GET  /status        (health check + conexao WhatsApp)
```
Autenticacao via API key no header.

### Fluxo de confirmacao
Pedido criado → Database Webhook (Supabase) → POST /send-message → Baileys envia → registra em mensagens_whatsapp

### Fluxo de lembrete
pg_cron (a cada hora) → busca pedidos confirmados com evento nas proximas 24h → que nao receberam lembrete → POST /send-message → registra em mensagens_whatsapp

### Templates editaveis no painel
- **Confirmacao:** "Ola {nome}! Seu pedido #{id} foi recebido. {itens}. Evento em {data} as {hora}. Acompanhe: {link}"
- **Lembrete:** "Ola {nome}! Lembrete: amanha ({data}) as {hora} entregaremos seu chopp em {endereco}."

Comunicacao unidirecional no MVP (sistema → cliente). Retry automatico para mensagens com falha.

---

## Catalogo de Produtos (dados iniciais)

| Marca | Volume | Preco a Vista | Tipo |
|-------|--------|--------------|------|
| Donzela | 30L | R$430 | chopp |
| Donzela | 50L | R$550 | chopp |
| Vila Imperio | 30L | R$420 | chopp |
| Vila Imperio | 50L | R$475 | chopp |
| Chopp do Marques | 50L | R$530 | chopp |
| Brahma | 50L | R$850 | chopp |
| Ecobier | 50L | R$650 | chopp |
| Vila Imperio Vinho | 30L | R$450 | vinho |
| Vila Imperio Vinho | 50L | R$550 | vinho |

Chopeira inclusa (a gelo ou eletrica). Sem taxa de instalacao. Gelo nao incluso. Assistencia durante o evento.

---

## Branding

- **Marca:** ALFA Chopp Delivery
- **Logo:** Caneco de chopp com "ALFA" em tipografia condensada + espuma
- **Cores:**
  - Amarelo/dourado: #E8B912 (primaria)
  - Preto: #1A1A1A (textos, fundos escuros)
  - Branco: #FFFFFF (fundos claros, espuma)
  - Fundo escuro: #111111
- **Variantes de logo:** com/sem tagline, fundo claro/escuro/amarelo, preto/amarelo/branco

---

## Regras de Negocio

- Precos promocionais para pagamento a vista (pix/dinheiro)
- Valores diferentes para cartao (consultar)
- Promocao para compra acima de 1 barril
- Area de entrega: Rio de Janeiro e Baixada Fluminense (validacao manual pelo Brum)
- Frete a consultar
- Status do pedido: novo → aguardando_pagamento → confirmado → em_rota → entregue → recolhido → finalizado (+cancelado)
- Gateway de pagamento: a definir com o cliente

---

## Monorepo

```
/app              → Next.js (deploy Vercel)
/whatsapp-api     → Baileys server (deploy VPS)
/supabase         → migrations, seed, config
```

## Variaveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_API_URL
WHATSAPP_API_KEY
```
