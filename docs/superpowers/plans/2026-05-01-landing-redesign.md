# Landing redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage hero, footer, header, and add a working calculator section that pixel-copies alfachopp.com.br while integrating with our existing CartProvider and checkout.

**Architecture:** Five new components in `app/components/landing/` + one pure-utility module + Vitest setup. The new components are scoped to `app/app/page.tsx` only — admin/checkout/meus-pedidos pages keep the existing `Header` and `Footer`. Calculator computes recommended liters, maps to a 30L/50L barrel combo, and adds the result to the existing cart context.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind v4, Framer Motion 12, Vitest 2 (new), TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-05-01-landing-redesign-design.md`

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `app/components/landing/calculator-utils.ts` | Pure functions: `calcularLitros`, `resolverCombo` |
| `app/components/landing/calculator-utils.test.ts` | Vitest tests for the pure functions |
| `app/components/landing/header-landing.tsx` | Pixel-copy header (sticky, transparent over hero) |
| `app/components/landing/hero-landing.tsx` | Split-layout hero with bg image |
| `app/components/landing/calculator.tsx` | Yellow card calculator wired to CartProvider |
| `app/components/landing/footer-landing.tsx` | 4-column pixel-copy footer |
| `app/components/landing/whatsapp-fab.tsx` | Sticky WhatsApp floating button |
| `app/vitest.config.ts` | Vitest config |
| `app/public/landing/hero-chopp.jpg` | Hero background image |
| `app/public/landing/instagram/01.jpg` | Instagram thumbnail placeholder |
| `app/public/landing/instagram/02.jpg` | Instagram thumbnail placeholder |
| `app/public/landing/instagram/03.jpg` | Instagram thumbnail placeholder |
| `app/public/landing/payment/pix.svg` | Payment method icon |
| `app/public/landing/payment/visa.svg` | Payment method icon |
| `app/public/landing/payment/mastercard.svg` | Payment method icon |
| `app/public/landing/payment/elo.svg` | Payment method icon |

**Modified files:**

| Path | Change |
|---|---|
| `app/lib/cart-context.tsx` | Extend `addToCart` signature with `quantidade?: number` |
| `app/lib/queries.ts` | Add `getProdutoByMarcaVolume(marca, volume)` helper |
| `app/components/storefront.tsx` | Pass props to `Catalog` if needed (no anchor change — `#catalogo` already exists) |
| `app/components/faq.tsx` | Add `id="faq"` to `<section>` line 87 |
| `app/app/page.tsx` | Swap `Header`→`HeaderLanding`, `Hero`→`HeroLanding`, `Footer`→`FooterLanding`; insert `<Calculator />` between hero and Storefront; add `<WhatsappFab />` |
| `app/package.json` | Add `vitest`, `@vitest/ui` devDeps + `test` script |

**Anchor naming:** the spec mentions `#chopps` for the catalog (matching alfachopp.com.br). The codebase already uses `id="catalogo"` in `app/components/catalog.tsx:21`. **Decision:** keep `#catalogo` (changing breaks existing references) — header/footer nav links use `#catalogo` even though label says "NOSSOS CHOPPS". Anchor names are invisible to users.

---

### Task 1: Vitest setup

**Files:**
- Modify: `app/package.json`
- Create: `app/vitest.config.ts`
- Create: `app/components/landing/__sanity.test.ts` (one-line smoke test, deleted after Task 2)

- [ ] **Step 1: Install Vitest**

```bash
cd app && npm install --save-dev vitest@^2 @vitest/ui@^2
```

Expected: lockfile updated, no errors.

- [ ] **Step 2: Add test script to `app/package.json`**

Replace the `scripts` block:

```json
"scripts": {
  "dev": "next dev -p 2998",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `app/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
```

- [ ] **Step 4: Create sanity test `app/components/landing/__sanity.test.ts`**

```ts
import { describe, it, expect } from "vitest"

