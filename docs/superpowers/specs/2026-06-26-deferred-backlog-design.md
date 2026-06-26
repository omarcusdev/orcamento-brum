# Deferred Backlog — Design Spec

**Date:** 2026-06-26
**Context:** Applies the verified deferred backlog from the thermo-nuclear code review (PR #2). All work stacks onto the existing branch `refactor/thermo-nuclear-code-quality` and lands in **PR #2** (single PR, atomic commits per chunk). App is live (money + WhatsApp); `main` and prod stay untouched until merge.

## Decisions (locked)

1. **Delivery structure:** one PR, stacked on the current branch; clean per-chunk commits.
2. **Test infra:** add `jsdom` + `@testing-library/react` to the `app` vitest setup, and a minimal vitest setup to `whatsapp-api`. This is the safety net that unblocks the UI/server refactors.
3. **Frete lock:** single rule — frete is editable **only in `confirmado`** (locked from dispatch on). `isFreteLocked` becomes the one source; `FreteInput`, `updateFrete`, and `EditOrderDrawer` all respect it. (EditOrderDrawer tightens.)
4. **`confirm()` → `<Modal>`:** build a `<Modal>` primitive and replace all ~8 `window.confirm()/alert()` admin sites.
5. **`addPedidoItem` pricing:** reuse the canonical `priceManualOrderLines`/`calculateLine` (enforces "2º barril < à vista"). Fixes new orders; no audit/backfill of existing orders.
6. **`metodo_pagamento`:** render a payment badge on the order card (uses already-fetched data) rather than dropping the column.
7. **Non-atomic mutations:** transactional **Postgres RPC** for `createManualOrder` (cliente + pedido + itens + status_log in one transaction). Item add/update/remove get robust ordering/cleanup (full RPC for those is a possible later extension, not in scope here).

**Behavior is preserved everywhere EXCEPT these four intentional changes:** frete-lock tightening (#3), confirm→modal (#4), email `pix`→`Pix`, and the `addPedidoItem` price guard (#5). Everything else is a pure refactor / dead-code removal.

## Phase 0 — Test infrastructure (enables the rest)

- `app/vitest.config.ts`: enable `jsdom` (per-file `// @vitest-environment jsdom` or `environmentMatchGlobs` so the existing node-env pure tests are unaffected). Add `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` (devDeps), a `vitest.setup.ts`.
- One smoke component test (e.g. an existing UI primitive) proving the jsdom path renders.
- `whatsapp-api`: add `vitest` devDep + config + one smoke test.
- **Gate:** `npm run test` green in both packages; `tsc` + `build` unaffected.

## Phase 1 — Correctness (group A)

- **`addPedidoItem`** (`lib/admin-actions/pedido-edit.ts`): replace the hand-rolled barrel pricing with the canonical path so the "2º barril must be < à vista" guard applies. TDD: add cases (single, consignado, 2º-barril-not-cheaper) to `pricing.test.ts` / a new test, then refactor.
- **`createManualOrder` atomicity:** new migration adds a plpgsql function (e.g. `create_manual_order(...)`) that inserts cliente (if new) + pedido + pedido_itens + pedido_status_log in one transaction and returns the pedido id. The server action keeps pricing in TS (pure `calculateStoredTotals`) and passes computed rows to the RPC. Removes the orphan-cliente window.
- **`getDocumentSignedUrl`** (`lib/admin-actions/documentos.ts`): drop the dead `'pessoal'` branch / consolidate with `getDocumentSignedUrlByPath`.
- **`metodo_pagamento` badge:** render a small payment badge on `order-card.tsx` (data already in `PEDIDO_LIST_SELECT`).
- **Gate:** new unit tests green; `tsc` + `build` green; migration applied to staging first, then prod on merge.

## Phase 2 — UI primitives + dedup (group C)

- **`<Modal>`** primitive in `components/ui/` (overlay + card + Esc + scroll-lock + focus) — replaces ~9 hand-rolled modal scaffolds. Component test.
- **`<Drawer>`** primitive (right-side slide-over; consistent Esc + scroll-lock) — dedup `manual-order-drawer`, `edit-order-drawer`, `whatsapp/config-drawer`. Component test.
- **Email shell:** extract `emailDocument()` + `ctaButton()` + order-section builders in `lib/email.ts`; lock output with a **golden string test** (render before/after equal).
- **`<FeaturePanel>` + `useOptimisticFlag`:** dedup the 4 WhatsApp config panels (agente/bot/lembrete/status-entrega). Component test for the shared panel.
- **Address-autocomplete block:** extract the shared toggle + `AddressData → endereco_completo` mapping used by manual + edit drawers.
- **`checkout-form` (588 lines):** extract the embedded date/time picker + the repeated validation guards into focused units.
- **Smaller dedups:** `content-editor` → UI primitives; `status-actions` → reuse `OrderStatusBadge`; phone display mask → a canonical `formatPhone` in `lib/format.ts` (distinct from the E.164 normalization in `lib/whatsapp/phone.ts`); message-builder micro-formatters (first name, short id, `HH:MM`) → shared.
- **Gate:** component tests green; `tsc` + `build` green; Playwright/Chrome visual spot-check on the touched admin screens.

## Phase 3 — Product decisions (group B)

- Replace all `window.confirm()/alert()` (~8 sites: document-section, order-card, archive-toggle, status-actions, dispatch-modal, …) with a confirmation `<Modal>`.
- Frete-lock: make `isFreteLocked` the single source; `EditOrderDrawer` + `FreteInput` + `updateFrete` all lock frete after dispatch.
- Email admin text: `pix` → `Pix` via `metodoLabel` (the one line intentionally left raw in PR #2).
- **Gate:** component tests for the modal flows; visual QA; `tsc` + `build` green.

## Phase 4 — whatsapp-api server (group D)

- Extract `clearPairingState` helper (dedup the 5 inline cleanups) and a signed-webhook `postSigned()` helper (dedup `sendDownAlert` / `forwardInbound`).
- Add vitest tests for both (now that infra exists). Keep observable log output unchanged unless explicitly noted.
- **Gate:** new tests green; `tsc`/build of `whatsapp-api`.

## Phase 5 — Dead code + nits (group E)

- Remove confirmed-unused exports (4 type aliases; the unwired LGPD action in `chat-actions.ts` — re-grep to confirm dead first).
- `Button.loading`: remove the prop (1 caller, renders no spinner today) and update that caller.
- Remove dead `markerRef` in `area-map-editor`.
- Fix the `status_log` double-log.
- Fix the **safe** eslint findings (unused vars/imports). Leave the behavior-affecting ones (`any` on the Supabase-untyped order page, `setState`-in-effect) noted — out of scope here.
- **Gate:** `tsc` + `test` + `build` green; lint count strictly lower.

## Testing strategy

- Pure logic: vitest node-env (current).
- Components: vitest jsdom + Testing Library (Phase 0).
- Email: golden string tests.
- `whatsapp-api`: vitest.
- Visual: Playwright/Chrome before/after on touched admin screens.
- Every chunk keeps `tsc` + full `test` + `build` green before commit.

## Sequencing & rationale

`0 → 1 → 2 → 3 → 4 → 5`. Infra first (unblocks safe UI/server work); correctness next (highest value, real money/data risk); primitives before the product changes that consume them (`<Modal>` before confirm→modal); server and faxina last. Each phase is one or more atomic commits on the branch; the PR grows but stays reviewable commit-by-commit.

## Out of scope (explicitly)

- Backfilling/auditing existing consignado orders affected by the old `addPedidoItem` bug.
- Full transactional RPCs for item add/update/remove (only `createManualOrder` gets one now).
- `any`-typing the Supabase order rows and the `setState`-in-effect refactors (behavioral; noted, deferred).
- Merging PR #2 / promoting to prod — happens after review, separately.

## Success criteria

- All five groups (A–E) addressed per the decisions above.
- `tsc` clean, full vitest suite green (app + whatsapp-api), `next build` clean, lint count reduced.
- The four intentional behavior changes verified (frete lock, modal confirmations, email label, item price guard); everything else behavior-preserving.
- `createManualOrder` is atomic (no orphan-cliente window).
