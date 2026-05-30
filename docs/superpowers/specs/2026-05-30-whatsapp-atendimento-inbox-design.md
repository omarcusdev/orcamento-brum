# WhatsApp Atendimento — Inbox no admin (v1 "chat solto")

**Data:** 2026-05-30
**Status:** APROVADO 2026-05-30 (seções validadas via brainstorming + companion visual)
**Branch:** `staging`
**Decisão de base:** construir sobre o **Baileys atual** (escolha informada do cliente; ciente do risco de ban no número e do retrabalho na eventual migração pra Cloud API — ver "Riscos aceitos").

## Objetivo

Dar ao operador uma **caixa de atendimento dentro do admin**: ver as conversas de WhatsApp dos clientes e **responder** dali, com histórico que sobrevive a troca de aparelho/equipe. Hoje o servidor é *send-only* (só a confirmação de pedido); este v1 adiciona a captura de inbound + uma inbox no admin.

### Dores que isto resolve (escolhidas pelo cliente)
1. **Registro / disputa** — conversa fica persistida e pesquisável por contato.
2. **Continuidade** — histórico não vive só no celular do operador.
3. **Supervisão** — dá pra acompanhar sem pegar o aparelho.
4. **Responder pelo admin** — atende sem sair do painel.

### Escopo v1 deliberadamente enxuto ("chat solto")
Conversa **por contato/telefone**, **sem vínculo com pedido** (badge no card / pin ficam pra depois — a thread por cliente já é a base pra ligar isso sem retrabalho). Layout = **aba dedicada "Atendimento"**.

## Fora de escopo (explícito — não construir agora)
- **Vínculo conversa↔pedido** (auto-link, badge "💬 Conversa (N)" no card, pin manual). Decisão adiada pelo cliente.
- **Mídia** (foto/áudio/documento): v1 mostra placeholder `[imagem recebida — ver no celular]`. Sem download/Storage.
- **"Visto" (read receipts) e "digitando"**: desligados (passivo). 
- **Busca, etiquetas, atribuição multi-agente, CRM de leads, templates.**
- **Retenção/expurgo automático (pg_cron)** — adiado por decisão do cliente; recomendado antes de prod (LGPD).
- **Migração pra Cloud API oficial** (projeto à parte; ver "Decoupling").

## Riscos aceitos (decisão consciente do cliente)
- **Ban do número derruba tudo** — o número é o WhatsApp do operador num cliente não-oficial; um ban leva junto as confirmações de pedido. Mitigado parcialmente pelos guard-rails, **não** eliminado (só a Cloud API elimina).
- **Histórico é forward-only** — Baileys não devolve o passado; a inbox começa vazia e captura "pra frente". Banner deixa isso explícito.
- **Entrega best-effort no v1** — se o app/webhook estiver fora no momento da mensagem, ela pode não ser capturada (o celular do operador ainda a tem). Sem fila durável no v1 (ver "Durabilidade").

---

## Arquitetura

Fluxo de uma mensagem que chega:

```
Cliente → WhatsApp → [EC2: Baileys messages.upsert]
   → POST /api/whatsapp/inbound (segredo próprio)  [Next/Vercel]
      → normaliza telefone → casa com clientes → upsert conversa + insert mensagem (service client)
         → Supabase Realtime → inbox do admin atualiza ao vivo
```

Resposta do operador:

```
Admin digita → server action enviarRespostaChat() → control.ts → POST /send-message (EC2, E.164)
   → Baileys envia → o WhatsApp ecoa a própria mensagem em messages.upsert (fromMe=true)
      → mesmo caminho de inbound → vira linha 'saida' (de-dupe por wa_message_id)
```

**Fonte única de ingestão:** *todas* as mensagens (entrada **e** saída) entram pela `messages.upsert`. Vantagem: respostas feitas **pelo celular** também aparecem na inbox. A `enviarRespostaChat` apenas dispara o envio; a linha aparece quando o Baileys ecoa (de-dupe por `wa_message_id`). UI otimista é opcional.

### Decoupling (reduz o "pagar duas vezes")
A captura via `messages.upsert` é **específica do Baileys** e é a única parte descartável numa futura migração pra Cloud API — lá, o webhook oficial da Meta entregaria no **mesmo** `/api/whatsapp/inbound`. **Tabelas, server actions e UI da inbox são provider-agnósticas e sobrevivem à migração.** Manter o endpoint de inbound genérico (payload normalizado, não o formato cru do Baileys).

---

## Componentes

