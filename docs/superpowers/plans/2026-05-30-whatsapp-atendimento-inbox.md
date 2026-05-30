# WhatsApp Atendimento Inbox (v1 "chat solto") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **This project's owner asked to execute via the Workflow tool** (parallel build per component + adversarial review) — see "Execution Handoff".

**Goal:** Add an in-admin WhatsApp inbox ("Atendimento") that captures inbound customer messages, threads them per contact, and lets the operator reply — on the existing Baileys server.

**Architecture:** Baileys server gains a passive `messages.upsert` capture that POSTs each message (both directions) to a new authenticated Next webhook; the app matches the phone to a `cliente`, persists to two new Supabase tables (de-duped by `wa_message_id`), and renders a live (Realtime) two-pane inbox. Replies reuse the existing `/send-message` path; the sent message surfaces via the same capture (single ingestion source). Only the Baileys capture is provider-specific — tables/actions/UI survive a future Cloud API migration.

**Tech Stack:** Node/Fastify + Baileys (TS, ESM) on EC2; Next.js 15 App Router + React 19 + Supabase (Postgres/RLS/Realtime) on Vercel; vitest for unit tests; `@/components/ui` primitives.

**Spec:** `docs/superpowers/specs/2026-05-30-whatsapp-atendimento-inbox-design.md`

---

## File Structure

**App (`app/`)**
- `lib/whatsapp/phone.ts` *(modify)* — add `digitsOf`, `last8`, `matchClienteByPhone` (pure; the BR 9th-digit fallback).
- `lib/whatsapp/phone.test.ts` *(modify)* — matching tests.
- `lib/whatsapp/inbound.ts` *(create)* — `parseInboundPayload` (pure validation; the webhook payload contract).
- `lib/whatsapp/inbound.test.ts` *(create)* — payload validation tests.
- `app/api/whatsapp/inbound/route.ts` *(create)* — authenticated webhook receiver; matches cliente, calls RPC via service client.
- `lib/whatsapp/chat-actions.ts` *(create, `"use server"`)* — `getConversas`, `getConversaMensagens`, `enviarRespostaChat`, `markConversaRead`, `excluirConversa`.
- `components/admin/atendimento/atendimento-client.tsx` *(create, `"use client"`)* — two-pane inbox + reply + Realtime.
- `app/admin/(authenticated)/atendimento/page.tsx` *(create)* — server component.
- `components/admin/admin-nav.tsx` *(modify)* — add "Atendimento" nav item.

**Baileys server (`whatsapp-api/`)**
- `src/inbound.ts` *(create)* — `extractInbound` (pure extraction) + `forwardInbound` (fetch to app).
- `src/baileys.ts` *(modify)* — `markOnlineOnConnect:false` + `messages.upsert` handler.

**Supabase**
- `supabase/migrations/022_whatsapp_conversas.sql` *(create)* — tables, RLS, Realtime publication, `register_inbound_whatsapp` RPC.

**Parallelizable for workflow execution:** Task 1 (migration), Task 2 (phone), Task 3 (inbound parse) are independent and can run in parallel. Task 4 depends on 1+2+3. Task 5 depends on 3 (shares the payload shape). Task 6 depends on 1. Task 7 depends on 6. Task 8 (E2E) is last.

---

## Task 1: Migration 022 — tables, RLS, Realtime, RPC

