# Deferred Backlog — Phase 3 (Product decisions / group B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three intentional product-behavior changes from the backlog: replace every `window.confirm()/alert()` admin site with a `<Modal>`-based confirm flow, make `isFreteLocked` the single enforced source (EditOrderDrawer + server), and render the payment method as a friendly label in the admin email text + order-detail page.

**Architecture:** A small `ConfirmProvider` + `useConfirm()` hook (built on the existing `<Modal>` primitive) exposes async `confirm()/alert()` so imperative `if (!confirm(...)) return` flows become `if (!(await confirm(...))) return` with minimal change; it's mounted once in the admin authenticated layout. The frete lock reuses the existing `isFreteLocked` helper. A shared `metodoPagamentoLabel` helper centralizes the payment-method label.

**Tech Stack:** Next.js 15 (App Router) / React 19 / TypeScript / Tailwind v4 / framer-motion / vitest 2.1.9 (+ jsdom + @testing-library/react, opt-in per file).

## Global Constraints

- **Branch:** all work stacks on `refactor/thermo-nuclear-code-quality` (single PR #2). Do NOT merge, do NOT branch, do NOT touch `main`.
- **Per-commit gate (all green before every commit):** `npm --prefix app run typecheck` && `npm --prefix app run test` && `npm --prefix app run build` (from repo root).
- **Commit trailers (every commit, exactly):**
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011vQov9fd6qHob8mbpchWG6
  ```
- **These ARE the intentional behavior changes** (unlike Phases 0–2 which were behavior-preserving): (a) confirm/alert dialogs become in-app modals (fixes the Safari-iPad `window.confirm` swallow bug — the reason this phase exists); (b) frete becomes editable ONLY in `confirmado` everywhere (EditOrderDrawer tightens to match the server + FreteInput); (c) the admin email text + order-detail page show `Pix`/`Cartão`/`Dinheiro` instead of raw `pix`/`cartao`/`dinheiro`. Everything else stays behavior-preserving.
- **Preserve the exact confirmation/alert MESSAGE STRINGS** when moving them into modals (same Portuguese text the user already sees), unless a title/body split is specified per-site below.
- **jsdom opt-in:** component tests are `*.test.tsx` whose FIRST line is `// @vitest-environment jsdom`.
- **Code style:** functional components, arrow functions, no classes; brand tokens verbatim (`bg-brand-surface`, `text-brand-warm-gray`, `font-display`, etc.); `@/` import alias. Reuse the existing `<Modal>` and `<Button>` primitives — do NOT hand-roll new overlays.
- The App Router lives at `app/app/...` (the Next package root is `app/`). UI primitives are at `app/components/ui/`.

---

## File Structure (what each new file owns)

- `app/components/admin/confirm-provider.tsx` — `ConfirmProvider` (context + the single confirm/alert Modal) and the `useConfirm()` hook. Built on `<Modal>` + `<Button>`.
- Additions to `app/lib/format.ts` — `metodoPagamentoLabel(metodo: string | null): string`.
- Modified: the authenticated admin layout (mount the provider), the ~5 confirm/alert call sites, `edit-order-drawer.tsx` + `updatePedido` (frete lock), `lib/admin-status.ts` (comment), `email.ts` + the order-detail page (label).

---

### Task 1: `ConfirmProvider` + `useConfirm` (modal-based confirm/alert) + mount

**Files:**
- Create: `app/components/admin/confirm-provider.tsx`
- Modify: `app/app/admin/(authenticated)/layout.tsx`
- Test: `app/components/admin/confirm-provider.test.tsx`

**Interfaces:**
- Consumes: `Modal`, `Button` from `@/components/ui`.
- Produces:
  ```ts
  type ConfirmOptions = { title: string; message?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; variant?: "danger" | "primary" }
  type AlertOptions = { title: string; message?: React.ReactNode; okLabel?: string }
  export const ConfirmProvider: (props: { children: React.ReactNode }) => JSX.Element
  export const useConfirm: () => { confirm: (o: ConfirmOptions) => Promise<boolean>; alert: (o: AlertOptions) => Promise<void> }
  ```
  `confirm` resolves `true` on the confirm button, `false` on cancel/backdrop/Esc. `alert` resolves on OK/backdrop/Esc.

- [ ] **Step 1: Write the failing test**

`app/components/admin/confirm-provider.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { useState } from "react"
import { ConfirmProvider, useConfirm } from "./confirm-provider"

afterEach(cleanup)

const Harness = () => {
  const { confirm, alert } = useConfirm()
  const [out, setOut] = useState("")
  return (
    <>
      <button onClick={async () => setOut(String(await confirm({ title: "Excluir?", message: "Tem certeza?", confirmLabel: "Excluir" })))}>ask</button>
      <button onClick={async () => { await alert({ title: "Erro", message: "Falhou" }); setOut("alerted") }}>warn</button>
      <span data-testid="out">{out}</span>
    </>
  )
}

const renderHarness = () => render(<ConfirmProvider><Harness /></ConfirmProvider>)

describe("ConfirmProvider / useConfirm", () => {
  it("resolves true when the confirm button is clicked", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    expect(screen.getByText("Tem certeza?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("true"))
  })

  it("resolves false when cancelled", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("false"))
  })

  it("resolves false on Escape", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("false"))
  })

  it("alert shows a single OK and resolves", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("warn"))
    expect(screen.getByText("Falhou")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "OK" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("alerted"))
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- confirm-provider.test.tsx`
Expected: FAIL — `Cannot find module './confirm-provider'`.

- [ ] **Step 3: Implement `app/components/admin/confirm-provider.tsx`**
```tsx
"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { Modal, Button } from "@/components/ui"

type ConfirmOptions = {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
}
type AlertOptions = { title: string; message?: ReactNode; okLabel?: string }

type Request =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void }

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  alert: (opts: AlertOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export const useConfirm = (): ConfirmContextValue => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>")
  return ctx
}

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [request, setRequest] = useState<Request | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ kind: "confirm", opts, resolve })),
    [],
  )
  const alert = useCallback(
    (opts: AlertOptions) => new Promise<void>((resolve) => setRequest({ kind: "alert", opts, resolve })),
    [],
  )

  // Resolve the pending promise and unmount the modal. Backdrop/Esc route here with `false`.
  const settle = (result: boolean) => {
    if (!request) return
    if (request.kind === "confirm") request.resolve(result)
    else request.resolve()
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {request && (
        <Modal onClose={() => settle(false)} maxWidth="sm" title={request.opts.title}>
          {request.opts.message && <p className="text-sm text-brand-warm-gray mb-5">{request.opts.message}</p>}
          <div className="flex gap-3">
            {request.kind === "confirm" && (
              <Button variant="secondary" onClick={() => settle(false)} className="flex-1">
                {request.opts.cancelLabel ?? "Cancelar"}
              </Button>
            )}
            <Button
              variant={request.kind === "confirm" ? (request.opts.variant ?? "primary") : "primary"}
              onClick={() => settle(true)}
              className="flex-1"
            >
              {request.kind === "confirm" ? (request.opts.confirmLabel ?? "Confirmar") : (request.opts.okLabel ?? "OK")}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix app run test -- confirm-provider.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount the provider in the authenticated admin layout**

In `app/app/admin/(authenticated)/layout.tsx`, add `import { ConfirmProvider } from "@/components/admin/confirm-provider"` and wrap the returned tree:
```tsx
  return (
    <ConfirmProvider>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </div>
    </ConfirmProvider>
  )
```
(The layout stays an async server component; `ConfirmProvider` is a client component receiving server-rendered `children` — valid in the App Router.)

- [ ] **Step 6: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/confirm-provider.tsx app/components/admin/confirm-provider.test.tsx "app/app/admin/(authenticated)/layout.tsx"
git commit   # "feat(admin): add modal-based useConfirm provider"
```

---

### Task 2: Replace all `window.confirm()/alert()` admin sites with `useConfirm`

**Files:**
- Modify: `app/components/admin/order-card.tsx`
- Modify: `app/components/admin/archive-toggle.tsx`
- Modify: `app/components/admin/document-section.tsx`
- Modify: `app/components/admin/dispatch-modal.tsx`
- Modify: `app/components/admin/status-actions.tsx`

**Interfaces:**
- Consumes: `useConfirm` from `@/components/admin/confirm-provider` (Task 1).

**Mechanical pattern:** every handler below is already `async`. Replace `if (!confirm("…")) return` with `if (!(await confirm({ title, message, confirmLabel, variant }))) return`, preserving the original message text as `message`. Replace `alert(msg)` with `await alert({ title: "Erro", message: msg })`. Add `const { confirm, alert } = useConfirm()` (or just `confirm`) at the top of each component.

- [ ] **Step 1: `order-card.tsx`**

Add `import { useConfirm } from "@/components/admin/confirm-provider"`. Inside `OrderCard`, add `const { confirm, alert } = useConfirm()`. Rewrite `handleArchiveClick`:
```tsx
  const handleArchiveClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    if (
      !arquivado &&
      !(await confirm({
        title: "Excluir pedido",
        message: `Excluir o pedido de ${pedido.clientes.nome} da esteira? Vai pra aba 'Arquivados' e pode ser restaurado.`,
        confirmLabel: "Excluir",
        variant: "danger",
      }))
    )
      return
    setBusy(true)
    try {
      if (arquivado) {
        await unarchiveOrder(pedido.id)
      } else {
        await archiveOrder(pedido.id)
      }
    } catch (err) {
      await alert({ title: "Erro", message: err instanceof Error ? err.message : "Erro ao processar" })
    } finally {
      setBusy(false)
    }
  }
```

- [ ] **Step 2: `archive-toggle.tsx`**

Add `import { useConfirm } from "@/components/admin/confirm-provider"` + `const { confirm } = useConfirm()`. Rewrite the guard in `handle`:
```tsx
    if (
      !arquivado &&
      !(await confirm({
        title: "Excluir pedido",
        message: "Excluir este pedido da esteira? Ele vai pra aba 'Arquivados' e pode ser restaurado depois.",
        confirmLabel: "Excluir",
        variant: "danger",
      }))
    )
      return
```

- [ ] **Step 3: `document-section.tsx` — revert confirm + replace the hand-rolled verify modal**

Add `import { useConfirm } from "@/components/admin/confirm-provider"` + `const { confirm } = useConfirm()`. Remove `import { motion, AnimatePresence } from "framer-motion"` and the `showConfirmModal` state. Rewrite `handleRevertVerification`'s guard:
```tsx
    if (
      !(await confirm({
        title: "Desfazer verificação",
        message: "Desfazer verificacao do documento? Sera necessario verificar novamente antes de avancar.",
        confirmLabel: "Desfazer",
      }))
    )
      return
```
Rewrite `handleVerify` to ask first (replacing the hand-rolled modal trigger):
```tsx
  const handleVerify = async () => {
    if (
      !(await confirm({
        title: "Confirmar verificação",
        message: "Tem certeza que deseja marcar os documentos como verificados? O pedido podera avancar apos esta acao.",
        confirmLabel: "Verificar",
      }))
    )
      return
    setVerifying(true)
    try {
      await verifyDocument(clienteId, pedidoId)
      setVerified(true)
      setStatus("verificado")
      setVerifiedAt(new Date().toISOString())
    } catch {
      setDocError("Erro ao verificar documentos")
    }
    setVerifying(false)
  }
```
Change the "Verificar documentos" button's `onClick={() => setShowConfirmModal(true)}` to `onClick={handleVerify}`. DELETE the entire `<AnimatePresence>{showConfirmModal && (…)}</AnimatePresence>` block (lines ~208-246) and change the outer `return ( <> … </> )` to just `return ( <div…>…</div> )` (the fragment is no longer needed once the second child is gone — keep the single root `<div className="bg-brand-surface …">`).

- [ ] **Step 4: `dispatch-modal.tsx`**

Add `import { useConfirm } from "@/components/admin/confirm-provider"` + `const { confirm } = useConfirm()`. Replace the two `confirm(...)` calls in `handleConfirm`:
```tsx
    if (
      documentoStatus !== "verificado" &&
      !(await confirm({
        title: "Documentação não verificada",
        message: "Documentacao ainda nao verificada. Deseja despachar mesmo assim?",
        confirmLabel: "Despachar mesmo assim",
      }))
    )
      return
    if (
      frete === 0 &&
      !(await confirm({
        title: "Frete não definido",
        message: "Frete nao definido. Apos o despacho, o valor do frete nao podera mais ser alterado. Deseja continuar sem frete?",
        confirmLabel: "Continuar sem frete",
      }))
    )
      return
```
(The confirm modal renders from the provider at the layout root, so it correctly stacks above this dispatch Modal.)

- [ ] **Step 5: `status-actions.tsx`**

Add `import { useConfirm } from "@/components/admin/confirm-provider"` + `const { confirm } = useConfirm()`. Replace the frete guard in `handleAdvance`:
```tsx
    if (
      frete === 0 &&
      !(await confirm({ title: "Frete não definido", message: "Frete nao definido. Deseja continuar sem frete?", confirmLabel: "Continuar sem frete" }))
    )
      return
```
Replace the guard in `handleCancel`:
```tsx
    if (
      !(await confirm({
        title: "Cancelar pedido",
        message: "Tem certeza que deseja cancelar este pedido?",
        confirmLabel: "Sim, cancelar",
        variant: "danger",
      }))
    )
      return
```

- [ ] **Step 6: Grep to confirm no `window.confirm`/`alert(` remain in admin components**

Run: `grep -rn "confirm(\|alert(" app/components/admin app/app/admin --include="*.tsx" | grep -v "useConfirm\|await confirm\|await alert\|confirm-provider\|setShowConfirm"`
Expected: no matches (every site migrated). (`useConfirm`/`await confirm`/`await alert` calls are fine.)

- [ ] **Step 7: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/order-card.tsx app/components/admin/archive-toggle.tsx app/components/admin/document-section.tsx app/components/admin/dispatch-modal.tsx app/components/admin/status-actions.tsx
git commit   # "refactor(admin): replace window.confirm/alert with modal useConfirm"
```

---

### Task 3: Make `isFreteLocked` the single enforced source (EditOrderDrawer + server)

**Files:**
- Modify: `app/components/admin/edit-order-drawer.tsx`
- Modify: `app/lib/admin-actions/pedido-edit.ts`
- Modify: `app/lib/admin-status.ts`
- Test: `app/components/admin/edit-order-drawer.test.tsx`

**Interfaces:**
- Consumes: `isFreteLocked` from `@/lib/admin-status` (already exists: `isFreteLocked(status) === true` for `enviar_para_entregador`/`em_rota`/`entregue`/`pago`/`recolhido`/`cancelado`; `false` for `confirmado`).

**Intentional behavior change:** frete becomes non-editable in EditOrderDrawer once the order is past `confirmado` (matching the server guard in `updateFrete` and the read-only `FreteInput` on the detail page). The known divergence noted in `admin-status.ts` is resolved.

- [ ] **Step 1: Write the failing component test**

`app/components/admin/edit-order-drawer.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({
  updatePedido: vi.fn(), addPedidoItem: vi.fn(), removePedidoItem: vi.fn(), updatePedidoItem: vi.fn(),
}))