### 1. Servidor Baileys (`whatsapp-api/src/baileys.ts`)
- **`markOnlineOnConnect: false`** no `makeWASocket` — devolve notificações ao celular do operador + footprint menor. (Vale por si só, independente desta feature.)
- Novo handler `messages.upsert`:
  - Só processa `type === 'notify'` (ignora `append`/backfill).
  - Captura **ambas as direções**: `msg.key.fromMe` → `'saida'`; senão `'entrada'`.
  - Extrai: telefone (de `msg.key.remoteJid` via `extractPhone`), `wa_message_id` (`msg.key.id`), texto (`message.conversation` / `extendedTextMessage.text`), timestamp.
  - **Mídia**: se não houver texto e for foto/áudio/doc, envia corpo placeholder `[imagem recebida — ver no celular]` (sem baixar).
  - Ignora mensagens de grupo (`@g.us`) no v1 — só DM (`@s.whatsapp.net`).
  - POST pro webhook do app com **segredo próprio** (`INBOUND_WEBHOOK_SECRET`, **distinto** do `ALERT_WEBHOOK_SECRET`), reusando o padrão de `sendDownAlert` (fetch + header de segredo + try/catch).
  - **Nunca** chama `readMessages` nem `sendPresenceUpdate` (passivo).
- Mantém a disciplina do guard `socket !== newSocket` já existente.

### 2. App — webhook receiver (`app/app/api/whatsapp/inbound/route.ts`, novo)
- `POST`, valida header de segredo (`INBOUND_WEBHOOK_SECRET`); 401 se inválido.
- Payload normalizado: `{ telefone, waMessageId, direcao, corpo, timestamp }`.
- Normaliza telefone (E.164, reusando `toBrazilE164`), casa com `clientes.telefone` (match normalizado + **fallback últimos 8 dígitos** pro 9º dígito).
- Chama RPC/serviço que faz **upsert da conversa** + **insert da mensagem** com `ON CONFLICT (wa_message_id) DO NOTHING` (de-dupe). Usa **service client** (bypassa RLS, como `notificacoes.ts` já faz).
- Atualiza `ultima_mensagem_em`, `ultima_mensagem_preview`, e incrementa `nao_lidas` (só em `'entrada'`).

### 3. App — persistência (migration `022_whatsapp_conversas.sql`, nova)
```
conversas_whatsapp
  id              uuid pk default gen_random_uuid()
  telefone        text not null unique        -- E.164
  cliente_id      uuid null references clientes(id) on delete set null
  nome_exibicao   text null                   -- snapshot do nome do cliente (ou null = "sem cadastro")
  ultima_mensagem_em      timestamptz
  ultima_mensagem_preview text
  nao_lidas       int not null default 0
  created_at      timestamptz default now()

mensagens_conversa_whatsapp
  id              uuid pk default gen_random_uuid()
  conversa_id     uuid not null references conversas_whatsapp(id) on delete cascade
  wa_message_id   text unique                 -- de-dupe do echo/notify
  direcao         text not null check (direcao in ('entrada','saida'))
  corpo           text not null
  ocorrida_em     timestamptz not null        -- timestamp do WhatsApp
  created_at      timestamptz default now()
  index (conversa_id, ocorrida_em)
```
- **RLS admin-only** em ambas (SELECT/INSERT/UPDATE/DELETE via `is_admin()`), seguindo o padrão de `mensagens_whatsapp` (migration 004) e a correção da 021. Service client (webhook) opera fora da RLS.
- Adicionar ambas à **publicação de Realtime** (padrão da migration 014).
- **Retenção:** ⏳ adiada do v1 (decisão do cliente) — sem expurgo automático por enquanto. Ver "Gates de produção".

### 4. App — server actions (`app/lib/whatsapp/chat-actions.ts`, novo, `"use server"`)
Todas com `requireAdmin()`:
- `getConversas()` → lista ordenada por `ultima_mensagem_em desc` (telefone, nome, preview, não-lidas, horário).
- `getConversaMensagens(conversaId)` → thread ordenada por `ocorrida_em asc`.
- `enviarRespostaChat(conversaId, texto)` → resolve telefone → `control.ts`/adapter → `POST /send-message` (E.164). Não insere a linha (vem pelo echo); devolve ok/erro. A UI mostra estado "enviando…" — **sem inserção otimista** no v1.
- `markConversaRead(conversaId)` → zera `nao_lidas`. **Não** manda "visto" pro WhatsApp (passivo).

> Constantes/funções puras (ex.: normalização de telefone, formatação) ficam fora do arquivo `"use server"` (convenção do projeto).