**Files:**
- Create: `supabase/migrations/022_whatsapp_conversas.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 022_whatsapp_conversas.sql
-- WhatsApp atendimento inbox (v1 "chat solto"): per-contact conversations + messages.
-- No retention job in v1 (deferred — see spec "Gates de produção").

create table if not exists conversas_whatsapp (
  id                      uuid primary key default gen_random_uuid(),
  telefone                text not null unique,          -- E.164
  cliente_id              uuid references clientes(id) on delete set null,
  nome_exibicao           text,                          -- snapshot do nome (null = "sem cadastro")
  ultima_mensagem_em      timestamptz,
  ultima_mensagem_preview text,
  nao_lidas               int not null default 0,
  created_at              timestamptz not null default now()
);

create table if not exists mensagens_conversa_whatsapp (
  id            uuid primary key default gen_random_uuid(),
  conversa_id   uuid not null references conversas_whatsapp(id) on delete cascade,
  wa_message_id text unique,                              -- de-dupe (echo + reentrega)
  direcao       text not null check (direcao in ('entrada','saida')),
  corpo         text not null,
  ocorrida_em   timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_mensagens_conversa on mensagens_conversa_whatsapp (conversa_id, ocorrida_em);
create index if not exists idx_conversas_ultima on conversas_whatsapp (ultima_mensagem_em desc nulls last);

-- RLS: admin-only (mirror of mensagens_whatsapp, migration 004). Service role bypasses RLS.
alter table conversas_whatsapp enable row level security;
alter table mensagens_conversa_whatsapp enable row level security;

create policy "conversas_whatsapp_select_admin" on conversas_whatsapp for select using (is_admin());
create policy "conversas_whatsapp_insert_admin" on conversas_whatsapp for insert with check (is_admin());
create policy "conversas_whatsapp_update_admin" on conversas_whatsapp for update using (is_admin());
create policy "conversas_whatsapp_delete_admin" on conversas_whatsapp for delete using (is_admin());

create policy "mensagens_conversa_whatsapp_select_admin" on mensagens_conversa_whatsapp for select using (is_admin());
create policy "mensagens_conversa_whatsapp_insert_admin" on mensagens_conversa_whatsapp for insert with check (is_admin());
create policy "mensagens_conversa_whatsapp_update_admin" on mensagens_conversa_whatsapp for update using (is_admin());
create policy "mensagens_conversa_whatsapp_delete_admin" on mensagens_conversa_whatsapp for delete using (is_admin());

-- Realtime (mirror of migration 014).
alter publication supabase_realtime add table conversas_whatsapp;
alter publication supabase_realtime add table mensagens_conversa_whatsapp;

-- Upsert conversa + insert message (de-duped) + bump aggregates only on a real insert.
create or replace function register_inbound_whatsapp(
  p_telefone text,
  p_cliente_id uuid,
  p_nome text,
  p_wa_message_id text,
  p_direcao text,
  p_corpo text,
  p_ocorrida_em timestamptz
) returns uuid as $$
declare
  conv_id uuid;
  msg_id uuid;
begin
  insert into conversas_whatsapp (telefone, cliente_id, nome_exibicao)
  values (p_telefone, p_cliente_id, p_nome)
  on conflict (telefone) do update set
    cliente_id    = coalesce(excluded.cliente_id, conversas_whatsapp.cliente_id),
    nome_exibicao = coalesce(excluded.nome_exibicao, conversas_whatsapp.nome_exibicao)
  returning id into conv_id;

  insert into mensagens_conversa_whatsapp (conversa_id, wa_message_id, direcao, corpo, ocorrida_em)
  values (conv_id, p_wa_message_id, p_direcao, p_corpo, p_ocorrida_em)
  on conflict (wa_message_id) do nothing
  returning id into msg_id;

  -- Duplicate (echo/reentrega): conversa already upserted, do not double-count.
  if msg_id is null then
    return conv_id;
  end if;

  update conversas_whatsapp set
    ultima_mensagem_em      = greatest(coalesce(ultima_mensagem_em, p_ocorrida_em), p_ocorrida_em),
    ultima_mensagem_preview = left(p_corpo, 120),
    nao_lidas               = nao_lidas + case when p_direcao = 'entrada' then 1 else 0 end
  where id = conv_id;

  return conv_id;
end;
$$ language plpgsql security definer;
```

- [ ] **Step 2: Apply to STAGING** (ref `iwyijyxpkchibdryzkpn` — NOT prod)

Apply via Supabase MCP `apply_migration` against the staging project, or link the CLI to staging and run `supabase db push` **from the repo root** (CLI must run from root, not `supabase/`).
Expected: migration applies clean; `conversas_whatsapp` + `mensagens_conversa_whatsapp` exist.

- [ ] **Step 3: Verify schema + RLS + publication**