import EditOrderDrawer from "./edit-order-drawer"

const basePedido = {
  id: "p1", data_evento: "2026-07-15", horario_evento: "18:00:00", endereco: "Rua A, 1",
  endereco_completo: null, observacoes: null, rampas_escadas: null, tipo_chopeira: "gelo" as const,
  frete: 50, desconto: 0, metodo_pagamento: "pix" as const, pago: false,
}
const produtos = [{ id: "prod1", marca: "Heineken", volume_litros: 50 }] as never[]

afterEach(cleanup)

describe("EditOrderDrawer frete lock", () => {
  it("frete input is editable in confirmado", () => {
    render(<EditOrderDrawer open onClose={() => {}} pedido={{ ...basePedido, status: "confirmado" }} items={[]} produtos={produtos} />)
    expect(screen.getByLabelText("Frete")).not.toBeDisabled()
  })
  it("frete input is disabled once dispatched (enviar_para_entregador)", () => {
    render(<EditOrderDrawer open onClose={() => {}} pedido={{ ...basePedido, status: "enviar_para_entregador" }} items={[]} produtos={produtos} />)
    expect(screen.getByLabelText("Frete")).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- edit-order-drawer.test.tsx`
Expected: FAIL — the frete input is currently always enabled, so the second test fails (`expect(...).toBeDisabled()`).

- [ ] **Step 3: Lock frete in `edit-order-drawer.tsx`**

Add `import { isFreteLocked } from "@/lib/admin-status"`. Inside `EditOrderDrawer`, after the state declarations, add:
```tsx
  const freteLocked = isFreteLocked(pedido.status)
```
Change the Frete `MoneyInput` (the one with `aria-label="Frete"`) to add `disabled={freteLocked}`:
```tsx
                      <MoneyInput value={frete} onChange={setFrete} min={0} disabled={freteLocked} aria-label="Frete" />
```
And directly under that Frete field's `<label>`/input, when locked, render a hint (place it inside the same `<div>` that wraps the Frete label + input):
```tsx
                      {freteLocked && <p className="text-[11px] text-brand-warm-gray mt-1">Travado após o despacho</p>}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix app run test -- edit-order-drawer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the server-side frete guard in `updatePedido`**

In `app/lib/admin-actions/pedido-edit.ts`, inside `updatePedido`, immediately after the `LOCKED_EDIT_STATUSES` check (the `if (LOCKED_EDIT_STATUSES.includes(pedido.status)) { throw … }` block), add:
```ts
  if (isFreteLocked(pedido.status) && changes.frete !== undefined && changes.frete !== pedido.frete) {
    throw new Error("Frete nao pode ser alterado apos despacho")
  }
```
(`isFreteLocked` is already imported in this file. This mirrors the guard in `updateFrete` — defense-in-depth so a locked-status frete change is rejected even if the UI is bypassed. Unchanged frete passes through untouched.)

- [ ] **Step 6: Update the stale comment in `app/lib/admin-status.ts`**

Replace the comment above `FRETE_LOCKED_STATUSES` (the lines noting the EditOrderDrawer divergence) with:
```ts
// Frete trava do despacho em diante: FreteInput vira read-only, updateFrete/updatePedido rejeitam a
// alteração, e o EditOrderDrawer desabilita o campo. Editável apenas em "confirmado".
```

- [ ] **Step 7: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/edit-order-drawer.tsx app/components/admin/edit-order-drawer.test.tsx app/lib/admin-actions/pedido-edit.ts app/lib/admin-status.ts
git commit   # "fix(admin): lock frete after dispatch in EditOrderDrawer + updatePedido"
```

---

### Task 4: Friendly payment-method label (admin email text + order-detail page)

**Files:**
- Modify: `app/lib/format.ts`
- Modify: `app/lib/format.test.ts`
- Modify: `app/lib/email.ts`
- Modify: `app/components/admin/order-card.tsx`
- Modify: `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`

**Interfaces:**
- Produces (added to `app/lib/format.ts`):
  ```ts
  export const metodoPagamentoLabel: (metodo: string | null) => string
  // "pix" -> "Pix", "cartao" -> "Cartão", "dinheiro" -> "Dinheiro", null/unknown -> raw or "—"
  ```

- [ ] **Step 1: Add the failing test in `app/lib/format.test.ts`**

Append:
```ts
import { metodoPagamentoLabel } from "./format"

describe("metodoPagamentoLabel", () => {
  it("maps known methods to friendly labels", () => {
    expect(metodoPagamentoLabel("pix")).toBe("Pix")
    expect(metodoPagamentoLabel("cartao")).toBe("Cartão")
    expect(metodoPagamentoLabel("dinheiro")).toBe("Dinheiro")
  })
  it("renders a dash for null", () => {
    expect(metodoPagamentoLabel(null)).toBe("—")
  })
  it("falls back to the raw value for unknown methods", () => {
    expect(metodoPagamentoLabel("boleto")).toBe("boleto")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- format.test.ts`
Expected: FAIL — `metodoPagamentoLabel` not exported.

- [ ] **Step 3: Implement in `app/lib/format.ts`**

Append:
```ts
const METODO_PAGAMENTO_LABELS: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" }

// Friendly payment-method label. null -> "—"; unknown -> the raw value (so nothing is hidden).
export const metodoPagamentoLabel = (metodo: string | null): string =>
  metodo ? (METODO_PAGAMENTO_LABELS[metodo] ?? metodo) : "—"
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix app run test -- format.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the order-detail page**

In `app/app/admin/(authenticated)/pedidos/[id]/page.tsx`, add `metodoPagamentoLabel` to the existing `@/lib/format` import. Change the payment line (currently `<span className="text-brand-yellow">{pedido.metodo_pagamento ?? "—"}</span>`) to:
```tsx
                <span className="text-brand-yellow">{metodoPagamentoLabel(pedido.metodo_pagamento)}</span>
```

- [ ] **Step 6: Use it in `order-card.tsx` (dedup the local record)**

Add `metodoPagamentoLabel` to the `@/lib/format` import. Delete the local `const metodoLabel: Record<string, string> = { … }`. Change the badge body from `{metodoLabel[pedido.metodo_pagamento] ?? pedido.metodo_pagamento}` to `{metodoPagamentoLabel(pedido.metodo_pagamento)}` (it stays inside the `{pedido.metodo_pagamento && (…)}` guard, so the value is always non-null there).

- [ ] **Step 7: Fix the raw metodo in the admin email TEXT renderer**

In `app/lib/email.ts`, the `renderText` function has the line `` `Pagamento: ${data.metodoPagamento ?? "—"}`, `` (the admin "novo pedido" email's plain-text part — the one line left raw in PR #2). Change it to use the existing module-local `metodoLabel` function:
```ts
    `Pagamento: ${metodoLabel(data.metodoPagamento)}`,
```
(`metodoLabel` is already defined in `email.ts` and already used by `renderHtml`/`renderCustomerText`. The HTML golden tests are unaffected — only this text line changes. Do NOT touch `email-template.ts` or the goldens.)

- [ ] **Step 8: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/format.ts app/lib/format.test.ts app/lib/email.ts app/components/admin/order-card.tsx "app/app/admin/(authenticated)/pedidos/[id]/page.tsx"
git commit   # "feat(admin): friendly payment-method label in email text + order detail"
```

---

## Final whole-branch review (after Task 4)

Dispatch the final reviewer (most-capable model) over the Phase 3 range with `scripts/review-package <phase3-base> HEAD`. Hand it the Global Constraints (the 3 intentional changes + preserved message strings) and confirm: every `window.confirm/alert` admin site is gone; the confirm modal renders above the dispatch modal; frete is locked in EditOrderDrawer + `updatePedido` for non-`confirmado` statuses; the email text + order-detail show friendly labels; no behavior change beyond the 3 intended ones.

## Post-phase visual QA (Playwright/Chrome)

- A destructive confirm (archive a pedido / cancel an order): modal appears, Cancel/Esc aborts, Confirm proceeds.
- Document verify + "Revisar de novo": both now go through the confirm modal.
- Dispatch with frete 0 / docs unverified: confirm modal stacks above the dispatch modal.
- Open EditOrderDrawer on a dispatched order: frete field disabled with the "Travado após o despacho" hint; on a `confirmado` order it's editable.
- Order-detail payment line shows `Pix`/`Cartão`/`Dinheiro`.

## Success criteria

- All ~8 `window.confirm()/alert()` admin sites + the hand-rolled document-verify modal use `useConfirm`/`<Modal>`; zero `window.confirm`/`alert(` left in admin.
- Frete editable only in `confirmado` across FreteInput (already), `updateFrete` (already), EditOrderDrawer (new), and `updatePedido` (new guard).
- Admin email text + order-detail render the friendly payment label; order-card uses the shared helper.
- `tsc` clean, full vitest green (new tests added), `next build` clean.

## Self-review notes (author)

- **Spec coverage:** confirm→Modal (T1 builds, T2 swaps all sites incl. the document-verify scaffold) ✓; frete single-source (T3: EditOrderDrawer + updatePedido + comment; FreteInput/updateFrete already compliant) ✓; email pix→Pix (T4, renderText) ✓ + order-detail label (T4) ✓.
- **Message strings preserved** verbatim as `message` bodies; titles/confirm-labels added for the modal affordance (intentional UX upgrade, not a copy change to the warning text).
- **Deferred (noted, out of Phase 3 scope):** `email.ts`'s module-local `metodoLabel` function still duplicates `metodoPagamentoLabel` (kept separate to avoid touching golden-guarded email internals — fold in Phase 5).
- **Type consistency:** `useConfirm()` returns `{ confirm, alert }` consumed uniformly; `metodoPagamentoLabel(string | null)` matches the `metodo_pagamento` column type at all call sites.
