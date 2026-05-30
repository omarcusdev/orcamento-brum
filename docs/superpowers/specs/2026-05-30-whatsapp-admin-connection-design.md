# WhatsApp — Conexão self-service no admin

**Data:** 2026-05-30
**Status:** Aprovado (brainstorming) — aguardando revisão da spec
**Linear:** OZap / projeto "WhatsApp Integration — ALFA Chopp" (reformula OZA-25; cobre parte do OZA-32)

## Contexto

O servidor Baileys (`whatsapp-api/`, em EC2 atrás do Caddy) já está no ar e a camada de envio do app (`app/lib/whatsapp/`) já dispara a confirmação de pedido. Falta o pareamento da sessão WhatsApp — hoje uma tarefa manual de dev (SSH + ler QR do log). A sessão do Baileys **cai periodicamente** (telefone offline demais, WhatsApp desloga o aparelho, restart, ban). Se cada queda exigir o dev, é insustentável para o operador (cliente Brum).

## Objetivo

Dar ao **operador** uma forma de ver o status da conexão e (re)conectar o WhatsApp **sozinho**, pelo admin, sem suporte técnico. O QR atualiza ao vivo no navegador (como o web.whatsapp.com), eliminando a corrida de tempo do QR via log.

## Não-objetivos (YAGNI)

- Histórico de mensagens enviadas (`mensagens_whatsapp` view) — fica para depois.
- Monitor externo de uptime (cobre "VPS inteira fora do ar") — v2, ver Follow-ups.
- Migração para WhatsApp Cloud API — esta página é inerentemente da era Baileys (ver Decoupling).
- Hardening operacional do servidor já levantado na review (backoff de reconnect, rate-limit do /health, infra-as-code) — batch separado.

## Arquitetura e fluxo

```
Navegador (admin logado)
   │  server action (admin-only)  ──[ x-api-key só no servidor ]──►  VPS: GET /qr · POST /logout · GET /health
   ▼
/admin/whatsapp  ── polling ~3s ──
     conectado    → ● Conectado · <número>   [ Desconectar / trocar número ]
     desconectado → QR (imagem) que atualiza sozinho a cada poll

VPS (Baileys)  ── on loggedOut / offline>3min ──►  POST app /api/whatsapp/alert (secret)  ──►  email (Resend) ao destinatário de Configurações
```

A `x-api-key` nunca chega ao navegador: o browser fala só com server actions (admin-only); elas falam com a VPS.

## Componente 1 — Servidor `whatsapp-api`

**Estado em memória:**
- `currentQr: string | null` — setado no evento `qr` do `connection.update`; limpo ao `open`.

**Endpoints (todos os de controle exigem `x-api-key`, exceto `/health`):**
- `GET /qr` → `{ status, qr: currentQr, me }` onde `me` é o número pareado (`socket.user?.id`, normalizado) quando conectado, senão `null`. Um único endpoint serve a página (status + QR + número).
- `POST /logout` → `socket.logout()` best-effort, apaga `auth_info/`, reinicia a conexão (gera QR novo para parear outro número). Retorna `{ ok: true }`.
- Mantidos: `GET /health` (público, `{connected}`), `GET /status` (authed), `POST /send-message` (authed).

**Alerta event-driven (no `connection.update`):**
- `close` com `DisconnectReason.loggedOut` → dispara alerta `reason: "logged_out"` imediatamente (não reconecta sozinho — exige ação humana).
- `close` não-loggedOut → inicia timer de carência (`ALERT_GRACE_MS`, default 180000). Se ainda desconectado quando dispara → alerta `reason: "offline"`. O timer é cancelado no `open`.
- `alertSent` flag evita alerta duplicado; resetado no `open`.
- Entrega: `POST ${APP_ALERT_WEBHOOK_URL}` com header `x-alert-secret: ${ALERT_WEBHOOK_SECRET}`, body `{ reason, since }`. Best-effort, nunca lança (try/catch + log).

**Limpeza:** remover o caminho `WA_PAIR_NUMBER`/`requestPairingCode` (substituído pelo QR no navegador).

**Env novos (VPS):** `APP_ALERT_WEBHOOK_URL`, `ALERT_WEBHOOK_SECRET`, `ALERT_GRACE_MS` (opcional).

## Componente 2 — App (admin)

**Nav:** adicionar `{ href: "/admin/whatsapp", label: "WhatsApp" }` em `components/admin/admin-nav.tsx`.

**Página:** `app/admin/(authenticated)/whatsapp/page.tsx` (server component; layout já exige login). Renderiza o client component com o estado inicial.

