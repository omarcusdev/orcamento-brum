# ALFA Chopp Delivery (cliente Brum) — Monorepo

This repo started as a commercial proposal and grew into the full ALFA Chopp Delivery platform.

## Repo layout

- `app/` — **Next.js 15 delivery platform** (the live product). React 19, Tailwind v4, Supabase backend. Deployed to https://www.alfachopp.com.br.
- `orcamento/` — Original single-page commercial proposal (HTML + Tailwind). Now archived. Deployed at https://proposta-delivery-chopp.vercel.app.
- `whatsapp-api/` — WhatsApp Baileys server (Node + Fastify). NOT yet deployed to a VPS.
- `supabase/` — Migrations (001–021), seed scripts, docs. CLI linked to `rhuqttionnpfnftkmvmq`.
- `docs/` — `plans/` and `superpowers/specs/` + `superpowers/plans/` for phase artifacts.
- `logos/` — Brand assets.
- `posts-alfa-bot/` — Marketing automation drafts.
- `BRIEFING.md` — Original client brief.

## Production
- **Frontend (app)**: https://www.alfachopp.com.br (Vercel auto-deploy on push to `main`)
- **Supabase**: https://rhuqttionnpfnftkmvmq.supabase.co
- **Admin login**: admin@alfachopp.com / Alfa2026chopp
- **CI**: `.github/workflows/checks.yml` — typecheck + build required gates; lint informational

## Brand (ALFA)
- Yellow `#E8B912`, Amber `#D4A017`, Gold `#C49B0C`, Black `#1A1A1A`, Dark `#0D0D0D`, Surface `#1F1F1F`, Cream `#F5F0E8`, Warm Gray `#8A8278`.
- Fonts: Bebas Neue (uppercase headings) + DM Sans (body).

## Status flow (canonical)
```
confirmado → enviar_para_entregador → em_rota → entregue → pago → recolhido
```
`cancelado` at any non-`recolhido` stage. Migration 013 removed `aguardando_documentos`.

Editable in: `confirmado`, `enviar_para_entregador`, `em_rota`. Locked from `entregue` onward.

## Key conventions
- Server Actions for mutations (`app/lib/actions.ts`, `app/lib/admin-actions.ts`).
- `"use server"` files must only export async functions — put helper constants and pure functions in non-server files (e.g. `app/lib/admin-status.ts`).
- Supabase service client (`createServiceClient`) only when bypassing RLS is needed (storage uploads). Otherwise use auth-aware client from `requireAdmin()`.
- New tables need explicit admin UPDATE/DELETE RLS policies — migration 021 was a corrective for `pedido_itens` missing these.
- Documento de identidade is `clientes.documento_pessoal_urls TEXT[]` (1-2 photos). Storage paths: `{clienteId}/pessoal-1` / `{clienteId}/pessoal-2`.

## Most recent work
- **2026-05-14** — Admin operacional features: manual order drawer, voltar status, identidade frente+verso, consignado, desverificar doc, editar pedido. Spec: `docs/superpowers/specs/2026-05-13-admin-operacional-design.md`.

## Deploy
Push to `main` → GH Actions checks → Vercel auto-deploy.
Manual fallback: `cd app && vercel --prod`.
Supabase migrations: write SQL into `supabase/migrations/<NNN>_<name>.sql`, then `apply_migration` via Supabase MCP or `supabase db push` from repo root (CLI must be run from repo root, not `supabase/` subdir).

## Original proposal context (archived)
See `orcamento/` and `BRIEFING.md`. Pricing/timeline (R$15k → bumped to R$21k for Fase 3+; 40-day initial scope) — these are historical, no longer the active scope.