### 5. App — UI (`app/components/admin/atendimento/`, novo)
- `"use client"`, 2 painéis: lista de conversas (esq.) + thread + caixa de resposta (dir.).
- Banner forward-only ("Conversas a partir de …").
- Lista: nome do cliente ou número cru + tag "sem cadastro"; preview; horário; bolinha de não-lidas.
- Thread: bolhas entrada/saída; placeholder de mídia quando aplicável.
- **Realtime** (Supabase `postgres_changes`, padrão de `orders-list.tsx`) nas duas tabelas → atualiza lista e thread ao vivo. Abrir uma conversa chama `markConversaRead`.
- Usa **primitivos `@/components/ui`** (Button, Input/Textarea) — sem `<input>`/`<button>` cru. Sem `window.confirm()`.
- Página server component: `app/app/admin/(authenticated)/atendimento/page.tsx`.
- Nav: adicionar `{ href: "/admin/atendimento", label: "Atendimento" }` em `admin-nav.tsx`.

### 6. Phone matching (`app/lib/whatsapp/phone.ts` — estender + testes)
- Reusar `toBrazilE164`. Adicionar `matchClienteByPhone(telefone, clientes)`: match por E.164; **fallback** comparando os **últimos 8 dígitos** (cobre o 9º dígito BR). Cobrir com vitest (estilo `phone.test.ts`).

---

## Guard-rails (requisitos, não opcionais)

| Guard-rail | Como |
|---|---|
| Notificações no celular + footprint | `markOnlineOnConnect:false` |
| Passivo anti-ban | nunca `readMessages` / `sendPresenceUpdate` |
| Segredo isolado | `INBOUND_WEBHOOK_SECRET` ≠ `ALERT_WEBHOOK_SECRET` |
| LGPD — acesso | RLS admin-only nas 2 tabelas |
| LGPD — retenção | ⏳ adiada do v1 — ver gates de prod |
| LGPD — direito do titular | exclusão por telefone (procedimento; chave já indexada) |
| LGPD — transparência | **aviso de privacidade a atualizar** (gate de prod) |
| Forward-only | banner com data de início |
| De-dupe | `wa_message_id unique` + `ON CONFLICT DO NOTHING` |

## Variáveis de ambiente novas
- **EC2:** `APP_INBOUND_WEBHOOK_URL`, `INBOUND_WEBHOOK_SECRET`.
- **App (Vercel):** `INBOUND_WEBHOOK_SECRET` (mesmo valor; validado no route).

## Durabilidade & erros (v1)
- De-dupe por `wa_message_id` torna reentregas seguras.
- POST de inbound com timeout curto + 1–2 retries no EC2; se o app estiver fora, **loga e segue** (gap aceito no v1 — o celular ainda tem a mensagem). Fila durável fica como melhoria futura.
- Echo de saída pode chegar antes/depois da action — ordenação por `ocorrida_em` resolve.

## Estratégia de teste
- **Unit (vitest):** `matchClienteByPhone` (E.164 + fallback 8 dígitos, incluindo o caso 9º dígito); parser do payload de inbound + de-dupe.
- **E2E manual em staging (número de teste já pareado):**
  1. Cliente manda msg → aparece na inbox com nome certo (cliente cadastrado) e como "sem cadastro" (número desconhecido).
  2. Responder pelo painel → chega no celular do cliente.
  3. Responder **pelo celular** → aparece na inbox como `'saida'`.
  4. Reenvio/duplicata → não duplica (de-dupe).
  5. Confirmar `markOnlineOnConnect:false`: operador recebe push no celular com o servidor conectado.
- Implementação/teste/revisão via **workflows** (preferência do cliente): build paralelo por componente + revisão adversarial (mesmo padrão que pegou os bugs do 515 e do E.164).

## Gates de produção (não bloqueiam staging)
1. **Número dedicado** pro WhatsApp (anti-ban; já no roadmap de prod).
2. **Aviso de privacidade** atualizado (mensagens registradas e exibidas a admins; base legal: legítimo interesse + execução de contrato; canal do encarregado).
3. Promover `staging` → `main`.
4. **Retenção/expurgo (pg_cron)** — definir janela e ligar antes de acumular dados reais (LGPD; evita "cemitério de dados").

## Decisões resolvidas no fechamento
- **Retenção:** adiada do v1 (sem expurgo automático agora) — vira gate de prod.
- **Grupos:** ignorados no v1.
- **Resposta:** sem inserção otimista; a linha entra pelo echo do WhatsApp (fonte única), com estado "enviando…" na UI.