describe("vitest sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the sanity test**

```bash
cd app && npm test
```

Expected: `1 passed`, exit code 0.

- [ ] **Step 6: Delete the sanity test**

```bash
rm app/components/landing/__sanity.test.ts
```

- [ ] **Step 7: Commit**

```bash
cd .. && git add app/package.json app/package-lock.json app/vitest.config.ts && git commit -m "chore: add vitest for unit tests of pure utilities"
```

---

### Task 2: Calculator pure utilities (TDD)

**Files:**
- Create: `app/components/landing/calculator-utils.ts`
- Create: `app/components/landing/calculator-utils.test.ts`

- [ ] **Step 1: Write failing tests for `calcularLitros`**

Create `app/components/landing/calculator-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { calcularLitros, resolverCombo } from "./calculator-utils"

describe("calcularLitros", () => {
  it("multiplies people × hours × consumption factor and rounds up to nearest 5", () => {
    expect(calcularLitros(20, 4, "padrao")).toBe(40)
    expect(calcularLitros(10, 3, "moderado")).toBe(15)
    expect(calcularLitros(15, 5, "alto")).toBe(55)
  })

  it("rounds 38 up to 40", () => {
    expect(calcularLitros(19, 4, "padrao")).toBe(40)
  })

  it("returns 0 when any input is 0 or negative", () => {
    expect(calcularLitros(0, 4, "padrao")).toBe(0)
    expect(calcularLitros(20, 0, "padrao")).toBe(0)
    expect(calcularLitros(-5, 4, "padrao")).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd app && npm test
```

Expected: tests fail with "Cannot find module" or "calcularLitros is not a function".

- [ ] **Step 3: Implement `calcularLitros`**

Create `app/components/landing/calculator-utils.ts`:

```ts
export type EstiloConsumo = "moderado" | "padrao" | "alto"

const FATORES: Record<EstiloConsumo, number> = {
  moderado: 0.4,
  padrao: 0.5,
  alto: 0.7,
}

export const calcularLitros = (pessoas: number, horas: number, estilo: EstiloConsumo): number => {
  if (pessoas <= 0 || horas <= 0) return 0
  const bruto = pessoas * horas * FATORES[estilo]
  return Math.ceil(bruto / 5) * 5
}

export type Combo = { b50: number; b30: number; total: number; sobra: number }

export const resolverCombo = (litros: number): Combo => {
  if (litros <= 0) return { b50: 0, b30: 0, total: 0, sobra: 0 }
  const candidatos: Combo[] = []
  const max50 = Math.ceil(litros / 50)
  const max30 = Math.ceil(litros / 30)
  for (let b50 = 0; b50 <= max50; b50++) {
    for (let b30 = 0; b30 <= max30; b30++) {
      const total = b50 * 50 + b30 * 30
      if (total >= litros) candidatos.push({ b50, b30, total, sobra: total - litros })
    }
  }
  candidatos.sort((a, b) => a.sobra - b.sobra || (a.b50 + a.b30) - (b.b50 + b.b30))
  return candidatos[0]
}
```

- [ ] **Step 4: Run tests — verify `calcularLitros` passes**

```bash
cd app && npm test
```

Expected: 3 tests in `calcularLitros` block pass.

- [ ] **Step 5: Add tests for `resolverCombo`**

Append to `app/components/landing/calculator-utils.test.ts`:

```ts
describe("resolverCombo", () => {
  it("40L → 1× 50L (10L spare beats 30+30=60 with 20L spare? no, 30L only with -10L is invalid. So 50L wins)", () => {
    expect(resolverCombo(40)).toMatchObject({ b50: 1, b30: 0, total: 50, sobra: 10 })
  })

  it("60L → 2× 30L (zero spare beats 50+30 with 20L spare)", () => {
    expect(resolverCombo(60)).toMatchObject({ b50: 0, b30: 2, total: 60, sobra: 0 })
  })

  it("80L → 1× 50L + 1× 30L (zero spare)", () => {
    expect(resolverCombo(80)).toMatchObject({ b50: 1, b30: 1, total: 80, sobra: 0 })
  })

  it("100L → 2× 50L (zero spare, fewest items wins tiebreak vs 50+30+30)", () => {
    expect(resolverCombo(100)).toMatchObject({ b50: 2, b30: 0, total: 100, sobra: 0 })
  })

  it("120L → 2× 50L + 1× 30L (10L spare, fewer items than 4× 30L)", () => {
    expect(resolverCombo(120)).toMatchObject({ b50: 2, b30: 1, total: 130, sobra: 10 })
  })

  it("0L returns empty combo", () => {
    expect(resolverCombo(0)).toMatchObject({ b50: 0, b30: 0, total: 0, sobra: 0 })
  })
})
```

- [ ] **Step 6: Run all tests**

```bash
cd app && npm test
```

Expected: all 9 tests pass.

- [ ] **Step 7: Commit**

```bash
cd .. && git add app/components/landing/calculator-utils.ts app/components/landing/calculator-utils.test.ts && git commit -m "feat(landing): pure utilities for liters calc + 30/50L bin-pack"
```

---

### Task 3: Extend Cart API for bulk add

**Files:**
- Modify: `app/lib/cart-context.tsx`

- [ ] **Step 1: Update the type and implementation**

In `app/lib/cart-context.tsx`, replace the `addToCart` definition (lines 10 + 53-66):

```ts
// In CartContextType (line 10):
addToCart: (produto: Produto, quantidade?: number) => void

// In the provider (lines 53-66):
const addToCart = useCallback((produto: Produto, quantidade: number = 1) => {
  if (quantidade <= 0) return
  setItems((prev) => {
    const existing = prev.find((item) => item.produto.id === produto.id)
    if (existing) {
      return prev.map((item) =>
        item.produto.id === produto.id
          ? { ...item, quantidade: item.quantidade + quantidade }
          : item
      )
    }
    return [...prev, { produto, quantidade }]
  })
  setCartOpen(true)
}, [])
```

- [ ] **Step 2: Verify typecheck passes (no callers broke since param is optional)**

```bash
cd app && npm run typecheck
```

Expected: exit code 0, no output.

- [ ] **Step 3: Verify build passes**

```bash
cd app && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/lib/cart-context.tsx && git commit -m "feat(cart): allow addToCart to take quantity for bulk inserts"
```

---

### Task 4: Static assets

**Files:**
- Create: `app/public/landing/hero-chopp.jpg`
- Create: `app/public/landing/instagram/01.jpg`, `02.jpg`, `03.jpg`
- Create: `app/public/landing/payment/pix.svg`, `visa.svg`, `mastercard.svg`, `elo.svg`

- [ ] **Step 1: Create asset directories**

```bash
mkdir -p app/public/landing/instagram app/public/landing/payment
```

- [ ] **Step 2: Download a hero image from Unsplash**

```bash
curl -L "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=1600&q=80&fm=jpg" -o app/public/landing/hero-chopp.jpg
```

(That's a beer-cheers photo from Unsplash. If user prefers a different one, swap the URL — the Unsplash search `https://unsplash.com/s/photos/beer-cheers` has good options. Final image must be at least 1200×900 and under 500KB.)

- [ ] **Step 3: Verify the image downloaded and size is reasonable**

```bash
ls -lh app/public/landing/hero-chopp.jpg
file app/public/landing/hero-chopp.jpg
```

Expected: file exists, type `JPEG image data`, size between 50KB and 500KB.

- [ ] **Step 4: Create instagram placeholder thumbnails**

```bash
curl -L "https://images.unsplash.com/photo-1551130222-c5b1f57e8f78?w=200&q=70" -o app/public/landing/instagram/01.jpg
curl -L "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=200&q=70" -o app/public/landing/instagram/02.jpg
curl -L "https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=200&q=70" -o app/public/landing/instagram/03.jpg
```

- [ ] **Step 5: Create payment SVG icons**

Write `app/public/landing/payment/pix.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24"><rect width="64" height="24" rx="3" fill="#32BCAD"/><text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="11" fill="white">PIX</text></svg>
```

Write `app/public/landing/payment/visa.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24"><rect width="64" height="24" rx="3" fill="#1A1F71"/><text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-style="italic" font-size="12" fill="white">VISA</text></svg>
```

Write `app/public/landing/payment/mastercard.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24"><rect width="64" height="24" rx="3" fill="#0A0A0A"/><circle cx="26" cy="12" r="7" fill="#EB001B"/><circle cx="38" cy="12" r="7" fill="#F79E1B" opacity="0.85"/></svg>
```

Write `app/public/landing/payment/elo.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 24" width="64" height="24"><rect width="64" height="24" rx="3" fill="#000"/><text x="32" y="16" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="11" fill="white">elo</text></svg>
```

- [ ] **Step 6: Verify all assets are present**

```bash
find app/public/landing -type f | sort
```

Expected output:
```
app/public/landing/hero-chopp.jpg
app/public/landing/instagram/01.jpg
app/public/landing/instagram/02.jpg
app/public/landing/instagram/03.jpg
app/public/landing/payment/elo.svg
app/public/landing/payment/mastercard.svg
app/public/landing/payment/pix.svg
app/public/landing/payment/visa.svg
```

- [ ] **Step 7: Commit**

```bash
git add app/public/landing && git commit -m "chore(landing): add hero photo, instagram placeholders, payment icons"
```

---

### Task 5: HeaderLanding component

**Files:**
- Create: `app/components/landing/header-landing.tsx`

- [ ] **Step 1: Write the component**

Create `app/components/landing/header-landing.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

const NAV_LINKS = [
  { label: "INÍCIO", href: "#home" },
  { label: "NOSSOS CHOPPS", href: "#catalogo" },
  { label: "CALCULADORA", href: "#calculadora" },
  { label: "MEUS PEDIDOS", href: "/meus-pedidos" },
] as const

const HeaderLanding = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled ? "bg-brand-dark border-b border-brand-yellow/20" : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <span className="inline-block w-7 h-7 rounded-full bg-brand-yellow/20 border border-brand-yellow flex items-center justify-center text-brand-yellow text-xs">🍺</span>
            <span className="leading-none">
              <span className="block font-display font-bold text-brand-yellow text-lg tracking-wide">ALFA</span>
              <span className="block font-display text-brand-yellow text-[10px] tracking-[0.2em]">CHOPP</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white text-xs font-semibold tracking-widest hover:text-brand-yellow transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            <motion.a
              href="#catalogo"
              whileHover={{ opacity: 0.85, scale: 0.98 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-yellow text-brand-black font-bold px-5 py-2 rounded-full text-xs tracking-widest uppercase flex items-center gap-2"
            >
              <span>🛒</span>
              <span>Pedir Agora</span>
            </motion.a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="md:hidden text-brand-yellow p-2 cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-dark md:hidden flex flex-col"
          >
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="text-brand-yellow p-2 cursor-pointer"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-white text-lg font-semibold tracking-widest"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="#catalogo"
                onClick={() => setMobileOpen(false)}
                className="bg-brand-yellow text-brand-black font-bold px-8 py-3 rounded-full text-sm tracking-widest uppercase"
              >
                🛒 Pedir Agora
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default HeaderLanding
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/components/landing/header-landing.tsx && git commit -m "feat(landing): pixel-copy header with sticky transparent-on-hero behavior"
```

---

### Task 6: HeroLanding component

**Files:**
- Create: `app/components/landing/hero-landing.tsx`

- [ ] **Step 1: Write the component**

Create `app/components/landing/hero-landing.tsx`:

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

type HeroLandingProps = {
  whatsappNumber?: string
}

const HeroLanding = ({ whatsappNumber = "5521999999999" }: HeroLandingProps) => (
  <section
    id="home"
    className="relative bg-brand-dark text-white overflow-hidden pt-20 md:pt-0"
  >
    <div className="grid md:grid-cols-[1.1fr_0.9fr] min-h-[80vh]">
      <div className="relative z-10 flex flex-col justify-center px-6 md:px-16 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex self-start items-center bg-brand-yellow text-brand-black text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-6"
        >
          Delivery Premium
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display font-bold leading-[0.95] tracking-tight text-5xl md:text-6xl lg:text-7xl"
        >
          <span className="block">O Melhor Chopp</span>
          <span className="block text-brand-yellow">Pelo Melhor Preço</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 text-base md:text-lg text-brand-warm-gray max-w-md leading-relaxed"
        >
          Leve a experiência da choperia para o conforto da sua casa. Equipamento profissional,
          instalação rápida e o sabor inigualável que seus convidados merecem.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 flex flex-col sm:flex-row gap-3"
        >
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-brand-yellow text-brand-black font-bold uppercase tracking-widest text-xs px-6 py-3.5 rounded-md hover:opacity-90 transition-opacity"
          >
            Solicitar Orçamento
          </a>
          <Link
            href="#calculadora"
            className="inline-flex items-center justify-center border border-white/40 text-white font-bold uppercase tracking-widest text-xs px-6 py-3.5 rounded-md hover:border-white transition-colors"
          >
            Ver Opções
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-brand-warm-gray"
        >
          <span className="flex items-center gap-2"><span className="text-brand-yellow">✓</span> Instalação Grátis</span>
          <span className="flex items-center gap-2"><span className="text-brand-yellow">✓</span> Equipamento Incluso</span>
        </motion.div>
      </div>

      <div className="relative min-h-[300px] md:min-h-full">
        <Image
          src="/landing/hero-chopp.jpg"
          alt="Brindando com chopp"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 md:bg-gradient-to-r md:from-brand-dark md:via-transparent md:to-transparent" />
      </div>
    </div>
  </section>
)

export default HeroLanding
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/components/landing/hero-landing.tsx && git commit -m "feat(landing): pixel-copy hero with split text/image layout"
```

---

### Task 7: WhatsappFab component

**Files:**
- Create: `app/components/landing/whatsapp-fab.tsx`

- [ ] **Step 1: Write the component**

Create `app/components/landing/whatsapp-fab.tsx`:

```tsx
"use client"

import { motion } from "framer-motion"

type WhatsappFabProps = {
  whatsappNumber?: string
}

const WhatsappFab = ({ whatsappNumber = "5521999999999" }: WhatsappFabProps) => (
  <motion.a
    href={`https://wa.me/${whatsappNumber}`}
    target="_blank"
    rel="noopener noreferrer"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 0.5, duration: 0.3 }}
    whileHover={{ scale: 1.06 }}
    whileTap={{ scale: 0.95 }}
    aria-label="Falar no WhatsApp"
    className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-2xl"
  >
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M20.52 3.48A11.86 11.86 0 0012.04 0C5.46 0 .12 5.34.12 11.92c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.66a11.93 11.93 0 005.74 1.46h.01c6.58 0 11.92-5.34 11.92-11.92 0-3.18-1.24-6.18-3.45-8.4zM12.05 21.6a9.66 9.66 0 01-4.93-1.35l-.36-.21-3.74.98 1-3.65-.23-.37a9.6 9.6 0 01-1.5-5.08c0-5.32 4.34-9.65 9.66-9.65 2.58 0 5.01 1.01 6.84 2.83a9.62 9.62 0 012.83 6.83c0 5.32-4.33 9.66-9.66 9.66zm5.3-7.23c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.15-.2.29-.76.94-.94 1.14-.17.2-.35.22-.64.07-.29-.15-1.22-.45-2.32-1.43-.86-.77-1.43-1.71-1.6-2-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.6-.91-2.18-.24-.57-.48-.49-.66-.5l-.56-.01a1.07 1.07 0 00-.78.37c-.27.29-1.02 1-1.02 2.43 0 1.43 1.05 2.82 1.2 3.01.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.72-.7 1.97-1.38.24-.68.24-1.27.17-1.38-.07-.12-.27-.2-.56-.34z"/>
    </svg>
  </motion.a>
)