Run (against staging) the checks:
```sql
select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like '%conversa%';
-- expect 2 rows
select polname from pg_policies where tablename='conversas_whatsapp';
-- expect 4 policies
select proname from pg_proc where proname='register_inbound_whatsapp';
-- expect 1 row
```
Expected: 2 publication rows, 4 policies each table, RPC present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/022_whatsapp_conversas.sql
git commit -m "feat(whatsapp): migration 022 — atendimento conversas + RLS + realtime RPC"
```

---

## Task 2: Phone matching (BR 9th-digit fallback)

**Files:**
- Modify: `app/lib/whatsapp/phone.ts`
- Test: `app/lib/whatsapp/phone.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `phone.test.ts`)

```ts
import { describe, it, expect } from "vitest"
import { toBrazilE164, last8, matchClienteByPhone } from "./phone"

describe("last8", () => {
  it("pega os últimos 8 dígitos ignorando não-dígitos", () => {
    expect(last8("+55 (21) 99812-3344")).toBe("98123344")
  })
})

describe("matchClienteByPhone", () => {
  const clientes = [
    { id: "c1", nome: "João Silva", telefone: "21998123344" },   // com 9
    { id: "c2", nome: "Maria Souza", telefone: "5521912345678" }, // E.164 com 9
  ]

  it("casa por E.164 exato", () => {
    expect(matchClienteByPhone("5521998123344", clientes)).toEqual({ id: "c1", nome: "João Silva" })
  })

  it("casa pelo fallback dos últimos 8 dígitos quando o 9 difere", () => {
    // JID veio sem o 9: 552198123344 → últimos 8 = 98123344 → c1
    expect(matchClienteByPhone("552198123344", clientes)).toEqual({ id: "c1", nome: "João Silva" })
  })

  it("retorna null quando não há cliente", () => {
    expect(matchClienteByPhone("5511000000000", clientes)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npm test -- phone`
Expected: FAIL — `last8`/`matchClienteByPhone` not exported.

- [ ] **Step 3: Implement** (append to `phone.ts`)

```ts
export const digitsOf = (raw: string): string => raw.replace(/\D/g, "")

export const last8 = (raw: string): string => digitsOf(raw).slice(-8)

type ClienteLike = { id: string; nome: string; telefone: string | null }
export type ClienteMatch = { id: string; nome: string } | null

export const matchClienteByPhone = (telefone: string, clientes: ClienteLike[]): ClienteMatch => {
  const alvoE164 = toBrazilE164(telefone)
  const exato = clientes.find((c) => c.telefone && toBrazilE164(c.telefone) === alvoE164)
  if (exato) return { id: exato.id, nome: exato.nome }

  const alvo8 = last8(telefone)
  const porFinal = clientes.find((c) => c.telefone && last8(c.telefone) === alvo8)
  return porFinal ? { id: porFinal.id, nome: porFinal.nome } : null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npm test -- phone`
