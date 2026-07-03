# WhatsApp Inbox: system-message display + media/audio rendering

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** (A) Stop rendering external "AVISO DE TRANSBORDO" system messages as if they were replies sent to a customer — show them as neutral system notices in a separate area. (B) Make inbound media/audio actually appear in the inbox (type label + inline image/audio) instead of the `[mídia recebida — ver no celular]` placeholder.

**Architecture:** Inbound flow = EC2 Baileys (`whatsapp-api/src/inbound.ts` → `baileys.ts`) → HTTP webhook (`app/app/api/whatsapp/inbound/route.ts`) → RPC `register_inbound_whatsapp` (migration 022) → tables `conversas_whatsapp` / `mensagens_conversa_whatsapp` → admin UI (`app/components/admin/atendimento/*`) with Supabase realtime. Workstream A is 100% app-only. Workstream B requires an EC2 code change (media type/bytes are destroyed on the EC2 today, before the app sees them) + migration 030 + a private Storage bucket.

**Tech Stack:** Next.js 15 / React 19 / TS, Supabase (Postgres + Storage + RLS + realtime), vitest (+ jsdom/RTL opt-in per file), Node/Fastify/Baileys on EC2 (NO CI/CD — manual deploy).

## Global Constraints (verbatim, from the audit + investigation)
- **Classification signal (REQUIRED, robust):** a message is a transbordo/system notice iff `direcao='saida'` AND corpo contains `*AVISO DE TRANSBORDO*` AND contains `Anotei aqui` (validated: 0 false-pos / 0 false-neg over 1046 PROD msgs; covers 🔔 and 🔍 variants). **NEVER** classify by `cliente_id IS NULL` (77% are real leads) or by "zero inbound" alone. Centralize the strings in ONE helper.
- **A conversa is "sistema" (list-level) only under the STRICT rule:** every message matches the notice pattern AND the conversa has zero `entrada`. This preserves mixed threads like the …6738 contact (1 real inbound + 1 notice) as a normal customer thread.
- **Do not hide system threads entirely** — the owner asked to "show them differently", and the notices carry useful info. Neutral card + a "Sistema/Avisos" section.
- **Media type/bytes do not exist app-side today** — any media fix REQUIRES an EC2 change + manual EC2 deploy. App changes must stay backward-compatible with the current EC2 payload (no media fields → keep a labeled placeholder).
- **RPC signature trap:** `register_inbound_whatsapp(text,uuid,text,text,text,text,timestamptz)` — adding params (even with defaults) creates an OVERLOAD, not a replacement. Migration 030 MUST `drop function register_inbound_whatsapp(text,uuid,text,text,text,text,timestamptz)` first, then recreate, then re-issue the `revoke execute ... from anon, authenticated` for the NEW signature.
- **Storage:** new PRIVATE bucket `whatsapp-media`, RLS admin-only mirroring `conversas_whatsapp` (migration 022) and the `documentos` bucket pattern; serve via short-lived signed URLs (mirror `getDocumentSignedUrlByPath`, ~5 min). Size cap for inline transport (image/audio only inline; large video/doc → labeled placeholder, no bytes).
- **The external transbordo automation itself is NOT in scope** (it's an external tool on the WhatsApp account leaking PII to …0106; disabling is a client-side action). This plan only changes how OUR inbox displays its echoes.
- **Deploy order (hard requirement):** migration 030 (staging→prod) BEFORE app deploy; app deploy (backward-compatible) BEFORE or independent of EC2 deploy; EC2 deploy is manual & last. Every gate green: `npm --prefix app run typecheck && test && build`; `npm --prefix whatsapp-api run build && test`.
- Commit trailers required: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_011vQov9fd6qHob8mbpchWG6`.

---

## Workstream A — Transbordo display (app-only; ship first, independently)

### Task A1: `isTransbordoNotice` pure helper + tests
**Files:** Create `app/lib/whatsapp/transbordo.ts`, `app/lib/whatsapp/transbordo.test.ts`
**Produces:** `export const TRANSBORDO_MARKERS = ["AVISO DE TRANSBORDO", "Anotei aqui"] as const`; `export const isTransbordoNotice = (corpo: string | null | undefined): boolean` (true iff corpo contains BOTH markers, case-sensitive as they appear; trims/guards null).
- [ ] Write failing tests: real notice bodies (🔔 and 🔍 variants) → true; a normal customer msg, a msg containing only "AVISO", empty/null → false.
- [ ] Run tests → fail. Implement minimal helper. Run → pass.
- [ ] Commit.

### Task A2: conversa-level `sistema` flag in chat-actions
**Files:** Modify `app/lib/whatsapp/chat-actions.ts` (getConversas / ConversaResumo type). Test: `app/lib/whatsapp/chat-actions` has no existing test harness for SQL — add a focused unit test only if a pure function is extracted; otherwise rely on manual staging validation.
**Interfaces:** Add `sistema: boolean` to the conversa summary type. Compute per the STRICT rule. Since the TS helper can't run in SQL, compute `sistema` in the query via the same two markers, e.g. a conversa is sistema iff `NOT EXISTS (msg where direcao='entrada')` AND `NOT EXISTS (msg where NOT (corpo LIKE '%AVISO DE TRANSBORDO%' AND corpo LIKE '%Anotei aqui%'))`. Add a code comment linking this SQL pattern to `TRANSBORDO_MARKERS` (single source of truth in prose).
- [ ] Implement; verify types compile. (Behavioral validation on staging in the deploy step.)
- [ ] Commit.

### Task A3: UI — neutral system card + "Sistema/Avisos" section + suppress reply/CTA
**Files:** Modify `app/components/admin/atendimento/atendimento-client.tsx`, `app/components/admin/atendimento/thread-contexto.tsx`. Test: add `atendimento-client.test.tsx` (`// @vitest-environment jsdom`) covering: a `saida` msg where `isTransbordoNotice` → renders the neutral system card (not the yellow self-end bubble); a normal `saida` → yellow bubble.
- [ ] Message-level: branch on `isTransbordoNotice(m.corpo)` → render a neutral, centered "aviso do sistema" card (distinct style, not the yellow customer-reply bubble).
- [ ] List-level: group `sistema` conversas under a "Sistema / Avisos" section (or a Segmented Clientes/Sistema toggle), out of the normal customer list.
- [ ] For `sistema` threads: hide/disable the reply box; in `thread-contexto.tsx` suppress the "Vincular a um cliente" CTA.
- [ ] Write/run the jsdom test → pass. Gate: typecheck + test + build. Commit.

---

## Workstream B — Media Phase 1+2 (EC2 + migration + Storage + UI)

### Task B1: Migration 030 — media columns + RPC recreate + private bucket
**Files:** Create `supabase/migrations/030_whatsapp_midia.sql`
- [ ] `alter table mensagens_conversa_whatsapp add column if not exists midia_tipo text` (check in ('image','audio','video','document','sticker') — nullable), `add column if not exists midia_path text`, `add column if not exists mime_type text`.
- [ ] `drop function if exists register_inbound_whatsapp(text,uuid,text,text,text,text,timestamptz);` then recreate with 3 new trailing params `p_midia_tipo text default null, p_midia_path text default null, p_mime_type text default null` (insert them into the message row; keep the de-dupe + aggregate logic identical to 022). Re-issue `revoke execute on function register_inbound_whatsapp(text,uuid,text,text,text,text,timestamptz,text,text,text) from anon, authenticated;`.
- [ ] Create private bucket `whatsapp-media` (`insert into storage.buckets (id,name,public) values ('whatsapp-media','whatsapp-media',false) on conflict do nothing`) + storage.objects RLS admin-only for that bucket (mirror the `documentos` bucket policies; `is_admin()` for select/insert/update/delete scoped to `bucket_id='whatsapp-media'`).
- [ ] Apply to STAGING via Supabase MCP → validate (function has new signature; bucket exists; grants: authenticated cannot exec, service can) → THEN prod at deploy time.

### Task B2: App inbound payload + route — accept media, upload to Storage
**Files:** Modify `app/lib/whatsapp/inbound.ts` (InboundPayload type + parseInboundPayload), `app/app/api/whatsapp/inbound/route.ts`. Test: extend the existing inbound parser test with media-field cases (present, absent→backward-compat).
**Interfaces (Consumes from B3):** payload may carry `midiaTipo?: 'image'|'audio'|'video'|'document'|'sticker'`, `mimeType?: string`, `midiaBase64?: string` (bytes, only when under size cap), plus `corpo` (labeled placeholder or caption).
- [ ] parseInboundPayload: accept + validate the new optional fields; missing → undefined (backward-compatible).
- [ ] route.ts: if `midiaBase64` present, `createServiceClient().storage.from('whatsapp-media').upload(path, buffer, {contentType: mimeType})` with `path = ${conversaTelefoneDigits}/${wa_message_id}` (or similar deterministic key); on success pass `p_midia_path`; always pass `p_midia_tipo`/`p_mime_type` when known. Call `register_inbound_whatsapp` with the new params.
- [ ] TDD parser; run gate. Commit.

### Task B3: EC2 — download media + type label (REQUIRES manual EC2 deploy)
**Files:** Modify `whatsapp-api/src/inbound.ts` (lines ~6-14 payload type, ~56-61 media collapse), `whatsapp-api/src/baileys.ts` (~102-111 pass live socket to extractInbound). Test: `whatsapp-api/src/inbound.test.ts` — extend to assert media type detection + placeholder-by-type; mock downloadMediaMessage.
- [ ] Detect which media key matched (image/audio/video/document/sticker) + `ptt` flag for voice notes; set `midiaTipo` + a labeled placeholder corpo ('🎤 Áudio recebido', '🖼️ Imagem recebida', etc.) — this is Phase 1 value even if download fails.
- [ ] Call `downloadMediaMessage(msg,'buffer',{},{ reuploadRequest: sock.updateMediaMessage })` (needs live socket → thread it from baileys.ts). Apply a size cap (e.g. inline only image+audio ≤ N MB → base64 into payload; larger or video/doc → no bytes, keep labeled placeholder).
- [ ] Also handle location/contact/poll (today `return null` → message vanishes) → emit a labeled placeholder instead of dropping.
- [ ] TDD; `npm --prefix whatsapp-api run build && test` green. Commit. (Deploy is manual — see sequencing.)

### Task B4: UI — render media by type (signed URLs)
**Files:** Modify `app/lib/whatsapp/chat-actions.ts` (getConversaMensagens: return `midiaTipo` + a signed URL from `midia_path` via a 5-min signed URL, mirror `getDocumentSignedUrlByPath`), `app/components/admin/atendimento/atendimento-client.tsx`. Test: jsdom test — image row renders `<img>`, audio renders `<audio controls>`, missing path renders labeled placeholder.
- [ ] chat-actions: batch-sign URLs for the page of messages (avoid per-row round-trips; realtime re-fetch must stay cheap).
- [ ] UI: render `<img>` / `<audio controls>` / `<video>` / document download by `midiaTipo`; fallback to the labeled placeholder text when no `midia_path`.
- [ ] TDD; gate green. Commit.

### Task B5: Decouple bot media detection from the exact placeholder string
**Files:** Modify `app/lib/whatsapp/bot-agente-kb.ts` (MEDIA_PLACEHOLDER, ~line 10), `app/lib/whatsapp/bot-agente.ts` (`ehMidia`, ~line 98). Test: extend bot-agente tests so `ehMidia` recognizes all new labeled placeholders + a `midiaTipo` signal.
- [ ] Change `ehMidia` to detect media via `midiaTipo != null` and/or a prefix/regex over the labeled placeholders — NOT exact-string equality (which breaks once placeholders vary by type).
- [ ] TDD; gate green. Commit.

---

## Deploy sequencing (execute in this order; staging first)
1. **Migration 030** → apply to STAGING → validate → apply to PROD. (Must precede any app code that calls the new RPC signature.)
2. **App** (Tasks A1–A3, B2, B4, B5) → merge `feat/whatsapp-inbox-media` → `main` → Vercel prod auto-deploy. Backward-compatible with the current EC2 (no media fields → labeled placeholder / existing behavior). Transbordo UI (A) is fully live at this point.
3. **EC2** (Task B3) → manual: `npm --prefix whatsapp-api run build`, ship to the EC2 box, restart the process. Only after this does real media start flowing with type + bytes. Provide a written deploy runbook; user/Jean executes (no CI/CD).
4. **Verify:** Workstream A + media UI shell on staging (Playwright + DB). Media E2E (a real photo/audio rendering) only verifiable after the EC2 deploy — validate then.

## Notes / risks (from investigation)
- Historical 63 placeholder rows have no bytes — they will NOT retroactively render; only NEW media. Communicate to owner.
- Storage growth/retention deferred (like 022) — audio/video grow fast; decide a cap/retention later.
- Transport cap: base64 inflates ~33%; large media would blow the Next/Vercel body limit → enforce the size cap in B3.
- Keep the SUPABASE service-role key in the APP only (upload happens in the app route, B2), NOT on the EC2 box (avoids a new secret on EC2).