export default WhatsappFab
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/components/landing/whatsapp-fab.tsx && git commit -m "feat(landing): sticky WhatsApp FAB"
```

---

### Task 8: FooterLanding component

**Files:**
- Create: `app/components/landing/footer-landing.tsx`

- [ ] **Step 1: Write the component**

Create `app/components/landing/footer-landing.tsx`:

```tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").replace(/^55/, "")
  if (digits.length !== 11) return raw
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const QUICK_LINKS = [
  { label: "Início", href: "#home" },
  { label: "Nossos Chopps", href: "#catalogo" },
  { label: "Calculadora", href: "#calculadora" },
  { label: "Dúvidas Frequentes", href: "#faq" },
] as const

const PAYMENT_ICONS = ["pix", "visa", "mastercard", "elo"] as const

type FooterLandingProps = {
  whatsappNumber?: string
  contactEmail?: string
  instagramUrl?: string
}

const FooterLanding = ({
  whatsappNumber = "5521999999999",
  contactEmail = "contato@alfachopp.com.br",
  instagramUrl = "https://www.instagram.com/alfachopp/",
}: FooterLandingProps) => (
  <footer className="bg-brand-dark text-brand-warm-gray pt-16 pb-6 px-6 border-t border-brand-yellow/15">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-7 h-7 rounded-full bg-brand-yellow/20 border border-brand-yellow flex items-center justify-center text-brand-yellow text-xs">🍺</span>
          <span className="leading-none">
            <span className="block font-display font-bold text-brand-yellow text-lg tracking-wide">ALFA</span>
            <span className="block font-display text-brand-yellow text-[10px] tracking-[0.2em]">CHOPP</span>
          </span>
        </div>
        <p className="text-sm leading-relaxed mb-4">
          Especialistas em levar o melhor chopp para o seu evento. Qualidade, pontualidade
          e serviço premium.
        </p>
        <div className="flex gap-3">
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full border border-brand-yellow/40 flex items-center justify-center hover:bg-brand-yellow/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-brand-yellow">
              <rect x="2" y="2" width="20" height="20" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
            </svg>
          </a>
          <a href="https://www.facebook.com/alfachopp" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full border border-brand-yellow/40 flex items-center justify-center hover:bg-brand-yellow/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-brand-yellow">
              <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9V12.06h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33V22c4.78-.78 8.43-4.94 8.43-9.94z"/>
            </svg>
          </a>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.05 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Links Rápidos</h3>
        <ul className="space-y-2 text-sm">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-brand-yellow transition-colors">{link.label}</Link>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Contato</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">📞</span>
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-yellow transition-colors">
              {formatPhone(whatsappNumber)}
            </a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">✉️</span>
            <a href={`mailto:${contactEmail}`} className="hover:text-brand-yellow transition-colors break-all">{contactEmail}</a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">📍</span>
            <span>Atendemos toda a região metropolitana</span>
          </li>
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.15 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Siga no Instagram</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3].map((n) => (
            <a key={n} href={instagramUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-md hover:opacity-80 transition-opacity">
              <Image src={`/landing/instagram/0${n}.jpg`} alt={`Post Instagram ${n}`} width={120} height={120} className="object-cover w-full h-full" />
            </a>
          ))}
        </div>
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-yellow hover:underline">
          Ver perfil completo →
        </a>
      </motion.div>

    </div>

    <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-brand-yellow/15 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
      <p>© {new Date().getFullYear()} Alfa Chopp Express. Todos os direitos reservados.</p>
      <div className="flex gap-2">
        {PAYMENT_ICONS.map((name) => (
          <Image key={name} src={`/landing/payment/${name}.svg`} alt={name} width={48} height={18} />
        ))}
      </div>
    </div>
  </footer>
)