Expected: PASS (all cases including the existing `toBrazilE164` tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp/phone.ts app/lib/whatsapp/phone.test.ts
git commit -m "feat(whatsapp): phone↔cliente matching with BR 9th-digit fallback"
```

---

## Task 3: Inbound payload contract + parser

This defines the JSON contract shared between the Baileys server (Task 5) and the webhook (Task 4).

**Files:**
- Create: `app/lib/whatsapp/inbound.ts`
- Test: `app/lib/whatsapp/inbound.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest"
import { parseInboundPayload } from "./inbound"

const valid = {
  telefone: "5521998123344",
  waMessageId: "ABC123",
  direcao: "entrada",
  corpo: "Oi, qual o horário?",
  ocorridaEm: "2026-05-30T17:32:00.000Z",
}

describe("parseInboundPayload", () => {
  it("aceita payload válido", () => {
    expect(parseInboundPayload(valid)).toEqual(valid)
  })

  it("rejeita direcao inválida", () => {
    expect(parseInboundPayload({ ...valid, direcao: "x" })).toBeNull()
  })

  it("rejeita campos faltando", () => {
    expect(parseInboundPayload({ telefone: "55", corpo: "oi" })).toBeNull()
  })

  it("rejeita não-objeto", () => {
    expect(parseInboundPayload(null)).toBeNull()
    expect(parseInboundPayload("nope")).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npm test -- inbound`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export type InboundDirecao = "entrada" | "saida"

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: InboundDirecao
  corpo: string
  ocorridaEm: string
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0

export const parseInboundPayload = (raw: unknown): InboundPayload | null => {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (!isNonEmptyString(c.telefone)) return null
  if (!isNonEmptyString(c.waMessageId)) return null
  if (c.direcao !== "entrada" && c.direcao !== "saida") return null
  if (!isNonEmptyString(c.corpo)) return null
  if (!isNonEmptyString(c.ocorridaEm)) return null
  return {
    telefone: c.telefone,
    waMessageId: c.waMessageId,
    direcao: c.direcao,
    corpo: c.corpo,
    ocorridaEm: c.ocorridaEm,
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npm test -- inbound`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp/inbound.ts app/lib/whatsapp/inbound.test.ts
git commit -m "feat(whatsapp): inbound webhook payload contract + parser"
```

---

## Task 4: Webhook receiver `/api/whatsapp/inbound`

**Files:**
- Create: `app/app/api/whatsapp/inbound/route.ts`

Depends on Task 1 (RPC), Task 2 (matching), Task 3 (parser).

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { parseInboundPayload } from "@/lib/whatsapp/inbound"
import { toBrazilE164, last8, matchClienteByPhone } from "@/lib/whatsapp/phone"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = request.headers.get("x-inbound-secret")
  if (!secret || secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = parseInboundPayload(await request.json().catch(() => null))
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const telefoneE164 = toBrazilE164(payload.telefone)

  // Candidatos pelos últimos 8 dígitos — barato e suficiente pro volume do MVP.
  const { data: candidatos } = await supabase
    .from("clientes")
    .select("id, nome, telefone")
    .ilike("telefone", `%${last8(payload.telefone)}%`)

  const match = matchClienteByPhone(payload.telefone, candidatos ?? [])

  const { error } = await supabase.rpc("register_inbound_whatsapp", {
    p_telefone: telefoneE164,
    p_cliente_id: match?.id ?? null,
    p_nome: match?.nome ?? null,
    p_wa_message_id: payload.waMessageId,
    p_direcao: payload.direcao,
    p_corpo: payload.corpo,
    p_ocorrida_em: payload.ocorridaEm,
  })

  if (error) {
    console.error("[whatsapp/inbound] RPC falhou:", error)
    return NextResponse.json({ error: "persist failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Set the env var on staging Vercel**

Generate a secret: `openssl rand -hex 32`. Add `INBOUND_WEBHOOK_SECRET` to the Vercel **Preview** env (staging branch). Keep the value — Task 5 uses the same on EC2.

- [ ] **Step 3: Verify (typecheck + manual curl)**

Run: `cd app && npm run typecheck` → Expected: no errors.
After deploy, smoke-test against staging:
```bash
curl -s -X POST "https://app-git-staging-marcusgoncalvess-projects.vercel.app/api/whatsapp/inbound" \
  -H "x-inbound-secret: WRONG" -H "content-type: application/json" \
  -d '{"telefone":"5521999999999","waMessageId":"t1","direcao":"entrada","corpo":"teste","ocorridaEm":"2026-05-30T17:00:00Z"}'
# expect 401
```
(A valid-secret call is exercised in Task 8 end-to-end.)

- [ ] **Step 4: Commit**

```bash
git add app/app/api/whatsapp/inbound/route.ts
git commit -m "feat(whatsapp): inbound webhook — match cliente + persist via RPC"
```

---

## Task 5: Baileys server — passive capture + `markOnlineOnConnect:false`

**Files:**
- Create: `whatsapp-api/src/inbound.ts`
- Modify: `whatsapp-api/src/baileys.ts`

Shares the payload shape from Task 3 (kept in sync by hand — both are tiny).

- [ ] **Step 1: Create the extraction + forward module**

```ts
// whatsapp-api/src/inbound.ts
type Direcao = "entrada" | "saida"

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: Direcao
  corpo: string
  ocorridaEm: string
}

const MEDIA_KEYS = ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "stickerMessage"] as const

const textOf = (m: any): string | null =>
  m?.conversation ?? m?.extendedTextMessage?.text ?? null

// Pure: WAMessage -> normalized payload, or null to skip (group, protocol, empty).
export const extractInbound = (msg: any): InboundPayload | null => {
  const jid: string | undefined = msg?.key?.remoteJid
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null // só DM (ignora grupos @g.us e status)
  const waMessageId: string | undefined = msg?.key?.id
  if (!waMessageId) return null

  const telefone = jid.split("@")[0].split(":")[0].replace(/\D/g, "")
  if (!telefone) return null

  const direcao: Direcao = msg?.key?.fromMe ? "saida" : "entrada"

  let corpo = textOf(msg?.message)
  if (!corpo) {
    const hasMedia = MEDIA_KEYS.some((k) => msg?.message?.[k])
    if (!hasMedia) return null // protocolo/efêmero/vazio
    corpo = "[mídia recebida — ver no celular]"
  }

  const tsSec = Number(msg?.messageTimestamp) || Math.floor(Date.now() / 1000)
  return { telefone, waMessageId, direcao, corpo, ocorridaEm: new Date(tsSec * 1000).toISOString() }
}

let missingConfigLogged = false

export const forwardInbound = async (payload: InboundPayload): Promise<void> => {
  const url = process.env.APP_INBOUND_WEBHOOK_URL
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!url || !secret) {
    if (!missingConfigLogged) {
      console.error("Inbound webhook not configured (APP_INBOUND_WEBHOOK_URL / INBOUND_WEBHOOK_SECRET). Skipping capture.")
      missingConfigLogged = true
    }
    return
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "x-inbound-secret": secret, "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error("forwardInbound failed:", err)
  }
}
```

- [ ] **Step 2: Wire it into `baileys.ts`**

In `createSocket()`, add `markOnlineOnConnect: false` to the `makeWASocket({...})` options (so the operator keeps phone push + lower footprint).

Add the import at top: `import { extractInbound, forwardInbound } from "./inbound.js"`.

Right after `newSocket.ev.on("creds.update", saveCreds)`, add the passive capture (NEVER calls `readMessages`/`sendPresenceUpdate`):

```ts
newSocket.ev.on("messages.upsert", ({ messages, type }) => {
  if (socket !== newSocket) return       // ignore superseded sockets (same guard as connection.update)
  if (type !== "notify") return          // skip 'append' backfill
  for (const msg of messages) {
    const payload = extractInbound(msg)
    if (payload) {
      forwardInbound(payload).catch((err) => console.error("inbound forward error:", err))
    }
  }
})
```

- [ ] **Step 3: Verify build**

Run: `cd whatsapp-api && npm run build`
Expected: `tsc` succeeds, no type errors.

- [ ] **Step 4: Deploy to EC2 + set env**

On the EC2 box: set `APP_INBOUND_WEBHOOK_URL=https://app-git-staging-marcusgoncalvess-projects.vercel.app/api/whatsapp/inbound` and `INBOUND_WEBHOOK_SECRET=<same value as Task 4 Step 2>`; `pm2 restart whatsapp-api --update-env` then `pm2 save`. Pull/build the new code first (git pull + `npm run build`).

- [ ] **Step 5: Commit**

```bash
git add whatsapp-api/src/inbound.ts whatsapp-api/src/baileys.ts
git commit -m "feat(whatsapp-api): passive inbound capture + markOnlineOnConnect:false"
```

---

## Task 6: Server actions `chat-actions.ts`

**Files:**
- Create: `app/lib/whatsapp/chat-actions.ts`

Depends on Task 1. `"use server"` → only async exports.

- [ ] **Step 1: Implement**

```ts
"use server"

import { requireAdmin } from "@/lib/auth"
import { sendWhatsAppMessage } from "@/lib/whatsapp"

export type ConversaResumo = {
  id: string
  telefone: string
  nome: string | null
  preview: string | null
  naoLidas: number
  ultimaEm: string | null
  clienteId: string | null
}

export type MensagemChat = {
  id: string
  direcao: "entrada" | "saida"
  corpo: string
  ocorridaEm: string
}

export const getConversas = async (): Promise<ConversaResumo[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("conversas_whatsapp")
    .select("id, telefone, nome_exibicao, ultima_mensagem_preview, nao_lidas, ultima_mensagem_em, cliente_id")
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    telefone: r.telefone,
    nome: r.nome_exibicao,
    preview: r.ultima_mensagem_preview,
    naoLidas: r.nao_lidas,
    ultimaEm: r.ultima_mensagem_em,
    clienteId: r.cliente_id,
  }))
}

export const getConversaMensagens = async (conversaId: string): Promise<MensagemChat[]> => {
  const { supabase } = await requireAdmin()
  const { data } = await supabase
    .from("mensagens_conversa_whatsapp")
    .select("id, direcao, corpo, ocorrida_em")
    .eq("conversa_id", conversaId)
    .order("ocorrida_em", { ascending: true })

  return (data ?? []).map((r) => ({ id: r.id, direcao: r.direcao, corpo: r.corpo, ocorridaEm: r.ocorrida_em }))
}

export const markConversaRead = async (conversaId: string): Promise<void> => {
  const { supabase } = await requireAdmin()
  await supabase.from("conversas_whatsapp").update({ nao_lidas: 0 }).eq("id", conversaId)
}

export const enviarRespostaChat = async (conversaId: string, texto: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()
  const trimmed = texto.trim()
  if (!trimmed) return { ok: false }

  const { data: conversa } = await supabase
    .from("conversas_whatsapp")
    .select("telefone")
    .eq("id", conversaId)
    .single()

  if (!conversa?.telefone) return { ok: false }

  // Não insere a linha aqui — ela chega pelo echo (messages.upsert fromMe). Fonte única.
  const result = await sendWhatsAppMessage(conversa.telefone, trimmed)
  return { ok: result.ok }
}

export const excluirConversa = async (conversaId: string): Promise<void> => {
  const { supabase } = await requireAdmin()
  // Exclusão por titular (LGPD). Cascade apaga as mensagens.
  await supabase.from("conversas_whatsapp").delete().eq("id", conversaId)
}
```

- [ ] **Step 2: Verify**

Run: `cd app && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/lib/whatsapp/chat-actions.ts
git commit -m "feat(whatsapp): chat server actions (list/thread/reply/read/delete)"
```

---

## Task 7: Inbox UI + page + nav

**Files:**
- Create: `app/components/admin/atendimento/atendimento-client.tsx`
- Create: `app/app/admin/(authenticated)/atendimento/page.tsx`
- Modify: `app/components/admin/admin-nav.tsx`

Depends on Task 6. Uses `@/components/ui` primitives. No `window.confirm()`.

- [ ] **Step 1: Add the nav item** (`admin-nav.tsx`, inside `navItems`, after the WhatsApp entry)

```ts
  { href: "/admin/whatsapp", label: "WhatsApp" },
  { href: "/admin/atendimento", label: "Atendimento" },
  { href: "/admin/configuracoes", label: "Config" },
```

- [ ] **Step 2: Create the page (server component)**

```tsx
// app/app/admin/(authenticated)/atendimento/page.tsx
import { getConversas } from "@/lib/whatsapp/chat-actions"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"

export const dynamic = "force-dynamic"

const AtendimentoPage = async () => {
  const conversas = await getConversas()
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl text-brand-yellow mb-1">Atendimento</h1>
      <p className="text-sm text-brand-warm-gray mb-4">
        As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
      </p>
      <AtendimentoClient initial={conversas} />
    </div>
  )
}

export default AtendimentoPage
```

- [ ] **Step 3: Create the client component**

```tsx
// app/components/admin/atendimento/atendimento-client.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button, Textarea } from "@/components/ui"
import {
  enviarRespostaChat,
  getConversaMensagens,
  getConversas,
  markConversaRead,
  type ConversaResumo,
  type MensagemChat,
} from "@/lib/whatsapp/chat-actions"

const formatContato = (c: ConversaResumo) => c.nome ?? `+${c.telefone}`
const formatHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""

const AtendimentoClient = ({ initial }: { initial: ConversaResumo[] }) => {
  const [conversas, setConversas] = useState(initial)
  const [selId, setSelId] = useState<string | null>(initial[0]?.id ?? null)
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)

  const refetchConversas = useCallback(async () => setConversas(await getConversas()), [])
  const refetchMensagens = useCallback(async () => {
    if (selId) setMensagens(await getConversaMensagens(selId))
  }, [selId])

  // Realtime nas duas tabelas (mesmo padrão de orders-list.tsx).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-atendimento")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas_whatsapp" }, () => {
        refetchConversas()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_conversa_whatsapp" }, () => {
        refetchConversas()
        refetchMensagens()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetchConversas, refetchMensagens])

  // Ao selecionar: carrega a thread e zera não-lidas (sem mandar "visto" pro WhatsApp).
  useEffect(() => {
    if (!selId) return
    getConversaMensagens(selId).then(setMensagens)
    markConversaRead(selId).then(refetchConversas)
  }, [selId, refetchConversas])

  const handleSend = async () => {
    if (!selId || !texto.trim()) return
    setEnviando(true)
    const r = await enviarRespostaChat(selId, texto)
    if (r.ok) setTexto("")
    setEnviando(false)
  }

  return (
    <div className="flex gap-3 h-[70vh]">
      {/* Lista */}
      <div className="w-2/5 overflow-y-auto bg-brand-surface rounded-xl border border-white/10 divide-y divide-white/5">
        {conversas.length === 0 && <p className="p-4 text-sm text-brand-warm-gray">Nenhuma conversa ainda.</p>}
        {conversas.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelId(c.id)}
            className={`w-full text-left p-3 transition ${c.id === selId ? "bg-white/5" : "hover:bg-white/5"}`}
          >
            <div className="flex justify-between items-start">
              <span className="font-medium text-white">
                {formatContato(c)} {c.nome === null && <span className="text-xs text-brand-warm-gray">· sem cadastro</span>}
              </span>
              <span className="text-xs text-brand-warm-gray">{formatHora(c.ultimaEm)}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-brand-warm-gray truncate">{c.preview}</span>
              {c.naoLidas > 0 && (
                <span className="ml-2 shrink-0 bg-brand-yellow text-brand-black text-xs font-bold rounded-full px-2">
                  {c.naoLidas}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col bg-brand-surface rounded-xl border border-white/10 p-4">
        {selId ? (
          <>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
              {mensagens.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                    m.direcao === "saida"
                      ? "self-end bg-brand-yellow text-brand-black"
                      : "self-start bg-white/10 text-white"
                  }`}
                >
                  {m.corpo}
                  <span className="block text-[10px] opacity-60 mt-1">{formatHora(m.ocorridaEm)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-end">
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Responder…"
                rows={2}
                className="flex-1"
              />
              <Button variant="primary" onClick={handleSend} disabled={enviando || !texto.trim()}>
                {enviando ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </>
        ) : (
          <p className="m-auto text-brand-warm-gray">Selecione uma conversa.</p>
        )}
      </div>
    </div>
  )
}

