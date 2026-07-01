# Deferred Backlog — Phase 2 (UI primitives + dedup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the repeated modal/drawer/panel/email/checkout/formatter scaffolds in the `app` package into shared primitives and helpers, eliminating ~13 duplications without changing user-visible behavior (beyond the spec-sanctioned "consistent Esc + scroll-lock" on overlays).

**Architecture:** New presentational primitives live in `app/components/ui/` (`Modal`, `Drawer`) and `app/components/admin/whatsapp/` (`FeaturePanel`); shared logic lands in `app/lib/` (`format.ts` additions, `address.ts`, `checkout-validation.ts`, `checkout-datetime.ts`, `hooks/use-optimistic-flag.ts`) and `app/lib/email-template.ts`. Each call site is migrated onto the primitive in the same task that the primitive is proven to cover it, so every task ends green.

**Tech Stack:** Next.js 15 (App Router) / React 19 / TypeScript / Tailwind v4 / framer-motion 12 / lucide-react / vitest 2.1.9 (+ jsdom + @testing-library/react, opt-in per file).

## Global Constraints

- **Branch:** all work stacks on `refactor/thermo-nuclear-code-quality` (single PR #2). Do NOT merge, do NOT branch, do NOT touch `main`.
- **Per-commit gate (must be green before every commit):** run all three from repo root:
  - `npm --prefix app run typecheck` (→ `tsc --noEmit`, clean)
  - `npm --prefix app run test` (→ `vitest run`, full suite, all green — currently 224 tests + whatever this phase adds)
  - `npm --prefix app run build` (→ `next build`, compiles)
- **Commit trailers (every commit, exactly):**
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011vQov9fd6qHob8mbpchWG6
  ```
- **Behavior-preserving** everywhere. The ONLY sanctioned behavior deltas in Phase 2 are: (a) `Modal` and the three drawers gain **Esc-to-close + body scroll-lock + backdrop-click-close** consistently (the locked decision "Drawer / Modal consistent Esc + scroll-lock"); (b) minor **visual normalizations** when a hand-rolled scaffold adopts the primitive (corner radius, header/title padding, backdrop blur) — these are listed per task and confirmed by visual QA, never silent. NO `confirm()`/`alert()` is removed in Phase 2 (that is Phase 3); migrated modals keep their existing inner `confirm()` calls verbatim.
- **jsdom opt-in:** component tests are `*.test.tsx` files whose FIRST line is `// @vitest-environment jsdom`. The vitest default stays `node`; pure-logic tests stay node-env. `app/vitest.setup.ts` already imports `@testing-library/jest-dom/vitest`.
- **Code style (repo + user conventions):** functional components, arrow functions, no classes / no `this`; descriptive names; comment the *why*, not the *what*. Match existing brand tokens exactly (`bg-brand-surface`, `bg-brand-dark`, `border-white/10`, `text-brand-warm-gray`, `text-brand-yellow`, `font-display`, etc.). Export UI primitives through `app/components/ui/index.ts`.
- **Imports:** use the `@/` alias (resolves to `app/`).
- **TDD:** write the failing test, watch it fail, minimal implementation, watch it pass, refactor, commit. Component primitives and pure helpers get real tests; mechanical call-site migrations are proven by the existing suite + the primitive's own test + a render smoke test where noted.

---

## File Structure (what each new file owns)

- `app/components/ui/modal.tsx` — centered overlay dialog primitive (overlay + card + Esc + scroll-lock + backdrop close + focus). Exported via `index.ts`.
- `app/components/ui/drawer.tsx` — right-side slide-over primitive (overlay + aside + header with title/close + optional footer + Esc + scroll-lock). Exported via `index.ts`.
- `app/components/admin/address-search-toggle.tsx` — the "Buscar/Trocar via Google" toggle that owns its open state and renders `AddressAutocomplete`.
- `app/lib/address.ts` — pure `addressDataToEnderecoCompleto` mapping + `EnderecoCompleto` type.
- `app/lib/hooks/use-optimistic-flag.ts` — optimistic boolean toggle with rollback + error (the pattern shared by the 4 WhatsApp panels' master switches).
- `app/components/admin/whatsapp/feature-panel.tsx` — the icon + title + description + master `Switch` + collapsible-body chrome shared by the 4 config panels.
- `app/lib/email-template.ts` — shared HTML email shell (`emailShell`, `ctaButton`, `infoRow`, `itensRows`, `totalsBlock`) used by the renderers in `lib/email.ts`.
- `app/lib/checkout-validation.ts` — pure `validateCheckout(...)` returning the first error string or `null`.
- `app/lib/checkout-datetime.ts` — pure date/time constants + helpers (`MESES`, `DAY_OPTIONS`, `HORAS`, `MINUTOS`, `getDaysInMonth`, `buildYearOptions`).
- `app/components/checkout/event-datetime-picker.tsx` — the day/month/year + hour/minute `<select>` block extracted from `checkout-form.tsx`.
- Additions to `app/lib/format.ts` — `formatPhone`, `firstName`, `shortId`, `formatTime`.

Tasks are ordered so each primitive exists before the task that migrates onto it.

---

### Task 1: `<Modal>` primitive

**Files:**
- Create: `app/components/ui/modal.tsx`
- Modify: `app/components/ui/index.ts`
- Test: `app/components/ui/modal.test.tsx`

**Interfaces:**
- Produces: `Modal` (named export) with props
  ```ts
  type ModalProps = {
    onClose: () => void
    title?: React.ReactNode
    maxWidth?: "sm" | "md" | "lg"   // default "md"
    closeDisabled?: boolean          // default false — blocks Esc + backdrop + (future) close affordances
    className?: string
    children: React.ReactNode
  }
  ```
  Caller controls mounting (render `{show && <Modal .../>}`), same as today.

- [ ] **Step 1: Write the failing test**

`app/components/ui/modal.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Modal } from "./modal"

afterEach(cleanup)

describe("Modal", () => {
  it("renders title and children", () => {
    render(<Modal onClose={() => {}} title="HELLO"><p>body</p></Modal>)
    expect(screen.getByText("HELLO")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
  })

  it("calls onClose on Escape", () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}><p>x</p></Modal>)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose on Escape when closeDisabled", () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} closeDisabled><p>x</p></Modal>)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("locks body scroll while mounted and restores on unmount", () => {
    const { unmount } = render(<Modal onClose={() => {}}><p>x</p></Modal>)
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix app run test -- modal.test.tsx`
Expected: FAIL — `Cannot find module './modal'`.

- [ ] **Step 3: Write minimal implementation**

`app/components/ui/modal.tsx`:
```tsx
"use client"

import { useEffect, type ReactNode } from "react"
import { motion } from "framer-motion"

type MaxWidth = "sm" | "md" | "lg"

type ModalProps = {
  onClose: () => void
  title?: ReactNode
  maxWidth?: MaxWidth
  closeDisabled?: boolean
  className?: string
  children: ReactNode
}

const maxWidths: Record<MaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
}

export const Modal = ({
  onClose,
  title,
  maxWidth = "md",
  closeDisabled = false,
  className,
  children,
}: ModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, closeDisabled])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) onClose()
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-brand-surface border border-white/10 rounded-xl p-6 w-full ${maxWidths[maxWidth]} max-h-[90vh] overflow-y-auto ${className ?? ""}`}
      >
        {title && (
          <h3 className="font-display text-lg font-bold text-white tracking-wide mb-4">{title}</h3>
        )}
        {children}
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 4: Add the barrel export**

In `app/components/ui/index.ts`, after the `Switch` export line, add:
```ts
export { Modal } from "./modal"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix app run test -- modal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/ui/modal.tsx app/components/ui/modal.test.tsx app/components/ui/index.ts
git commit   # message: "feat(ui): add Modal primitive (overlay + Esc + scroll-lock)"
```

---

### Task 2: Migrate the 4 hand-rolled modals onto `<Modal>`

**Files:**
- Modify: `app/components/admin/delete-product-modal.tsx`
- Modify: `app/components/admin/entregador-modal.tsx`
- Modify: `app/components/admin/revert-status-modal.tsx`
- Modify: `app/components/admin/dispatch-modal.tsx`
- Test: `app/components/admin/entregador-modal.test.tsx` (new smoke test)

**Interfaces:**
- Consumes: `Modal` from `@/components/ui` (Task 1).

**Intentional visual normalizations (note for reviewer; confirm in visual QA):** `delete-product-modal` corner radius `rounded-2xl → rounded-xl` and gains backdrop blur; all four gain Esc + scroll-lock; internal `confirm()` calls in `dispatch-modal` are kept verbatim (Phase 3 replaces them).

For each file: remove the hand-rolled `motion.div` overlay + `motion.div`/`AnimatePresence` card wrapper and the now-unused `motion`/`AnimatePresence` imports; wrap the inner content in `<Modal onClose={onClose} title={...} maxWidth={...}>`. Keep ALL state, handlers, and inner JSX (form, buttons, error display) exactly as-is.

- [ ] **Step 1: Write a render smoke test (proves the migration mounts)**

`app/components/admin/entregador-modal.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({
  createEntregador: vi.fn(),
  updateEntregador: vi.fn(),
}))

import EntregadorModal from "./entregador-modal"

afterEach(cleanup)

describe("EntregadorModal", () => {
  it("renders the create title and fields inside a dialog", () => {
    render(<EntregadorModal entregador={null} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("NOVO ENTREGADOR")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Nome do entregador")).toBeInTheDocument()
  })

  it("calls onClose on Escape", () => {
    const onClose = vi.fn()
    render(<EntregadorModal entregador={null} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- entregador-modal.test.tsx`
Expected: FAIL — no `dialog` role yet (current modal has no `role="dialog"`).

- [ ] **Step 3: Migrate `entregador-modal.tsx`**

Replace the import line `import { motion, AnimatePresence } from "framer-motion"` with `import { Modal } from "@/components/ui"` added to the existing `@/components/ui` import (merge: `import { Button, Input, Modal, fieldLabelClass } from "@/components/ui"`). Replace the entire `return ( <AnimatePresence> ... </AnimatePresence> )` block with:
```tsx
  return (
    <Modal onClose={onClose} title={entregador ? "EDITAR ENTREGADOR" : "NOVO ENTREGADOR"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={fieldLabelClass}>Nome *</label>
          <Input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do entregador"
          />
        </div>
        <div>
          <label className={fieldLabelClass}>WhatsApp *</label>
          <Input
            type="tel"
            required
            value={telefone}
            onChange={(e) => setTelefone(formatPhone(e.target.value))}
            maxLength={15}
            placeholder="(21) 99999-9999"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="flex-1">
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  )
```
(The local `formatPhone` stays for now; Task 10 replaces it with the shared one.)

- [ ] **Step 4: Run the smoke test**

Run: `npm --prefix app run test -- entregador-modal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Migrate `delete-product-modal.tsx`**

Drop the `motion` import; add `import { Button, Modal } from "@/components/ui"`. Replace the `return ( <motion.div ...> <motion.div ...> ... </motion.div> </motion.div> )` with:
```tsx
  return (
    <Modal
      onClose={onClose}
      maxWidth="sm"
      closeDisabled={loading}
      title={`EXCLUIR ${produto.marca.toUpperCase()} ${produto.volume_litros}L?`}
    >
      <p className="text-sm text-brand-gray-light mb-4">Esta acao nao pode ser desfeita.</p>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
          Cancelar
        </Button>
        <Button type="button" variant="danger" onClick={handleConfirm} disabled={loading} className="flex-1">
          {loading ? "Excluindo..." : "Excluir"}
        </Button>
      </div>
    </Modal>
  )
```

- [ ] **Step 6: Migrate `revert-status-modal.tsx`**

Drop `import { motion, AnimatePresence } from "framer-motion"`; add `import { Modal } from "@/components/ui"`. Replace the `return ( <AnimatePresence> ... </AnimatePresence> )` with `<Modal onClose={onClose} closeDisabled={loading !== null} title="Voltar status">` wrapping the inner content. The inner content keeps everything from the current card body EXCEPT the `<h3>` title (now the `title` prop). Keep the status-atual `<p>`, the `previousStatuses` list, the cancel button, error, and the "Fechar" button exactly. Final:
```tsx
  return (
    <Modal onClose={onClose} closeDisabled={loading !== null} title="Voltar status">
      <div className="space-y-4">
        <p className="text-sm text-brand-warm-gray -mt-2">
          Status atual: <span className="text-white font-medium">{statusConfig[currentStatus].label}</span>
        </p>

        {previousStatuses.length === 0 && !canCancel && (
          <p className="text-sm text-brand-warm-gray">Nao ha status anteriores disponiveis.</p>
        )}

        <div className="space-y-2">
          {previousStatuses.map((status) => (
            <button
              key={status}
              disabled={loading !== null}
              onClick={() => handleRevert(status)}
              className="w-full text-left px-4 py-2.5 rounded-lg bg-brand-dark border border-white/10 hover:border-brand-yellow/30 transition text-sm text-white disabled:opacity-50 cursor-pointer"
            >
              Voltar para <span className="font-semibold">{statusConfig[status].label}</span>
            </button>
          ))}

          {canCancel && (
            <button
              disabled={loading !== null}
              onClick={() => handleRevert("cancelado")}
              className="w-full text-left px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition text-sm text-red-400 disabled:opacity-50 cursor-pointer"
            >
              Marcar como <span className="font-semibold">cancelado</span>
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={onClose}
          disabled={loading !== null}
          className="text-sm text-brand-warm-gray hover:text-white disabled:opacity-50"
        >
          Fechar
        </button>
      </div>
    </Modal>
  )
```

- [ ] **Step 7: Migrate `dispatch-modal.tsx`**

Drop `import { motion, AnimatePresence } from "framer-motion"`; add `Modal` to the `@/components/ui` import (`import { Button, Modal, Select, fieldLabelClass } from "@/components/ui"`). Replace the `return ( <AnimatePresence> <motion.div overlay> <motion.div card max-w-lg max-h-[90vh] overflow-y-auto> <h3>ENVIAR PARA ENTREGADOR</h3> <div className="space-y-4">...</div> </motion.div> </motion.div> </AnimatePresence> )` with:
```tsx
  return (
    <Modal onClose={onClose} maxWidth="lg" closeDisabled={loading} title="ENVIAR PARA ENTREGADOR">
      <div className="space-y-4">
        {/* keep the existing inner JSX verbatim: Select block, Resumo pre, error, result/actions */}
      </div>
    </Modal>
  )
```
Keep the inner `<div className="space-y-4">…</div>` body exactly as it is today (the entregador `Select`, the `Resumo do Pedido` `<pre>`, error, and the `result ? (...) : (...)` actions). The two `confirm(...)` calls inside `handleConfirm` stay verbatim.

- [ ] **Step 8: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/delete-product-modal.tsx app/components/admin/entregador-modal.tsx app/components/admin/revert-status-modal.tsx app/components/admin/dispatch-modal.tsx app/components/admin/entregador-modal.test.tsx
git commit   # "refactor(admin): migrate the 4 hand-rolled modals onto <Modal>"
```

---

### Task 3: `<Drawer>` primitive

**Files:**
- Create: `app/components/ui/drawer.tsx`
- Modify: `app/components/ui/index.ts`
- Test: `app/components/ui/drawer.test.tsx`

**Interfaces:**
- Produces: `Drawer` (named export):
  ```ts
  type DrawerProps = {
    open: boolean
    onClose: () => void
    title?: React.ReactNode
    headerExtra?: React.ReactNode   // e.g. the EditOrderDrawer "N alterações" badge
    footer?: React.ReactNode        // sticky footer button row; omit for footerless drawers
    bg?: "surface" | "dark"         // default "surface"; config-drawer uses "dark"
    closeDisabled?: boolean         // default false — blocks Esc + backdrop + the X button
    children: React.ReactNode       // body content; owns its own vertical rhythm (space-y-*)
  }
  ```
  Drawer renders its own `AnimatePresence` (so it animates out on `open=false`), the slide-over aside, a header (`title` + `headerExtra` on the left, an `X` close button on the right), a `flex-1 overflow-y-auto px-6 py-5` body, and an optional footer.

- [ ] **Step 1: Write the failing test**

`app/components/ui/drawer.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Drawer } from "./drawer"

afterEach(cleanup)

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(<Drawer open={false} onClose={() => {}} title="T"><p>body</p></Drawer>)
    expect(screen.queryByText("body")).not.toBeInTheDocument()
  })

  it("renders title, body and footer when open", () => {
    render(<Drawer open onClose={() => {}} title="EDITAR" footer={<button>Salvar</button>}><p>body</p></Drawer>)
    expect(screen.getByText("EDITAR")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
    expect(screen.getByText("Salvar")).toBeInTheDocument()
  })

  it("calls onClose on the X button and on Escape", () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} title="T"><p>x</p></Drawer>)
    fireEvent.click(screen.getByLabelText("Fechar"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("blocks close affordances when closeDisabled", () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} closeDisabled title="T"><p>x</p></Drawer>)
    fireEvent.click(screen.getByLabelText("Fechar"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- drawer.test.tsx`
Expected: FAIL — `Cannot find module './drawer'`.

- [ ] **Step 3: Write minimal implementation**

`app/components/ui/drawer.tsx`:
```tsx
"use client"

import { useEffect, type ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

type DrawerProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  bg?: "surface" | "dark"
  closeDisabled?: boolean
  children: ReactNode
}

export const Drawer = ({
  open,
  onClose,
  title,
  headerExtra,
  footer,
  bg = "surface",
  closeDisabled = false,
  children,
}: DrawerProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !closeDisabled) onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, closeDisabled])

  const requestClose = () => {
    if (!closeDisabled) onClose()
  }

  const surface = bg === "dark" ? "bg-brand-dark" : "bg-brand-surface"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={requestClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className={`absolute right-0 top-0 h-full w-full max-w-xl ${surface} border-l border-white/10 flex flex-col`}
          >
            <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {title && <h2 className="font-display text-xl font-bold text-white tracking-wide">{title}</h2>}
                {headerExtra}
              </div>
              <button
                type="button"
                onClick={requestClose}
                disabled={closeDisabled}
                aria-label="Fechar"
                className="text-brand-warm-gray hover:text-white disabled:opacity-50 cursor-pointer p-1 rounded hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className={`px-6 py-4 border-t border-white/10 flex gap-2 ${surface}`}>{footer}</footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Add the barrel export**

In `app/components/ui/index.ts`, after the `Modal` export, add:
```ts
export { Drawer } from "./drawer"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --prefix app run test -- drawer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/ui/drawer.tsx app/components/ui/drawer.test.tsx app/components/ui/index.ts
git commit   # "feat(ui): add Drawer primitive (slide-over + Esc + scroll-lock)"
```

---

### Task 4: Shared address block (`addressDataToEnderecoCompleto` + `<AddressSearchToggle>`)

**Files:**
- Create: `app/lib/address.ts`
- Create: `app/components/admin/address-search-toggle.tsx`
- Test: `app/lib/address.test.ts`
- Test: `app/components/admin/address-search-toggle.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // app/lib/address.ts
  export type EnderecoCompleto = {
    rua: string; numero: string; bairro: string; cidade: string;
    estado: string; cep: string; complemento: string; lat: number; lng: number
  }
  export const addressDataToEnderecoCompleto: (addr: AddressData, complemento?: string) => EnderecoCompleto
  ```
  ```tsx
  // app/components/admin/address-search-toggle.tsx
  export const AddressSearchToggle: (props: { onSelect: (addr: AddressData) => void; openLabel: string }) => JSX.Element
  ```
  `AddressData` is imported (type-only) from `@/components/address-autocomplete`.

- [ ] **Step 1: Write the failing pure-mapping test**

`app/lib/address.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { addressDataToEnderecoCompleto } from "./address"
import type { AddressData } from "@/components/address-autocomplete"

const addr: AddressData = {
  rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Rio", estado: "RJ",
  cep: "20000-000", lat: -22.9, lng: -43.2, formatted: "Rua A, 10",
}

describe("addressDataToEnderecoCompleto", () => {
  it("maps every AddressData field and defaults complemento to empty", () => {
    expect(addressDataToEnderecoCompleto(addr)).toEqual({
      rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Rio", estado: "RJ",
      cep: "20000-000", complemento: "", lat: -22.9, lng: -43.2,
    })
  })

  it("preserves a provided complemento", () => {
    expect(addressDataToEnderecoCompleto(addr, "Apto 101").complemento).toBe("Apto 101")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- address.test.ts`
Expected: FAIL — `Cannot find module './address'`.

- [ ] **Step 3: Implement `app/lib/address.ts`**
```ts
import type { AddressData } from "@/components/address-autocomplete"

export type EnderecoCompleto = {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  complemento: string
  lat: number
  lng: number
}

// Google place -> the stored endereco_completo shape. The two admin drawers built this object
// inline identically; the only per-call difference is whether an existing complemento is kept.
export const addressDataToEnderecoCompleto = (addr: AddressData, complemento = ""): EnderecoCompleto => ({
  rua: addr.rua,
  numero: addr.numero,
  bairro: addr.bairro,
  cidade: addr.cidade,
  estado: addr.estado,
  cep: addr.cep,
  complemento,
  lat: addr.lat,
  lng: addr.lng,
})
```

- [ ] **Step 4: Run the pure test to verify it passes**

Run: `npm --prefix app run test -- address.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing component test**

`app/components/admin/address-search-toggle.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { AddressSearchToggle } from "./address-search-toggle"

afterEach(cleanup)

describe("AddressSearchToggle", () => {
  it("shows the trigger label and reveals the search input on click", () => {
    render(<AddressSearchToggle onSelect={() => {}} openLabel="Buscar via Google" />)
    const trigger = screen.getByText("Buscar via Google")
    expect(trigger).toBeInTheDocument()
    fireEvent.click(trigger)
    // AddressAutocomplete falls back to a plain input when Maps is not loaded (jsdom)
    expect(screen.getByPlaceholderText("Digite o endereco do evento...")).toBeInTheDocument()
    expect(screen.getByText("Cancelar busca")).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm --prefix app run test -- address-search-toggle.test.tsx`
Expected: FAIL — `Cannot find module './address-search-toggle'`.

- [ ] **Step 7: Implement `app/components/admin/address-search-toggle.tsx`**
```tsx
"use client"

import { useState } from "react"
import { RefreshCcw } from "lucide-react"
import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"
import { Button } from "@/components/ui"

// Shared between the manual-order and edit-order drawers. Owns its own open state so the parent
// only deals with the selected AddressData. Class string matches the prior inline usage exactly.
const autocompleteInputClass =
  "w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 text-sm text-white placeholder-brand-warm-gray/70 focus:border-brand-yellow/40 focus:ring-1 focus:ring-brand-yellow/30 outline-none"

type Props = {
  onSelect: (addr: AddressData) => void
  openLabel: string
}

export const AddressSearchToggle = ({ onSelect, openLabel }: Props) => {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <div className="space-y-2 bg-brand-dark/50 border border-brand-yellow/20 rounded-lg p-2">
        <AddressAutocomplete
          onAddressSelect={(addr) => {
            onSelect(addr)
            setOpen(false)
          }}
          inputClassName={autocompleteInputClass}
        />
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar busca
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-[11px] text-brand-yellow/90 hover:text-brand-yellow uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
    >
      <RefreshCcw className="h-3 w-3" />
      {openLabel}
    </button>
  )
}
```

- [ ] **Step 8: Run the component test to verify it passes**

Run: `npm --prefix app run test -- address-search-toggle.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 9: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/address.ts app/lib/address.test.ts app/components/admin/address-search-toggle.tsx app/components/admin/address-search-toggle.test.tsx
git commit   # "refactor(admin): extract shared address mapping + search-toggle"
```

---

### Task 5: Migrate the 3 drawers onto `<Drawer>` + the address block

**Files:**
- Modify: `app/components/admin/manual-order-drawer.tsx`
- Modify: `app/components/admin/edit-order-drawer.tsx`
- Modify: `app/components/admin/whatsapp/config-drawer.tsx`

**Interfaces:**
- Consumes: `Drawer` from `@/components/ui` (Task 3); `addressDataToEnderecoCompleto` from `@/lib/address` and `AddressSearchToggle` from `@/components/admin/address-search-toggle` (Task 4).

**Intentional behavior/visual deltas (note for reviewer; confirm in visual QA):**
- All three now share Esc + scroll-lock (`config-drawer` already had it; the two order drawers gain it).
- `config-drawer`: body padding `px-4 → px-6`, title `text-lg → text-xl`, header padding normalized — it is now the standard drawer chrome. Its own `useEffect` for Esc/scroll-lock is removed (Drawer owns it).
- `edit-order-drawer`: the `X` button now respects `closeDisabled={saving}` (previously the X ignored `saving`; the backdrop already guarded it). Benign consistency fix.
- Both order drawers drop their local `showAddressAutocomplete` state (now owned by `AddressSearchToggle`).

- [ ] **Step 1: Migrate `config-drawer.tsx`**

Remove the `useEffect` Esc/scroll-lock block (lines ~43–53), the `motion`/`AnimatePresence`/`X`/`useEffect` imports, and the hand-rolled overlay+aside+header. Add `import { Drawer } from "@/components/ui"`. The body becomes the Drawer children. Result:
```tsx
"use client"

import { toggleSection, type SectionId } from "@/lib/whatsapp/accordion"
import type {
  WhatsappConnection, WhatsappFeatures, StatusEntregaConfig,
  LembreteConfig, BotSaudacaoConfig, AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import type { WhatsappFeatureKey } from "@/lib/whatsapp/features"
import { Drawer } from "@/components/ui"
import WhatsappFeaturesPanel from "@/components/admin/whatsapp-features-panel"
import WhatsappStatusEntregaPanel from "@/components/admin/whatsapp-status-entrega-panel"
import WhatsappLembretePanel from "@/components/admin/whatsapp-lembrete-panel"
import WhatsappBotPanel from "@/components/admin/whatsapp-bot-panel"
import WhatsappAgentePanel from "@/components/admin/whatsapp-agente-panel"

type Props = { /* keep the existing Props type unchanged */ }

const ConfigDrawer = ({
  open, onClose, openSection, onOpenSection,
  connection, features, featErro, onToggleFeature, statusEntrega, lembrete, botSaudacao, agente,
}: Props) => {
  const toggle = (id: SectionId) => onOpenSection(toggleSection(openSection, id))

  return (
    <Drawer open={open} onClose={onClose} title="CONFIGURAÇÕES" bg="dark">
      <div className="space-y-3">
        <WhatsappFeaturesPanel features={features} me={connection.me} erro={featErro} onToggle={onToggleFeature} />
        <WhatsappStatusEntregaPanel initial={statusEntrega} expanded={openSection === "status"} onToggleExpand={() => toggle("status")} />
        <WhatsappLembretePanel initial={lembrete} expanded={openSection === "lembrete"} onToggleExpand={() => toggle("lembrete")} />
        <WhatsappBotPanel initial={botSaudacao} expanded={openSection === "bot"} onToggleExpand={() => toggle("bot")} />
        <WhatsappAgentePanel initial={agente} expanded={openSection === "agente"} onToggleExpand={() => toggle("agente")} />
      </div>
    </Drawer>
  )
}

export default ConfigDrawer
```
(Keep the existing `Props` type body verbatim — only the implementation/imports change.)

- [ ] **Step 2: Migrate `manual-order-drawer.tsx`**

- Drop `import { motion, AnimatePresence } from "framer-motion"` and `RefreshCcw` from the lucide import (keep `X` only if still used elsewhere — it is used by the item remove button, so keep `import { X } from "lucide-react"`).
- Replace `import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"` with `import { type AddressData } from "@/components/address-autocomplete"` and add `import { addressDataToEnderecoCompleto } from "@/lib/address"` + `import { AddressSearchToggle } from "@/components/admin/address-search-toggle"`.
- Add `Drawer` to the `@/components/ui` import.
- Remove the `showAddressAutocomplete` state (line ~65) and its resets in `resetForm`.
- Replace `handleAddressSelect`:
  ```tsx
  const handleAddressSelect = (addr: AddressData) => {
    setEnderecoText(addr.formatted)
    setEnderecoCompleto(addressDataToEnderecoCompleto(addr, enderecoCompleto?.complemento ?? ""))
  }
  ```
- Replace the Endereço section's autocomplete sub-block (the `{showAddressAutocomplete ? (...) : (<button>…Buscar via Google</button>)}`) with:
  ```tsx
  <AddressSearchToggle onSelect={handleAddressSelect} openLabel="Buscar via Google" />
  ```
- Replace the whole outer `return ( <AnimatePresence>{open && (<motion.div overlay><motion.aside>…<header>…</header><div body>…</div><footer>…</footer></motion.aside></motion.div>)}</AnimatePresence> )` with `<Drawer>`:
  ```tsx
  return (
    <Drawer
      open={open}
      onClose={handleClose}
      closeDisabled={submitting}
      title="NOVO PEDIDO MANUAL"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
            {submitting ? "Criando..." : "Criar pedido"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* keep all the existing <section>…</section> blocks (Cliente, Endereço, Evento, Itens, Pagamento) and the error <p> verbatim */}
      </div>
    </Drawer>
  )
  ```
  The body `<div className="space-y-6">` replaces the old `<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">` (Drawer supplies `flex-1 overflow-y-auto px-6 py-5`). `handleClose` keeps its `resetForm()` + `onClose()` (the `if (submitting) return` guard is now redundant with `closeDisabled` but harmless — leave it).

- [ ] **Step 3: Migrate `edit-order-drawer.tsx`**

Apply the same shape:
- Drop `motion`/`AnimatePresence` and `RefreshCcw` imports (keep `X` — used by `ItemRow`). Swap the AddressAutocomplete import for the type-only import + `addressDataToEnderecoCompleto` + `AddressSearchToggle`. Add `Drawer` to `@/components/ui`.
- Remove `showAddressAutocomplete` state + its reset in `handleDiscard`.
- Replace `handleAddressSelect`:
  ```tsx
  const handleAddressSelect = (addr: AddressData) => {
    setEndereco(addr.formatted)
    setEnderecoCompleto(addressDataToEnderecoCompleto(addr, enderecoCompleto?.complemento ?? ""))
  }
  ```
- Replace the Endereço autocomplete sub-block with `<AddressSearchToggle onSelect={handleAddressSelect} openLabel="Trocar via Google" />`.
- Replace the outer wrapper with `<Drawer>`:
  ```tsx
  return (
    <Drawer
      open={open}
      onClose={onClose}
      closeDisabled={saving}
      title="EDITAR PEDIDO"
      headerExtra={
        hasChanges ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30">
            {changedFields.length} {changedFields.length === 1 ? "alteração" : "alterações"}
          </span>
        ) : null
      }
      footer={
        <>
          <Button variant="secondary" onClick={handleDiscard} disabled={saving || !hasChanges} className="flex-1">
            Descartar
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !hasChanges} className="flex-[2]">
            {saving ? "Salvando..." : hasChanges ? `Salvar (${changedFields.length})` : "Sem alterações"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* keep the existing Evento / Endereço / Itens / Pagamento sections + error <p> verbatim */}
      </div>
    </Drawer>
  )
  ```
  Keep the `ItemRow` sub-component unchanged.

- [ ] **Step 4: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/manual-order-drawer.tsx app/components/admin/edit-order-drawer.tsx app/components/admin/whatsapp/config-drawer.tsx
git commit   # "refactor(admin): migrate the 3 drawers onto <Drawer> + shared address block"
```

---

### Task 6: `useOptimisticFlag` hook

**Files:**
- Create: `app/lib/hooks/use-optimistic-flag.ts`
- Test: `app/lib/hooks/use-optimistic-flag.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const useOptimisticFlag: (
    initial: boolean,
    persist: (next: boolean) => Promise<{ ok: boolean }>,
  ) => { on: boolean; toggle: (next: boolean) => void; error: string | null; setError: (e: string | null) => void }
  ```
  Optimistically sets `on`, persists in a transition, rolls back + sets the default error `"Não consegui salvar. Tente de novo."` on `{ ok: false }`. `setError` is exposed so a consumer can route its own (non-toggle) errors through the same state.

- [ ] **Step 1: Write the failing test**

`app/lib/hooks/use-optimistic-flag.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useOptimisticFlag } from "./use-optimistic-flag"

describe("useOptimisticFlag", () => {
  it("optimistically flips and keeps the value when persist succeeds", async () => {
    const persist = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useOptimisticFlag(false, persist))
    act(() => result.current.toggle(true))
    expect(result.current.on).toBe(true)
    await waitFor(() => expect(persist).toHaveBeenCalledWith(true))
    expect(result.current.error).toBeNull()
    expect(result.current.on).toBe(true)
  })

  it("rolls back and sets an error when persist fails", async () => {
    const persist = vi.fn().mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useOptimisticFlag(false, persist))
    act(() => result.current.toggle(true))
    expect(result.current.on).toBe(true)
    await waitFor(() => expect(result.current.on).toBe(false))
    expect(result.current.error).toBe("Não consegui salvar. Tente de novo.")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- use-optimistic-flag.test.tsx`
Expected: FAIL — `Cannot find module './use-optimistic-flag'`.

- [ ] **Step 3: Implement `app/lib/hooks/use-optimistic-flag.ts`**
```ts
import { useState, useTransition } from "react"

// The optimistic master-toggle the 4 WhatsApp config panels each hand-rolled: flip immediately,
// persist in a transition, roll back + surface a generic error if the server rejects it.
export const useOptimisticFlag = (
  initial: boolean,
  persist: (next: boolean) => Promise<{ ok: boolean }>,
) => {
  const [on, setOn] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (next: boolean) => {
    setError(null)
    setOn(next)
    startTransition(async () => {
      const { ok } = await persist(next)
      if (!ok) {
        setOn(!next)
        setError("Não consegui salvar. Tente de novo.")
      }
    })
  }

  return { on, toggle, error, setError }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix app run test -- use-optimistic-flag.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/hooks/use-optimistic-flag.ts app/lib/hooks/use-optimistic-flag.test.tsx
git commit   # "feat(admin): add useOptimisticFlag hook"
```

---

### Task 7: `<FeaturePanel>` + migrate the 4 WhatsApp panels

**Files:**
- Create: `app/components/admin/whatsapp/feature-panel.tsx`
- Modify: `app/components/admin/whatsapp-agente-panel.tsx`
- Modify: `app/components/admin/whatsapp-bot-panel.tsx`
- Modify: `app/components/admin/whatsapp-lembrete-panel.tsx`
- Modify: `app/components/admin/whatsapp-status-entrega-panel.tsx`
- Test: `app/components/admin/whatsapp/feature-panel.test.tsx`

**Interfaces:**
- Consumes: `useOptimisticFlag` (Task 6), `Collapsible`, `Switch`.
- Produces:
  ```ts
  type FeaturePanelProps = {
    icon: React.ComponentType<{ className?: string }>
    title: string
    description: React.ReactNode
    on: boolean
    onToggle: (next: boolean) => void
    switchId: string
    error?: string | null
    collapseLabel?: React.ReactNode
    collapseHint?: React.ReactNode
    expanded?: boolean
    onToggleExpand?: () => void
    children?: React.ReactNode      // collapsible body; include its own "mt-4 space-y-4" wrapper
  }
  export const FeaturePanel: (props: FeaturePanelProps) => JSX.Element
  ```
  Renders the panel card: icon + title + description + master `Switch`; when `on` and `children` are present, the chevron toggle row (`collapseLabel` + optional `collapseHint`) wrapping `<Collapsible>{children}</Collapsible>`; and the error line. Internal `abertoLocal` fallback mirrors the panels' current default-closed behavior.

- [ ] **Step 1: Write the failing test**

`app/components/admin/whatsapp/feature-panel.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Bot } from "lucide-react"
import { FeaturePanel } from "./feature-panel"

afterEach(cleanup)

describe("FeaturePanel", () => {
  it("renders title, description and a checked switch", () => {
    render(
      <FeaturePanel icon={Bot} title="Saudação" description="desc" on switchId="s" onToggle={() => {}}>
        <div>body</div>
      </FeaturePanel>,
    )
    expect(screen.getByText("Saudação")).toBeInTheDocument()
    expect(screen.getByText("desc")).toBeInTheDocument()
    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("calls onToggle when the switch is flipped", () => {
    const onToggle = vi.fn()
    render(<FeaturePanel icon={Bot} title="T" description="d" on={false} switchId="s" onToggle={onToggle} />)
    fireEvent.click(screen.getByRole("switch"))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it("hides the collapsible body until expanded, and shows the error line", () => {
    render(
      <FeaturePanel
        icon={Bot} title="T" description="d" on switchId="s" onToggle={() => {}}
        collapseLabel="More" error="boom"
      >
        <div>secret</div>
      </FeaturePanel>,
    )
    expect(screen.queryByText("secret")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("More"))
    expect(screen.getByText("secret")).toBeInTheDocument()
    expect(screen.getByText("boom")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- feature-panel.test.tsx`
Expected: FAIL — `Cannot find module './feature-panel'`.

- [ ] **Step 3: Implement `app/components/admin/whatsapp/feature-panel.tsx`**
```tsx
"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Switch } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"

type FeaturePanelProps = {
  icon: ComponentType<{ className?: string }>
  title: string
  description: ReactNode
  on: boolean
  onToggle: (next: boolean) => void
  switchId: string
  error?: string | null
  collapseLabel?: ReactNode
  collapseHint?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  children?: ReactNode
}

export const FeaturePanel = ({
  icon: Icon,
  title,
  description,
  on,
  onToggle,
  switchId,
  error,
  collapseLabel,
  collapseHint,
  expanded,
  onToggleExpand,
  children,
}: FeaturePanelProps) => {
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">{description}</p>
        </div>
        <Switch id={switchId} checked={on} onChange={onToggle} aria-label={title} />
      </div>

      {on && children && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={toggleAberto}
            aria-expanded={aberto}
            className="flex w-full items-center gap-2 text-sm text-brand-warm-gray hover:text-white transition-colors"
          >
            {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="font-medium">{collapseLabel}</span>
            {collapseHint && <span className="text-xs text-brand-warm-gray/70">{collapseHint}</span>}
          </button>
          <Collapsible open={aberto}>{children}</Collapsible>
        </div>
      )}

      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix app run test -- feature-panel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Migrate `whatsapp-agente-panel.tsx`**

Replace the master-toggle state + the outer card/header/collapsible chrome with `useOptimisticFlag` + `FeaturePanel`. Keep the FAQ body (textarea + Salvar/Restaurar + "Salvo ✓") as the children, and keep its own `useTransition` for `salvarFaq`/`restaurar`. Route the FAQ-save error through the hook's `setError`:
```tsx
"use client"

import { useState, useTransition } from "react"
import { Sparkles } from "lucide-react"
import { Textarea, Button } from "@/components/ui"
import { FeaturePanel } from "@/components/admin/whatsapp/feature-panel"
import { useOptimisticFlag } from "@/lib/hooks/use-optimistic-flag"
import { setWhatsappAgenteFlag, setWhatsappAgenteFaq, type AgenteConfig } from "@/lib/whatsapp/admin-actions"
import { DEFAULT_AGENTE_FAQ } from "@/lib/whatsapp/bot-agente-kb"

type Props = { initial: AgenteConfig; expanded?: boolean; onToggleExpand?: () => void }

const WhatsappAgentePanel = ({ initial, expanded, onToggleExpand }: Props) => {
  const { on: ativo, toggle, error, setError } = useOptimisticFlag(initial.ativo, setWhatsappAgenteFlag)
  const [faq, setFaq] = useState(initial.faq)
  const [rascunho, setRascunho] = useState(initial.faq)
  const [salvo, setSalvo] = useState(false)
  const [, startTransition] = useTransition()

  const salvarFaq = () => {
    setError(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_AGENTE_FAQ
        setRascunho(final)
        setFaq(final)
        setSalvo(true)
      } else {
        setError("Não consegui salvar as informações.")
      }
    })
  }

  const restaurar = () => {
    setError(null)
    setSalvo(false)
    setRascunho(DEFAULT_AGENTE_FAQ)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(DEFAULT_AGENTE_FAQ)
      if (ok) {
        setFaq(DEFAULT_AGENTE_FAQ)
        setSalvo(true)
      } else {
        setError("Não consegui restaurar.")
      }
    })
  }

  return (
    <FeaturePanel
      icon={Sparkles}
      title="Atendente automático (IA)"
      description="Responde sozinho às dúvidas dos clientes (cardápio, horário, pagamento). Quando ligado, substitui a saudação automática. Requer o Atendimento ligado."
      on={ativo}
      onToggle={(next) => { setSalvo(false); toggle(next) }}
      switchId="whatsapp_bot_agente_ativo"
      error={error}
      collapseLabel="Informações que o atendente pode usar"
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mt-4 space-y-4">
        <p className="text-xs text-brand-warm-gray">
          Horário, formas de pagamento, cobertura, como pedir. O cardápio e os preços vêm do
          catálogo automaticamente — não precisa repetir aqui.
        </p>
        <Textarea
          rows={6}
          value={rascunho}
          onChange={(e) => { setRascunho(e.target.value); setSalvo(false) }}
          aria-label="Informações do atendente"
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={salvarFaq} disabled={rascunho === faq}>Salvar</Button>
          <Button variant="ghost" size="sm" onClick={restaurar}>Restaurar padrão</Button>
          {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
        </div>
        <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
          O atendente nunca inventa preço ou prazo: quando não sabe, pede pra confirmar com a
          equipe. Suas respostas aparecem nas Conversas abaixo.
        </p>
      </div>
    </FeaturePanel>
  )
}

export default WhatsappAgentePanel
```

- [ ] **Step 6: Migrate `whatsapp-bot-panel.tsx`**

Same pattern. Keep `JANELAS`/`labelJanela`, the `janela` state + `trocarJanela` (its own optimistic-with-rollback for the non-boolean value — keep its local `useTransition`), and the message body. Master flag → `useOptimisticFlag(initial.ativo, setWhatsappBotSaudacaoFlag)`. Header `icon={Bot}`, `title="Saudação automática (bot)"`, the existing description, `switchId="whatsapp_bot_saudacao_ativo"`, `collapseLabel="Mensagem e janela"`, `collapseHint={`(após ${labelJanela(janela)} parado)`}`. Body = the existing janela `Select` + message `Textarea` + Salvar/Restaurar + "Salvo ✓" + helper `<p>`, wrapped in `<div className="mt-4 space-y-4">`. Route `salvarMsg`/`restaurar`/`trocarJanela` errors through the hook's `setError`; keep `setSalvo(false)` on toggle.

- [ ] **Step 7: Migrate `whatsapp-lembrete-panel.tsx`**

Same pattern. Keep `HORAS`/`labelHora`, the `hora` state + `trocarHora`, and the message body + the `{nome}/{pedido}/{data}/{horario}` helper `<p>`. Master flag → `useOptimisticFlag(initial.ativo, setWhatsappLembreteFlag)`. `icon={BellRing}`, `title="Lembrete na véspera"`, existing description, `switchId="whatsapp_lembrete_vespera_ativo"`, `collapseLabel="Mensagem e horário"`, `collapseHint={`(envia às ${labelHora(hora)})`}`.

- [ ] **Step 8: Migrate `whatsapp-status-entrega-panel.tsx`**

Same pattern for the MASTER flag only: `const { on: master, toggle, error, setError } = useOptimisticFlag(initial.master, (next) => setWhatsappStatusFlag("master", next))`. Keep `porStatus` state + `toggleStatus` + `salvarMsg` + `restaurar` (the per-status map logic is NOT a simple boolean — leave it as-is, but route its errors through the hook's `setError`, and replace its local `setSalvo(null)` usage as today with the existing `salvo` state which stays local). Header `icon={Truck}`, `title="Avisar status de entrega"`, existing description, `switchId="whatsapp_status_entrega_ativo"`, `collapseLabel="Mensagens por status"`, `collapseHint={`(${STATUS_NOTIFY_STATUSES.filter((s) => porStatus[s].ativo).length} de ${STATUS_NOTIFY_STATUSES.length} ligados)`}`, `on={master}`, `onToggle={(next) => { setSalvo(null); toggle(next) }}`. Body = the existing `<ul>` of per-status rows + the helper `<p>`, wrapped in a fragment `<>…</>` (matches today). Keep the local `salvo` state (`NotifyStatus | null`).

- [ ] **Step 9: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/whatsapp/feature-panel.tsx app/components/admin/whatsapp/feature-panel.test.tsx app/components/admin/whatsapp-agente-panel.tsx app/components/admin/whatsapp-bot-panel.tsx app/components/admin/whatsapp-lembrete-panel.tsx app/components/admin/whatsapp-status-entrega-panel.tsx
git commit   # "refactor(admin): dedup the 4 WhatsApp panels onto <FeaturePanel> + useOptimisticFlag"
```

---

### Task 8: Email HTML shell + golden tests

**Files:**
- Create: `app/lib/email-template.ts`
- Modify: `app/lib/email.ts`
- Test: `app/lib/email.test.ts`
- Test fixtures (committed): `app/lib/__golden__/email-admin.html`, `app/lib/__golden__/email-customer.html`, `app/lib/__golden__/email-whatsapp-down.html`

**Interfaces:**
- Produces (in `email-template.ts`):
  ```ts
  export const emailShell: (parts: {
    title: string; headerEyebrow: string; headerTitle: string; headerSub?: string; body: string
  }) => string
  export const ctaButton: (href: string, label: string) => string
  export const infoRow: (label: string, value: string, opts?: { valueAlignTop?: boolean; capitalize?: boolean }) => string
  export const itensRows: (itens: { qtd: number; descricao: string; subtotal: number }[]) => string
  ```
- `email.ts` exports its three renderers so the golden test can call them directly:
  ```ts
  export const renderHtml, renderCustomerHtml, renderWhatsAppDownHtml
  ```

**Approach (golden-test-first):** capture the CURRENT output of each renderer into committed `.html` fixtures, then refactor the renderers to compose `emailShell`/`ctaButton`/`infoRow`/`itensRows`, asserting the output is byte-identical to the golden.

- [ ] **Step 1: Export the three renderers**

In `app/lib/email.ts`, add `export` to `const renderHtml`, `const renderCustomerHtml`, and `const renderWhatsAppDownHtml` (no other change yet). Run `npm --prefix app run build` to confirm still green.

- [ ] **Step 2: Write the golden test (capture mode first)**

`app/lib/email.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { renderHtml, renderCustomerHtml, renderWhatsAppDownHtml } from "./email"

const GOLDEN_DIR = join(__dirname, "__golden__")
const CAPTURE = process.env.CAPTURE_GOLDEN === "1"

const orderPayload = {
  pedidoId: "abcdef12-3456-7890-abcd-ef1234567890",
  clienteNome: "Maria Silva Santos",
  clienteTelefone: "(21) 99999-1234",
  dataEvento: "2026-07-15",
  horarioEvento: "18:30:00",
  endereco: "Rua das Flores, 123 — Centro, Rio de Janeiro",
  tipoChopeira: "eletrica",
  itens: [
    { qtd: 2, descricao: "Heineken 30L", subtotal: 900 },
    { qtd: 1, descricao: "Brahma 50L", subtotal: 500 },
  ],
  subtotal: 1400,
  frete: 80,
  total: 1480,
  metodoPagamento: "pix",
  observacoes: "Portão azul, tocar o interfone 12.",
}

const cases: [string, string][] = [
  ["email-admin.html", renderHtml(orderPayload)],
  ["email-customer.html", renderCustomerHtml(orderPayload)],
  ["email-whatsapp-down.html", renderWhatsAppDownHtml("a sessão foi desconectada pelo WhatsApp")],
]

describe("email renderers (golden)", () => {
  for (const [file, output] of cases) {
    it(`matches golden ${file}`, () => {
      const path = join(GOLDEN_DIR, file)
      if (CAPTURE || !existsSync(path)) {
        writeFileSync(path, output)
      }
      expect(output).toBe(readFileSync(path, "utf8"))
    })
  }
})
```

- [ ] **Step 3: Capture the goldens from the CURRENT (unrefactored) renderers**

```bash
mkdir -p app/lib/__golden__
CAPTURE_GOLDEN=1 npm --prefix app run test -- email.test.ts
```
This writes the three `.html` fixtures from today's output. Then run without capture to confirm they match:
Run: `npm --prefix app run test -- email.test.ts`
Expected: PASS (3 tests). Commit the fixtures + test now (intermediate safety net) OR include in the task commit at Step 6.

- [ ] **Step 4: Implement `app/lib/email-template.ts`**

Extract the shared chrome. `emailShell` must reproduce the EXACT outer document used by the renderers (dark header band on `#1a1a1a`, white 600px card on `#f5f0e8`, eyebrow "ALFA Chopp Delivery", `headerTitle`, optional `headerSub` `#${id}` line, the `body` HTML injected into the white card, and the footer). `ctaButton`, `infoRow`, `itensRows` reproduce the repeated table fragments. Use the existing inline-style strings verbatim so output stays identical. (The golden test is the contract — iterate until equal.)
```ts
import { formatBRL } from "@/lib/format"

const FONT = "Arial,Helvetica,sans-serif"

export const emailShell = (parts: {
  title: string
  headerEyebrow: string
  headerTitle: string
  headerSub?: string
  body: string
}): string => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${parts.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f0e8" style="background-color:#f5f0e8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;">
        <tr>
          <td bgcolor="#1a1a1a" style="background-color:#1a1a1a;padding:24px 32px;border-top-left-radius:8px;border-top-right-radius:8px;">
            <p style="margin:0;font-family:${FONT};font-size:12px;color:#e8b912;letter-spacing:2px;text-transform:uppercase;">${parts.headerEyebrow}</p>
            <h1 style="margin:8px 0 0 0;font-family:${FONT};font-size:24px;color:#ffffff;line-height:1.2;">${parts.headerTitle}</h1>${parts.headerSub ? `
            <p style="margin:6px 0 0 0;font-family:${FONT};font-size:13px;color:#b5afa6;">${parts.headerSub}</p>` : ""}
          </td>
        </tr>
${parts.body}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
// ctaButton, infoRow, itensRows: extract the exact <table>/<tr>/<td> fragments from email.ts.
// Drive their final form from the golden test (output must not change).
```
**Important:** the exact byte layout (indentation, the conditional `headerSub` newline) is whatever makes the golden test pass against the captured fixtures. The implementer adjusts whitespace until `renderX` composed from these helpers equals the golden. If reaching byte-identity for a given fragment is disproportionately fiddly, it is acceptable to leave that fragment inline in the renderer and still share `emailShell` + `ctaButton` — the goal is dedup of the large repeated shell, not 100% of every row.

- [ ] **Step 5: Refactor the three renderers to use the shell**

Rewrite `renderHtml`, `renderCustomerHtml`, `renderWhatsAppDownHtml` (and reuse `infoRow`/`itensRows`/`ctaButton`) so each builds only its `body` and calls `emailShell`. Keep `renderText`/`renderCustomerText`/the down-alert text and all the `send*` functions unchanged. Run the golden test after each renderer:
Run: `npm --prefix app run test -- email.test.ts`
Expected: PASS — output byte-identical to the goldens.

- [ ] **Step 6: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/email-template.ts app/lib/email.ts app/lib/email.test.ts app/lib/__golden__/
git commit   # "refactor(email): extract shared HTML shell behind golden tests"
```

---

### Task 9: Split `checkout-form.tsx` (datetime picker + validation)

**Files:**
- Create: `app/lib/checkout-validation.ts`
- Create: `app/lib/checkout-datetime.ts`
- Create: `app/components/checkout/event-datetime-picker.tsx`
- Modify: `app/components/checkout-form.tsx`
- Test: `app/lib/checkout-validation.test.ts`
- Test: `app/lib/checkout-datetime.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // checkout-validation.ts
  export const validateCheckout: (input: {
    address: { numero: string } | null
    addressInArea: boolean | null
    dataEvento: string          // "YYYY-MM-DD" or ""
    tipoChopeira: "gelo" | "eletrica" | ""
    temRampas: "sim" | "nao" | ""
    now?: Date                  // injectable; defaults to new Date()
  }) => string | null           // first error message, or null when valid

  // checkout-datetime.ts
  export const MESES: string[]
  export const DAY_OPTIONS: number[]
  export const HORAS: number[]
  export const MINUTOS: number[]
  export const getDaysInMonth: (month: number, year: number) => number
  export const buildYearOptions: (currentYear: number) => number[]
  ```
  ```tsx
  // event-datetime-picker.tsx
  type EventDateTimePickerProps = {
    dia: string; mes: string; ano: string; hora: string; minuto: string
    onDia: (v: string) => void; onMes: (v: string) => void; onAno: (v: string) => void
    onHora: (v: string) => void; onMinuto: (v: string) => void
    maxDays: number; diaInvalida: boolean | "" ; selectedMonth: number
    bookedSlots: Record<number, number>
  }
  export const EventDateTimePicker: (props: EventDateTimePickerProps) => JSX.Element
  ```

- [ ] **Step 1: Write the failing validation test**

`app/lib/checkout-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { validateCheckout } from "./checkout-validation"

const base = {
  address: { numero: "10" },
  addressInArea: true as boolean | null,
  dataEvento: "2026-07-15",
  tipoChopeira: "gelo" as const,
  temRampas: "nao" as const,
  now: new Date("2026-07-01T12:00:00"),
}

describe("validateCheckout", () => {
  it("returns null when everything is valid", () => {
    expect(validateCheckout(base)).toBeNull()
  })
  it("rejects a missing address first", () => {
    expect(validateCheckout({ ...base, address: null })).toBe("Selecione um endereco valido")
  })
  it("rejects an out-of-area address", () => {
    expect(validateCheckout({ ...base, addressInArea: false })).toBe("Infelizmente nao atendemos essa regiao")
  })
  it("rejects a past event date", () => {
    expect(validateCheckout({ ...base, dataEvento: "2026-06-30" })).toBe("A data do evento nao pode ser no passado")
  })
  it("rejects a missing chopeira", () => {
    expect(validateCheckout({ ...base, tipoChopeira: "" })).toBe("Selecione o tipo de chopeira")
  })
  it("rejects missing rampas info when an address is set", () => {
    expect(validateCheckout({ ...base, temRampas: "" })).toBe("Informe se o local possui rampas ou escadas")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- checkout-validation.test.ts`
Expected: FAIL — `Cannot find module './checkout-validation'`.

- [ ] **Step 3: Implement `app/lib/checkout-validation.ts`**

Mirror the exact guard order + messages from `checkout-form.tsx:130-162`:
```ts
// Pure mirror of the checkout submit guards, in the same order, with the same messages.
export const validateCheckout = (input: {
  address: { numero: string } | null
  addressInArea: boolean | null
  dataEvento: string
  tipoChopeira: "gelo" | "eletrica" | ""
  temRampas: "sim" | "nao" | ""
  now?: Date
}): string | null => {
  if (!input.address) return "Selecione um endereco valido"
  if (input.addressInArea === false) return "Infelizmente nao atendemos essa regiao"

  const eventDate = new Date(input.dataEvento + "T00:00:00")
  const today = input.now ?? new Date()
  today.setHours(0, 0, 0, 0)
  if (eventDate < today) return "A data do evento nao pode ser no passado"

  if (!input.tipoChopeira) return "Selecione o tipo de chopeira"
  if (input.address && !input.temRampas) return "Informe se o local possui rampas ou escadas"

  return null
}
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `npm --prefix app run test -- checkout-validation.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing datetime-helpers test**

`app/lib/checkout-datetime.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { MESES, DAY_OPTIONS, HORAS, MINUTOS, getDaysInMonth, buildYearOptions } from "./checkout-datetime"

describe("checkout-datetime", () => {
  it("has 12 months, 31 day options, hours 8..22, quarter-hour minutes", () => {
    expect(MESES).toHaveLength(12)
    expect(DAY_OPTIONS).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    expect(HORAS[0]).toBe(8)
    expect(HORAS[HORAS.length - 1]).toBe(22)
    expect(MINUTOS).toEqual([0, 15, 30, 45])
  })
  it("getDaysInMonth handles February", () => {
    expect(getDaysInMonth(2, 2026)).toBe(28)
    expect(getDaysInMonth(2, 2028)).toBe(29)
  })
  it("buildYearOptions returns the current year and the next", () => {
    expect(buildYearOptions(2026)).toEqual([2026, 2027])
  })
})
```

- [ ] **Step 6: Run it to verify it fails, then implement `app/lib/checkout-datetime.ts`**

Run: `npm --prefix app run test -- checkout-datetime.test.ts` → FAIL.
```ts
export const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1)

export const HORAS = Array.from({ length: 15 }, (_, i) => i + 8)

export const MINUTOS = [0, 15, 30, 45]

export const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate()

export const buildYearOptions = (currentYear: number) => [currentYear, currentYear + 1]
```
Run again → PASS (3 tests).

- [ ] **Step 7: Extract `<EventDateTimePicker>`**

`app/components/checkout/event-datetime-picker.tsx` — move the Data + Horario `<div>` blocks (`checkout-form.tsx:434-512`) into a controlled component. Use the shared `selectClassName`/`labelClassName` strings (copy them in, or export `selectClassName` from a shared spot — to keep scope tight, duplicate the two class constants in this file; they are presentational). The component renders the day/month/year selects (with `diaInvalida` message) and hour/minute selects (with booked-slot disabling), driven entirely by props.
```tsx
"use client"

import { motion } from "framer-motion"
import { MESES, DAY_OPTIONS, HORAS, MINUTOS } from "@/lib/checkout-datetime"

const selectClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23B5AFA6%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat"
const labelClassName = "block text-sm font-medium text-brand-gray-light mb-1.5"

type Props = {
  dia: string; mes: string; ano: string; hora: string; minuto: string
  onDia: (v: string) => void; onMes: (v: string) => void; onAno: (v: string) => void
  onHora: (v: string) => void; onMinuto: (v: string) => void
  maxDays: number; diaInvalida: boolean | ""; selectedMonth: number
  yearOptions: number[]
  bookedSlots: Record<number, number>
}

export const EventDateTimePicker = ({
  dia, mes, ano, hora, minuto, onDia, onMes, onAno, onHora, onMinuto,
  maxDays, diaInvalida, selectedMonth, yearOptions, bookedSlots,
}: Props) => (
  <>
    <div>
      <label className={labelClassName}>Data do evento *</label>
      <div className="grid grid-cols-3 gap-3">
        <select required value={dia} onChange={(e) => onDia(e.target.value)} className={selectClassName}>
          <option value="" disabled>Dia</option>
          {DAY_OPTIONS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
        </select>
        <select required value={mes} onChange={(e) => onMes(e.target.value)} className={selectClassName}>
          <option value="" disabled>Mes</option>
          {MESES.map((nome, idx) => <option key={nome} value={String(idx + 1)}>{nome}</option>)}
        </select>
        <select required value={ano} onChange={(e) => onAno(e.target.value)} className={selectClassName}>
          {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </div>
      {diaInvalida && (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-red-400 text-sm mt-2">
          O mes de {MESES[selectedMonth - 1]} nao tem dia {dia} — selecione um dia ate {maxDays}
        </motion.p>
      )}
    </div>

    <div>
      <label className={labelClassName}>Horario do evento *</label>
      <div className="grid grid-cols-2 gap-3">
        <select
          required value={hora}
          onChange={(e) => { onHora(e.target.value); if (minuto === "") onMinuto("0") }}
          className={selectClassName}
        >
          <option value="" disabled>Hora</option>
          {HORAS.map((h) => {
            const full = (bookedSlots[h] ?? 0) >= 2
            return <option key={h} value={String(h)} disabled={full}>{String(h).padStart(2, "0")}h{full ? " (indisponivel)" : ""}</option>
          })}
        </select>
        <select required value={minuto} onChange={(e) => onMinuto(e.target.value)} className={selectClassName}>
          <option value="" disabled>Minuto</option>
          {MINUTOS.map((m) => <option key={m} value={String(m)}>{String(m).padStart(2, "0")}min</option>)}
        </select>
      </div>
    </div>
  </>
)
```

- [ ] **Step 8: Rewire `checkout-form.tsx`**

- Remove the now-extracted constants (`MESES`, `DAY_OPTIONS`, `getDaysInMonth`, `buildYearOptions`, `HORAS`, `MINUTOS`) and import them from `@/lib/checkout-datetime` (import `getDaysInMonth`, `buildYearOptions`, plus the arrays only if still referenced directly — they now live in the picker, so import just `getDaysInMonth` and `buildYearOptions`).
- Keep the derived state in the form (`selectedMonth`, `selectedYear`, `maxDays`, `diaInvalida`, `dataEvento`, `horarioEvento`) but compute `maxDays` via the imported `getDaysInMonth` and year options via `buildYearOptions(now.getFullYear())`.
- Replace the two date/time `<div>` blocks with:
  ```tsx
  <EventDateTimePicker
    dia={dia} mes={mes} ano={ano} hora={hora} minuto={minuto}
    onDia={setDia} onMes={setMes} onAno={setAno}
    onHora={(v) => { setHora(v); if (minuto === "") setMinuto("0") }}
    onMinuto={setMinuto}
    maxDays={maxDays} diaInvalida={diaInvalida} selectedMonth={selectedMonth}
    yearOptions={buildYearOptions(now.getFullYear())}
    bookedSlots={bookedSlots}
  />
  ```
  (The `onHora` wrapper preserves the "default minute to 0" behavior; the picker also guards it, so either placement is fine — keep both, it is idempotent.)
- In `handleSubmit`, replace the five inline guard blocks (lines ~130-162) with:
  ```tsx
  const validationError = validateCheckout({
    address: address ? { numero: address.numero } : null,
    addressInArea,
    dataEvento,
    tipoChopeira,
    temRampas,
  })
  if (validationError) {
    setError(validationError)
    setLoading(false)
    return
  }
  ```
  Add `import { validateCheckout } from "@/lib/checkout-validation"` and `import { EventDateTimePicker } from "@/components/checkout/event-datetime-picker"`. Keep `formatCpf`, the cart logic, and `createOrder(...)` unchanged.

- [ ] **Step 9: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/checkout-validation.ts app/lib/checkout-validation.test.ts app/lib/checkout-datetime.ts app/lib/checkout-datetime.test.ts app/components/checkout/event-datetime-picker.tsx app/components/checkout-form.tsx
git commit   # "refactor(checkout): extract datetime picker + pure validation from checkout-form"
```

---

### Task 10: Shared formatters (`formatPhone` mask + message micro-formatters)

**Files:**
- Modify: `app/lib/format.ts`
- Modify: `app/lib/format.test.ts`
- Modify: `app/components/admin/entregador-modal.tsx`
- Modify: `app/components/checkout-form.tsx`
- Modify: `app/lib/whatsapp/confirmacao-message.ts`
- Modify: `app/lib/whatsapp/entregador-message.ts`
- Modify: `app/lib/whatsapp/lembrete-message.ts`
- Modify: `app/lib/whatsapp/pedido-contexto.ts`

**Interfaces:**
- Produces (added to `app/lib/format.ts`):
  ```ts
  export const formatPhone: (value: string) => string   // as-you-type BR mask "(21) 99999-9999"
  export const firstName: (fullName: string) => string  // first whitespace-delimited token
  export const shortId: (id: string) => string          // first 8 chars (no leading #)
  export const formatTime: (hms: string) => string      // "HH:MM:SS" | "HH:MM" -> "HH:MM"
  ```

**Guard:** the existing tests `confirmacao-message.test.ts`, `entregador-message.test.ts`, `lembrete-message.test.ts`, `pedido-contexto.test.ts` MUST stay green — keep `pedidoRefCurto` returning `#${shortId(id)}` and `formatHorario` returning `formatTime(t)` (preserve their public signatures/output).

- [ ] **Step 1: Add the failing formatter cases to `app/lib/format.test.ts`**

Append:
```ts
import { formatPhone, firstName, shortId, formatTime } from "./format"

describe("formatPhone (as-you-type BR mask)", () => {
  it("masks an 11-digit mobile", () => {
    expect(formatPhone("21999991234")).toBe("(21) 99999-1234")
  })
  it("masks progressively and caps at 11 digits", () => {
    expect(formatPhone("21")).toBe("(21")
    expect(formatPhone("219999")).toBe("(21) 9999")
    expect(formatPhone("2199999123456")).toBe("(21) 99999-1234")
  })
  it("strips non-digits", () => {
    expect(formatPhone("(21) 9")).toBe("(21) 9")
  })
})

describe("firstName / shortId / formatTime", () => {
  it("firstName takes the first token", () => {
    expect(firstName("Maria Silva Santos")).toBe("Maria")
    expect(firstName("Maria")).toBe("Maria")
  })
  it("shortId takes the first 8 chars", () => {
    expect(shortId("abcdef12-3456-7890")).toBe("abcdef12")
  })
  it("formatTime trims to HH:MM", () => {
    expect(formatTime("18:30:00")).toBe("18:30")
    expect(formatTime("18:30")).toBe("18:30")
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix app run test -- format.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement the additions in `app/lib/format.ts`**

Append (the `formatPhone` body is the EXACT mask currently duplicated in `entregador-modal.tsx` and `checkout-form.tsx`):
```ts
// As-you-type BR phone mask, e.g. "21999991234" -> "(21) 99999-1234". Display only — distinct
// from the E.164 normalization in lib/whatsapp/phone.ts. Was duplicated in 2 client forms.
export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// Message/email micro-formatters that were re-implemented inline across the WhatsApp builders.
export const firstName = (fullName: string) => fullName.trim().split(" ")[0]
export const shortId = (id: string) => id.slice(0, 8)
export const formatTime = (hms: string) => hms.slice(0, 5)
```

- [ ] **Step 4: Run the formatter test to verify it passes**

Run: `npm --prefix app run test -- format.test.ts`
Expected: PASS.

- [ ] **Step 5: Migrate the phone-mask call sites**

- `entregador-modal.tsx`: delete the local `formatPhone` function; add `formatPhone` to the existing `@/lib/format`? (entregador-modal has no format import yet) → add `import { formatPhone } from "@/lib/format"`. The `onChange={(e) => setTelefone(formatPhone(e.target.value))}` call is unchanged.
- `checkout-form.tsx`: delete the local `formatPhone` function; add `formatPhone` to the existing `import { formatBRL } from "@/lib/format"` → `import { formatBRL, formatPhone } from "@/lib/format"`. The `onChange` usage is unchanged.

- [ ] **Step 6: Migrate the message micro-formatters**

- `confirmacao-message.ts`: replace `const firstName = data.clienteNome.split(" ")[0]` with `firstName(data.clienteNome)` (import `firstName, shortId, formatTime` from `@/lib/format`); `data.pedidoId.slice(0, 8)` → `shortId(data.pedidoId)`; `data.horarioEvento.slice(0, 5)` → `formatTime(data.horarioEvento)`. Keep the existing `formatEventDate` import.
- `entregador-message.ts`: `data.pedidoId.slice(0, 8)` → `shortId(...)`; `data.horarioEvento.slice(0, 5)` → `formatTime(...)` (import from `@/lib/format`).
- `lembrete-message.ts`: change `export const formatHorario = (t: string): string => t.slice(0, 5)` to delegate: `import { formatTime } from "@/lib/format"` then `export const formatHorario = (t: string): string => formatTime(t)` (preserves the public export + its test).
- `pedido-contexto.ts`: change `export const pedidoRefCurto = (id: string): string => `#${id.slice(0, 8)}`` to `import { shortId } from "@/lib/format"` then `export const pedidoRefCurto = (id: string): string => `#${shortId(id)}`` (preserves output + its test).

- [ ] **Step 7: Gate + commit**

```bash
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/lib/format.ts app/lib/format.test.ts app/components/admin/entregador-modal.tsx app/components/checkout-form.tsx app/lib/whatsapp/confirmacao-message.ts app/lib/whatsapp/entregador-message.ts app/lib/whatsapp/lembrete-message.ts app/lib/whatsapp/pedido-contexto.ts
git commit   # "refactor: centralize phone mask + message micro-formatters in lib/format"
```

---

### Task 11: Reuse primitives — `status-actions` badge + `content-editor` inputs

**Files:**
- Modify: `app/components/admin/status-actions.tsx`
- Modify: `app/components/admin/content-editor.tsx`

**Interfaces:**
- Consumes: `OrderStatusBadge` (default export of `@/components/order-status-badge`); `Input`, `Textarea`, `Select`, `fieldLabelClass` from `@/components/ui`.

**Note:** `status-actions`' two inline badge spans use the exact class string of `OrderStatusBadge` — a true 1:1 dedup. `content-editor`'s native inputs adopt the UI primitives; minor visual delta possible (primitive styling) — confirm in visual QA.

- [ ] **Step 1: Dedup the badge in `status-actions.tsx`**

Add `import OrderStatusBadge from "@/components/order-status-badge"`. Replace BOTH occurrences of:
```tsx
<span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${statusConfig[currentStatus].color}`}>
  {statusConfig[currentStatus].label}
</span>
```
with:
```tsx
<OrderStatusBadge status={currentStatus} />
```
If `statusConfig` is then unused, remove its import (`import { statusConfig } from "@/components/order-status-badge"`). Note: `statusConfig[nextStatus].label` is still used in the "Mover para:" button — if so, keep the `statusConfig` import; only the two badge spans change.

- [ ] **Step 2: Migrate `content-editor.tsx` to primitives**

Add `import { Button, Input, Textarea, Select, fieldLabelClass } from "@/components/ui"` (Button already imported). Replace native form controls:
- `<input className={inputClassName} ... />` → `<Input ... />` (drop `className`)
- `<textarea rows={n} className={`${inputClassName} resize-none`} ... />` → `<Textarea rows={n} ... />`
- `<select className={inputClassName} ...>` → `<Select ...>`
- `<label className={labelClassName}>` → `<label className={fieldLabelClass}>`
Then remove the now-unused local `inputClassName` and `labelClassName` consts. Keep the tab buttons, the "+ Adicionar"/"Remover" text buttons, the `motion.div`, and all state/handlers unchanged.

- [ ] **Step 3: Add a render smoke test for content-editor**

`app/components/admin/content-editor.test.tsx`:
```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({ saveConteudo: vi.fn() }))

import ContentEditor from "./content-editor"

afterEach(cleanup)

describe("ContentEditor", () => {
  it("renders the Hero tab with primitive inputs", () => {
    render(<ContentEditor hero={null} features={null} faq={null} footer={null} />)
    expect(screen.getByText("Salvar Hero")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Chopp gelado no seu evento")).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the smoke test + gate + commit**

```bash
npm --prefix app run test -- content-editor.test.tsx
npm --prefix app run typecheck && npm --prefix app run test && npm --prefix app run build
git add app/components/admin/status-actions.tsx app/components/admin/content-editor.tsx app/components/admin/content-editor.test.tsx
git commit   # "refactor(admin): reuse OrderStatusBadge + UI primitives in status-actions/content-editor"
```

---

## Final whole-branch review (after Task 11)

Dispatch the final code reviewer (most-capable model) over the full Phase 2 range with the package from `scripts/review-package <merge-base> HEAD`. Hand it: this plan's Global Constraints (behavior-preserving + the explicit list of sanctioned Esc/scroll-lock + visual-normalization deltas), and the minor-findings ledger. Then run the Phase 2 close-out checks below.

## Post-phase visual QA (Playwright/Chrome, before/after on touched admin screens)

- The 4 migrated modals (delete product, novo/editar entregador, voltar status, despachar) open/close, Esc closes, backdrop closes, actions still work.
- The 3 drawers (novo pedido manual, editar pedido, configurações WhatsApp) open/close, Esc + scroll-lock, address "Buscar/Trocar via Google" toggle works, save/discard/submit unchanged.
- The 4 WhatsApp config panels toggle (optimistic + rollback on simulated failure), collapse/expand, save/restore messages.
- Checkout: date/time picker, validation messages (out-of-area, past date, no chopeira, no rampas), submit happy-path.
- Emails: golden tests are the contract (no manual send needed).

## Success criteria (Phase 2)

- All 13 dedups landed across Tasks 1–11; `tsc` clean, full vitest suite green (new component + golden + pure tests added), `next build` clean.
- No behavior change beyond the sanctioned Esc/scroll-lock consistency + listed visual normalizations.
- `<Modal>`, `<Drawer>`, `<FeaturePanel>`, `useOptimisticFlag`, the shared address block, the email shell, the checkout split, and the shared formatters each have a test and at least one real consumer.
- Migration 028 deploy-pending note (from Phase 0+1) is unchanged and still must precede the prod deploy of the createManualOrder code.

## Self-review notes (author)

- **Spec coverage:** Modal ✓(T1/T2), Drawer ✓(T3/T5), email shell+golden ✓(T8), FeaturePanel+useOptimisticFlag ✓(T6/T7), address block ✓(T4/T5), checkout split ✓(T9), content-editor→primitives ✓(T11), status-actions→OrderStatusBadge ✓(T11), phone mask→lib/format ✓(T10), message micro-formatters ✓(T10). All Phase 2 spec bullets mapped.
- **No `confirm()` removal** in Phase 2 (correctly deferred to Phase 3); migrated modals keep inner `confirm()` verbatim.
- **Type consistency:** `EnderecoCompleto` (T4) structurally matches both drawers' inline endereco_completo shape; `useOptimisticFlag` return `{on,toggle,error,setError}` consumed identically by all 4 panels; `formatTime`/`shortId` wrapped by `formatHorario`/`pedidoRefCurto` to preserve existing tested exports.
- **Risk note:** Task 8 byte-identical golden is the fiddliest; the task explicitly allows leaving a stubborn fragment inline while still sharing `emailShell`+`ctaButton` (dedup intent preserved, output pinned by golden).