**Client:** `components/admin/whatsapp-connection.tsx`
- Polling de `getWhatsappConnection()` a cada ~3s.
- Conectado → badge ● verde + número (`me` de `getWhatsappConnection`) + botão "Desconectar / trocar número".
- Desconectado → `<img>` com o QR (data URL) + instrução de parear; atualiza sozinho a cada poll.
- Falhas seguidas / `logged_out` → mensagem de ajuda ("se o número foi banido, troque de número").

**Camada de controle (transporte, Baileys-specific):** `app/lib/whatsapp/control.ts` (puro, não `"use server"`) — fetches autenticados a `/qr` e `/logout`, reusando `WHATSAPP_API_URL`/`WHATSAPP_API_KEY`.

**Server actions:** `app/lib/whatsapp/admin-actions.ts` (`"use server"`, cada uma com `requireAdmin()`):
- `getWhatsappConnection()` → `{ status, qrDataUrl: string | null, me: string | null }` (renderiza o QR via lib `qrcode` no servidor → data URL; sem lib de QR no cliente).
- `disconnectWhatsapp()` → chama `/logout`; `{ ok }`.

**Dependência nova (app):** `qrcode` (render server-side do QR para data URL).

## Componente 3 — Alerta (webhook → app → email)

**Rota:** `app/app/api/whatsapp/alert/route.ts` (POST)
- Valida header `x-alert-secret` contra `ALERT_WEBHOOK_SECRET`.
- Lê `{ reason, since }`; envia email via `sendWhatsAppDownAlert(reason)` (novo em `app/lib/email.ts`) ao destinatário de `configuracoes.email_notificacao_destinatario` (mesma fonte das outras notificações).
- Best-effort; sempre 200 para não fazer a VPS reter.

**Env novo (app/Vercel):** `ALERT_WEBHOOK_SECRET` (igual ao da VPS). `RESEND_API_KEY` hoje é só Production — em staging o alerta valida via 200 + log (email real só em prod, salvo se adicionarmos a key no preview).

## Segurança

- `/qr` e `/logout` exigem `x-api-key` (server-to-server). O QR é **credencial** durante ~20s — quem o escaneia vincula um aparelho à conta; por isso nunca é público e a página é admin-only (`requireAdmin` em todas as actions + layout autenticado).
- `/api/whatsapp/alert` exige `x-alert-secret`.
- Nenhuma chave (`WHATSAPP_API_KEY`, secret) chega ao navegador; tudo via server actions / route handlers.

## Decoupling (seam de provider preservado)

A camada de **envio** (`sendWhatsAppMessage`) continua provider-neutra. A camada de **controle** (`/qr`, `/logout`, esta página) é **Baileys-specific** por natureza — o Cloud API não tem QR nem sessão. Quando `WHATSAPP_PROVIDER=cloud`, a página de conexão deve exibir "gerenciado pelo provedor oficial — sem pareamento" em vez do QR. Assim o seam de envio não é contaminado e a página de pareamento é claramente da era Baileys.

## Plano de teste (staging, dogfood do próprio recurso)

1. Parear pela aba **WhatsApp** do admin (número de teste) → status vira ● Conectado.
2. Smoke test: disparar `/send-message` (via server action interna ou order de teste) → mensagem chega no número de teste, em formato local, provando a normalização E.164.
3. Clicar "Desconectar / trocar número" → status cai, QR reaparece.
4. Alerta: derrubar a sessão (logout) → VPS chama `/api/whatsapp/alert` → validar que a rota foi atingida (e email, se Resend no ambiente).

## Follow-ups (fora do v1)

- **v2 — monitor externo de uptime** no `/health` (cobre "VPS/processo totalmente fora", que o evento do Baileys não enxerga). Fecha o OZA-32.
- Hardening da review: backoff/cap de reconnect, `/health` fora do rate-limit + `trustProxy`, durabilidade da env no PM2 (`env_file`), commitar `Caddyfile` + `DEPLOY.md`, remover SQL morto (`build_confirmation_message`).
- View de histórico de `mensagens_whatsapp`.
- Pareamento do número dedicado em produção (OZA-22/23) — mesmo fluxo desta página.

## Mapeamento Linear

- **OZA-25** (parear via QR) → reformulada como esta feature self-service.
- **OZA-32** (logging/monitoring) → parcialmente coberto (alerta event-driven); monitor externo fica para v2.
- VPS/deploy (OZA-17/24/18) e código de envio (OZA-19/27/28/29) — já feitos.