export default AtendimentoClient
```

- [ ] **Step 4: Verify build**

Run: `cd app && npm run typecheck && npm run build`
Expected: typecheck clean; build succeeds. (If `Textarea` lacks a `className` passthrough, adjust to the primitive's API — check `app/components/ui`.)

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/atendimento/atendimento-client.tsx \
        "app/app/admin/(authenticated)/atendimento/page.tsx" \
        app/components/admin/admin-nav.tsx
git commit -m "feat(whatsapp): admin Atendimento inbox (list + thread + reply + realtime)"
```

---

## Task 8: End-to-end validation in staging

**Files:** none (manual validation against the paired staging number).

- [ ] **Step 1: Pre-checks**
  - App staging deployed; `INBOUND_WEBHOOK_SECRET` set on Vercel (Preview) and EC2 with the SAME value; EC2 running the new build (`pm2 logs whatsapp-api` shows no "Inbound webhook not configured").
  - WhatsApp paired (admin `/admin/whatsapp` shows "Conectado").

- [ ] **Step 2: Inbound (known cliente)** — from a phone whose number is a `cliente`, send a message to the paired number.
  Expected: appears in `/admin/atendimento` within ~2s, named, with an unread badge.

- [ ] **Step 3: Inbound (unknown)** — from a number with no `cliente`, send a message.
  Expected: appears as `+<number> · sem cadastro`.