export default FooterLanding
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/components/landing/footer-landing.tsx && git commit -m "feat(landing): pixel-copy 4-column footer"
```

---

### Task 9: Calculator component

**Files:**
- Create: `app/components/landing/calculator.tsx`

- [ ] **Step 1: Write the component**

Create `app/components/landing/calculator.tsx`:

```tsx
"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useCart } from "@/lib/cart-context"
import type { Produto } from "@/lib/types"
import { calcularLitros, resolverCombo, type EstiloConsumo } from "./calculator-utils"

type CalculatorProps = {
  produtos: Produto[]
  whatsappNumber?: string
}

const ESTILOS: Array<{ value: EstiloConsumo; label: string }> = [
  { value: "moderado", label: "Moderado (Família/Tarde)" },
  { value: "padrao", label: "Padrão (Churrasco/Festa)" },
  { value: "alto", label: "Alto (Balada/Open Bar)" },
]

const findChopp = (produtos: Produto[], volume: 30 | 50): Produto | null => {
  const chopps = produtos.filter((p) => p.tipo === "chopp" && p.ativo && p.volume_litros === volume)
  if (chopps.length === 0) return null
  const pilsen = chopps.find((p) => p.marca.toLowerCase().includes("pilsen"))
  return pilsen ?? chopps[0]
}