- [ ] **Step 4: Reply from panel** — open the thread, type, Enviar.
  Expected: arrives on the customer's WhatsApp; the sent bubble appears in the thread (via echo) as `saida`.

- [ ] **Step 5: Reply from the phone** — reply to the same customer directly from the operator's WhatsApp app.
  Expected: that reply also appears in the panel as `saida` (proves both-direction capture).

- [ ] **Step 6: De-dupe** — confirm no duplicated bubbles after reconnect/echo.

- [ ] **Step 7: `markOnlineOnConnect:false`** — with the server connected, send a test message and confirm the operator's phone still shows a push notification.

- [ ] **Step 8: Record results** — note pass/fail per step in the spec's "State" or a follow-up comment; file any bug as a task.

---

## Self-Review

**Spec coverage:**
- Aba dedicada + thread por contato + responder → Tasks 6, 7. ✓
- `messages.upsert` passivo, só `notify`, ambas direções, placeholder de mídia, ignora grupos → Task 5 (`extractInbound`). ✓
- `markOnlineOnConnect:false` → Task 5 Step 2 + Task 8 Step 7. ✓
- Webhook com segredo próprio → Task 4 (`x-inbound-secret`, distinct var). ✓
- Match telefone↔cliente + fallback 8 dígitos → Task 2. ✓
- 2 tabelas + RLS admin-only + Realtime + RPC de-dupe → Task 1. ✓
- Realtime na UI → Task 7 Step 3. ✓
- Reply reusa `/send-message` (E.164) via porta `sendWhatsAppMessage` → Task 6 `enviarRespostaChat`. ✓
- Não insere no envio (fonte única = echo) → Task 6 comment + Task 8 Step 4. ✓
- Forward-only banner → Task 7 Step 2. ✓
- Exclusão por titular (LGPD) → Task 6 `excluirConversa`. ✓
- Retenção **adiada** (sem pg_cron) → Task 1 comment; nada implementado. ✓
- Grupos ignorados → Task 5. ✓
- Sem inserção otimista → Task 6/7 ("Enviando…" state). ✓

**Gaps / deferred (intentional, per spec):** retention job, dedicated number, privacy-notice copy, promote→prod — all prod gates, not v1 tasks.

**Placeholder scan:** none — every code step has full code; verify steps have exact commands + expected output.

**Type consistency:** `InboundPayload` fields (`telefone/waMessageId/direcao/corpo/ocorridaEm`) match between `app/lib/whatsapp/inbound.ts` (Task 3) and `whatsapp-api/src/inbound.ts` (Task 5). RPC param names (`p_telefone…p_ocorrida_em`) match between Task 1 and Task 4. `ConversaResumo`/`MensagemChat` shapes match between Task 6 and Task 7 usage. `register_inbound_whatsapp` name consistent (Task 1 ↔ Task 4).

---

## Execution Handoff

Per the owner's request, **execute via the Workflow tool** (not inline), mirroring the pattern that caught the 515/E.164 bugs:

1. **Build phase (parallel):** Tasks 1, 2, 3 in parallel (independent); then 4 + 5 in parallel (both depend only on 3 / 1+2+3); then 6; then 7. Each worker does the task's TDD steps and commits.
2. **Review phase (adversarial):** a reviewer pass per changed area (migration/RLS, webhook security + de-dupe, Baileys capture passivity, UI/Realtime) — verify: secret isolation, no `readMessages`/`sendPresenceUpdate`, de-dupe correctness (no double `nao_lidas`), RLS admin-only, both-direction capture.
3. **Validation:** Task 8 is manual (needs the live paired number + a real send) — surface to the owner with the checklist.

Alternatively this plan runs unmodified via superpowers:subagent-driven-development (fresh subagent per task) or superpowers:executing-plans (inline).