const Calculator = ({ produtos, whatsappNumber = "5521999999999" }: CalculatorProps) => {
  const [pessoas, setPessoas] = useState(20)
  const [horas, setHoras] = useState(4)
  const [estilo, setEstilo] = useState<EstiloConsumo>("padrao")
  const [feedback, setFeedback] = useState<string | null>(null)
  const { addToCart } = useCart()

  const litros = useMemo(() => calcularLitros(pessoas, horas, estilo), [pessoas, horas, estilo])
  const combo = useMemo(() => resolverCombo(litros), [litros])
  const podeAdicionar = litros > 0

  const handleAdd = () => {
    setFeedback(null)
    if (!podeAdicionar) return
    const produto50 = combo.b50 > 0 ? findChopp(produtos, 50) : null
    const produto30 = combo.b30 > 0 ? findChopp(produtos, 30) : null
    if ((combo.b50 > 0 && !produto50) || (combo.b30 > 0 && !produto30)) {
      setFeedback("Algum barril desse tamanho não está disponível agora — fale conosco no WhatsApp.")
      return
    }
    if (produto50 && combo.b50 > 0) addToCart(produto50, combo.b50)
    if (produto30 && combo.b30 > 0) addToCart(produto30, combo.b30)
    const marca = (produto50 ?? produto30)?.marca ?? "chopp"
    setFeedback(`Adicionamos ${combo.b50 > 0 ? `${combo.b50}× 50L` : ""}${combo.b50 > 0 && combo.b30 > 0 ? " + " : ""}${combo.b30 > 0 ? `${combo.b30}× 30L` : ""} de ${marca} ao carrinho. Você pode trocar a marca antes de finalizar.`)
  }

  return (
    <section id="calculadora" className="bg-brand-dark py-16 md:py-24 px-4">
      <div className="max-w-5xl mx-auto bg-brand-yellow rounded-xl p-6 md:p-10 shadow-2xl">
        <h2 className="font-display text-brand-black text-3xl md:text-4xl font-bold tracking-tight uppercase">
          Calculadora de Festa
        </h2>
        <p className="text-brand-black/80 text-sm md:text-base mt-2 mb-8">
          Não sabe quanto pedir? Faça uma simulação rápida para não faltar chopp.
        </p>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10">

          <div className="space-y-5">
            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Número de pessoas (bebem chopp)
              </span>
              <input
                type="number"
                min={1}
                value={pessoas}
                onChange={(e) => setPessoas(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white text-brand-black font-bold text-lg px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Duração da festa (horas)
              </span>
              <input
                type="number"
                min={1}
                value={horas}
                onChange={(e) => setHoras(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-white text-brand-black font-bold text-lg px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Estilo de consumo
              </span>
              <select
                value={estilo}
                onChange={(e) => setEstilo(e.target.value as EstiloConsumo)}
                className="w-full bg-white text-brand-black font-bold text-base px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none cursor-pointer"
              >
                {ESTILOS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="bg-brand-black text-white rounded-md p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Você vai precisar de aprox.</p>
              <div className="flex items-baseline gap-2 mt-2">
                <motion.span
                  key={litros}
                  initial={{ scale: 0.92, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="font-display text-7xl font-bold text-brand-yellow"
                >
                  {litros}
                </motion.span>
                <span className="font-display text-xl uppercase tracking-widest">Litros</span>
              </div>
              <p className="text-xs text-white/50 mt-3">
                Cálculo aproximado. Recomendamos sempre uma margem de segurança.
              </p>
              {litros > 0 && (
                <p className="text-xs text-brand-yellow/80 mt-2">
                  Combo sugerido: {combo.b50 > 0 ? `${combo.b50}× 50L` : ""}{combo.b50 > 0 && combo.b30 > 0 ? " + " : ""}{combo.b30 > 0 ? `${combo.b30}× 30L` : ""} ({combo.total}L total)
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!podeAdicionar}
              className="mt-5 w-full bg-brand-yellow text-brand-black font-bold uppercase tracking-widest text-sm px-4 py-3.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Solicitar Essa Quantidade
            </button>

            {feedback && (
              <p className="mt-3 text-xs text-white/80">{feedback}</p>
            )}

            {litros > 200 && (
              <p className="mt-3 text-xs text-white/70">
                Eventos grandes?{" "}
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">
                  Fale conosco para preço especial
                </a>.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Calculator
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/components/landing/calculator.tsx && git commit -m "feat(landing): calculator section with cart integration"
```

---

### Task 10: Wire into homepage + add FAQ anchor

**Files:**
- Modify: `app/components/faq.tsx` (line 87)
- Modify: `app/app/page.tsx` (full rewrite)

- [ ] **Step 1: Add `id="faq"` to FAQ section**

In `app/components/faq.tsx`, change line 87 from:

```tsx
<section className="py-20 px-4 bg-brand-surface">
```

to:

```tsx
<section id="faq" className="py-20 px-4 bg-brand-surface">
```

- [ ] **Step 2: Update homepage**

Replace `app/app/page.tsx` entirely:

```tsx
import HeaderLanding from "@/components/landing/header-landing"
import HeroLanding from "@/components/landing/hero-landing"
import Calculator from "@/components/landing/calculator"
import FooterLanding from "@/components/landing/footer-landing"
import WhatsappFab from "@/components/landing/whatsapp-fab"
import Storefront from "@/components/storefront"
import Features from "@/components/features"
import Faq from "@/components/faq"
import { getActiveProducts, getConfig, getConteudo } from "@/lib/queries"
import type { FeaturesContent, FaqContent } from "@/lib/types"

const HomePage = async () => {
  const [produtos, whatsappNumber, featuresContent, faqContent] = await Promise.all([
    getActiveProducts(),
    getConfig("whatsapp_numero"),
    getConteudo("features") as Promise<FeaturesContent | null>,
    getConteudo("faq") as Promise<FaqContent | null>,
  ])

  const whatsapp = whatsappNumber ?? "5521999999999"

  return (
    <>
      <HeaderLanding />
      <main>
        <HeroLanding whatsappNumber={whatsapp} />
        <Calculator produtos={produtos} whatsappNumber={whatsapp} />
        <Storefront produtos={produtos}>
          <Features content={featuresContent} />
          <Faq content={faqContent} />
        </Storefront>
      </main>
      <FooterLanding whatsappNumber={whatsapp} />
      <WhatsappFab whatsappNumber={whatsapp} />
    </>
  )
}

export default HomePage
```

(Note: removed hero/footer content fetching — new components are self-contained per design. The CMS-driven hero/footer config is no longer used on the landing.)

- [ ] **Step 3: Verify typecheck passes**

```bash
cd app && npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Verify build passes**

```bash
cd app && npm run build
```

Expected: build succeeds, all 13+ pages generated.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/app/page.tsx app/components/faq.tsx && git commit -m "feat(landing): wire new components into homepage + add faq anchor"
```

---

### Task 11: Browser verification

**Files:** none modified — verification only

- [ ] **Step 1: Start dev server in background**

```bash
cd app && npm run dev &
```

Wait ~5 seconds for server to start (default port 2998).

- [ ] **Step 2: Use playwright MCP to open and screenshot the landing**

Use the playwright MCP tools to:
- Navigate to `http://localhost:2998/`
- Resize viewport to 1440×900
- Take a full-page screenshot, save to `/tmp/landing-after.png`
- Open `https://www.alfachopp.com.br/` in a separate tab and screenshot to `/tmp/landing-target.png`
- Compare visually side by side and report differences

- [ ] **Step 3: Manual interaction checks (perform via playwright clicks/scrolls)**

Verify each:
- Header is transparent on top of hero, becomes solid `bg-brand-dark` after scrolling past 80px
- Clicking "INÍCIO" scrolls to top, "NOSSOS CHOPPS" → catalog, "CALCULADORA" → calculator section, "MEUS PEDIDOS" → `/meus-pedidos`
- Clicking "Pedir Agora" in header scrolls to catalog
- Hero "SOLICITAR ORÇAMENTO" opens `wa.me/{number}` in new tab
- Hero "VER OPÇÕES" scrolls to calculator
- Calculator: change pessoas to 30, horas to 5, estilo to Alto → liters updates to 110
- Calculator CTA "SOLICITAR ESSA QUANTIDADE": click, verify cart drawer opens with the right items (e.g. for 110L: `2× 50L + 1× 30L`)
- Footer: 4 columns visible, Quick Links scroll to anchors, Instagram thumbnails clickable
- WhatsApp FAB visible bottom-right, opens WhatsApp on click
- Mobile: resize to 375×812, header hamburger opens overlay, hero stacks, calculator inputs full-width, footer columns stack

- [ ] **Step 4: Visit other pages — verify they still use the OLD Header/Footer**

Open in playwright:
- `http://localhost:2998/admin` (login page) — should have OLD header
- `http://localhost:2998/checkout` — should have OLD header
- `http://localhost:2998/meus-pedidos` — should have OLD header

If any of those show the new HeaderLanding, that's a regression — investigate which layout is rendering it.

- [ ] **Step 5: Run all CI gates locally**

```bash
cd app && npm run typecheck && npm run build && npm test
```

Expected: all green.

- [ ] **Step 6: Stop dev server**

```bash
pkill -f "next dev -p 2998"
```

- [ ] **Step 7: Final cleanup commit (if anything was tweaked during verification)**

If verification surfaced visual issues that needed code changes:

```bash
git add -p && git commit -m "fix(landing): tweaks from manual verification"
```

If everything passed without changes, skip this step.

- [ ] **Step 8: Push to main (triggers CI gates)**

```bash
git push origin main
```

Wait for CI run to complete:

```bash
gh run watch
```

Expected: typecheck + build + test jobs all pass.

- [ ] **Step 9: Deploy to production**

```bash
cd app && vercel --prod
```

Wait for deploy to complete, then curl the production URL to confirm 200:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app-liart-one-77.vercel.app
```

Expected: `200`.

---

## Self-Review

### Spec coverage check

| Spec section | Implemented in |
|---|---|
| Composição da página | Task 10 |
| HeaderLanding (sticky transparent, nav, mobile) | Task 5 |
| HeroLanding (split layout, badge, headline, CTAs, features) | Task 6 |
| Calculator visual + algorithm + cart integration | Tasks 2, 3, 9 |
| FooterLanding (4 cols, contact, Instagram, payment) | Task 8 |
| WhatsappFab | Task 7 |
| Anchors `#home`, `#catalogo`, `#calculadora`, `#faq` | Tasks 5, 6, 9, 10 |
| Static assets (hero photo, instagram, payment) | Task 4 |
| Cart API extension | Task 3 |
| Other pages keep old Header/Footer | Verified Task 11 step 4 |

No gaps.

### Type consistency

- `EstiloConsumo` defined in `calculator-utils.ts` (Task 2), imported in `calculator.tsx` (Task 9) ✓
- `Combo` shape (`{ b50, b30, total, sobra }`) consistent between Tasks 2 and 9 ✓
- `addToCart(produto, quantidade?: number)` signature added in Task 3, used in Task 9 ✓
- `findChopp` returns `Produto | null` — consistent with consumer null-check in Task 9 ✓
- `Produto` type imported from `@/lib/types` everywhere ✓

### Placeholder scan

No "TBD" or "TODO" or "implement later". Each step has full code or full command. ✓

### Risks documented in spec carry over

- Hero photo URL is a specific Unsplash URL (Task 4 step 2) — user can swap if they want a different image
- Marca default fallback to first chopp ativo of the right volume — handled in `findChopp` (Task 9)
- Email contato hardcoded in FooterLanding — backlog noted in spec
- Instagram thumbnails are placeholders — backlog noted in spec
