# Brand Identity Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle all storefront components to match ALFA Chopp brand identity — dark backgrounds, bold yellow accents, high contrast energy.

**Architecture:** CSS-only restyling. No logic, state, or structural changes. Swap light backgrounds for dark, muted accents for bold yellow. Checkout form and order tracker stay light (option B).

**Tech Stack:** Tailwind CSS v4, Framer Motion (existing), Next.js App Router

---

### Task 1: globals.css — Dark body + yellow glow utility

**Files:**
- Modify: `app/app/globals.css`

**Step 1: Update globals.css**

Replace body styles and add glow utility:

```css
@import "tailwindcss";

@theme {
  --color-brand-yellow: #E8B912;
  --color-brand-amber: #D4A017;
  --color-brand-gold: #C49B0C;
  --color-brand-black: #1A1A1A;
  --color-brand-dark: #0D0D0D;
  --color-brand-white: #FAF9F6;
  --color-brand-cream: #F5F0E8;
  --color-brand-warm-gray: #8A8278;
  --color-brand-gray-light: #B5AFA6;
  --font-display: "Playfair Display", Georgia, serif;
  --font-body: "DM Sans", system-ui, sans-serif;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  background: var(--color-brand-dark);
  color: var(--color-brand-white);
}

::selection {
  background: var(--color-brand-yellow);
  color: var(--color-brand-black);
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-brand-dark);
}

::-webkit-scrollbar-thumb {
  background: var(--color-brand-yellow);
  border-radius: 4px;
}

.noise-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.04;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

.yellow-glow {
  box-shadow: 0 0 40px rgba(232, 185, 18, 0.15), 0 0 80px rgba(232, 185, 18, 0.05);
}
```

Key changes: body bg → brand-dark, color → brand-white. Added `--color-brand-gray-light` for readable body text on dark bg. Added `.yellow-glow` utility.

**Step 2: Verify build**

Run: `cd app && npx next build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add app/app/globals.css
git commit -m "style: flip body to dark theme with yellow glow utility"
```

---

### Task 2: Header — Bolder yellow CTA

**Files:**
- Modify: `app/components/header.tsx`

**Step 1: Update header styles**

The header is already dark. Make the CTA button bolder and add subtle yellow border accent at bottom.

Changes:
- `border-b border-brand-yellow/10` → `border-b border-brand-yellow/20`
- CTA button: add `shadow-md shadow-brand-yellow/10` for subtle glow

**Step 2: Commit**

```bash
git add app/components/header.tsx
git commit -m "style: bolder header CTA with yellow accent"
```

---

### Task 3: Hero — Amplify yellow energy

**Files:**
- Modify: `app/components/hero.tsx`

**Step 1: Update hero styles**

Changes:
- Increase yellow gradient: `from-brand-yellow/5` → `from-brand-yellow/10`
- Add a second radial glow: `<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-yellow/5 rounded-full blur-3xl" />`
- "evento" span: add `bg-brand-yellow/10 px-3` for highlighted text effect
- WhatsApp button border: `border-brand-yellow/40` → `border-brand-yellow/60`
- Primary CTA "Ver Catalogo": keep yellow bg, it's already correct

**Step 2: Commit**

```bash
git add app/components/hero.tsx
git commit -m "style: amplify hero yellow energy with glow and highlights"
```

---

### Task 4: Product Card — Dark card with yellow price

**Files:**
- Modify: `app/components/product-card.tsx`

**Step 1: Update product card styles**

Changes:
- Card container: `bg-white rounded-lg ... border border-gray-100/80 ... shadow-sm hover:shadow-lg` → `bg-brand-black rounded-lg ... border border-white/5 ... shadow-sm hover:shadow-lg hover:shadow-brand-yellow/5`
- No-image placeholder: `bg-gradient-to-br from-brand-yellow/15 to-brand-cream` → `bg-gradient-to-br from-brand-yellow/10 to-brand-dark`
- Volume badge: `bg-brand-yellow/15 text-brand-gold` → `bg-brand-yellow/20 text-brand-yellow`
- Brand name h3: `text-brand-black` → `text-white`
- Description: `text-brand-warm-gray` stays (readable on dark)
- Price: `text-brand-black` → `text-brand-yellow` (bold yellow prices like their posts)
- "no pix/dinheiro": `text-brand-warm-gray` stays
- "Adicionar" button: `bg-brand-dark text-white ... hover:bg-brand-black` → `bg-brand-yellow text-brand-black ... hover:bg-brand-amber` (yellow CTA like brand posts)

**Step 2: Commit**

```bash
git add app/components/product-card.tsx
git commit -m "style: dark product cards with yellow prices and CTAs"
```

---

### Task 5: Catalog — Dark background

**Files:**
- Modify: `app/components/catalog.tsx`

**Step 1: Update catalog styles**

Changes:
- Section: `bg-brand-cream/50` → `bg-brand-dark`
- Title: `text-brand-black` → `text-white`
- Subtitle: `text-brand-warm-gray` → `text-brand-gray-light`
- Active filter button: `bg-brand-dark text-white` → `bg-brand-yellow text-brand-black`
- Inactive filter button: `bg-white text-brand-warm-gray border border-gray-200 hover:border-brand-dark/30` → `bg-brand-black text-brand-warm-gray border border-white/10 hover:border-brand-yellow/30`

**Step 2: Commit**

```bash
git add app/components/catalog.tsx
git commit -m "style: dark catalog section with yellow filter buttons"
```

---

### Task 6: Features — Dark background with bold yellow icons

**Files:**
- Modify: `app/components/features.tsx`

**Step 1: Update features styles**

Changes:
- Section: `bg-white` → `bg-brand-black`
- Title: `text-brand-black` → `text-white`
- Subtitle: `text-brand-warm-gray` → `text-brand-gray-light`
- Icon circle: `bg-brand-yellow/15 ... text-brand-amber` → `bg-brand-yellow/20 ... text-brand-yellow`
- Feature title h3: `text-brand-black` → `text-white`
- Feature description: `text-brand-warm-gray` → `text-brand-gray-light`

**Step 2: Commit**

```bash
git add app/components/features.tsx
git commit -m "style: dark features section with bold yellow icons"
```

---

### Task 7: FAQ — Dark background with yellow accents

**Files:**
- Modify: `app/components/faq.tsx`

**Step 1: Update FAQ styles**

Changes:
- Section: `bg-brand-cream/30` → `bg-brand-dark`
- Title: `text-brand-black` → `text-white`
- Subtitle: `text-brand-warm-gray` → `text-brand-gray-light`
- Card container: `bg-white rounded-lg p-6 shadow-sm border border-gray-100/80` → `bg-brand-black rounded-lg p-6 shadow-sm border border-white/5`
- Question borders: `border-gray-100` → `border-white/5`
- Question text: `text-brand-black` → `text-white`
- Question hover: `group-hover:text-brand-amber` stays
- + icon: `text-brand-warm-gray` → `text-brand-yellow`
- Answer text: `text-brand-warm-gray` → `text-brand-gray-light`

**Step 2: Commit**

```bash
git add app/components/faq.tsx
git commit -m "style: dark FAQ with yellow toggle accents"
```

---

### Task 8: Footer — Yellow top accent

**Files:**
- Modify: `app/components/footer.tsx`

**Step 1: Update footer styles**

Changes:
- Add yellow top border: add `border-t border-brand-yellow/20` to footer element
- Copyright divider: `border-white/5` → `border-brand-yellow/10`

**Step 2: Commit**

```bash
git add app/components/footer.tsx
git commit -m "style: footer yellow top accent border"
```

---

### Task 9: Cart sidebar — Dark with yellow checkout

**Files:**
- Modify: `app/components/cart.tsx`

**Step 1: Update cart styles**

Changes:
- Cart panel: `bg-brand-white` → `bg-brand-dark`
- Header border: `border-gray-100` → `border-white/10`
- Title: `text-brand-black` → `text-white`
- Close button: `text-brand-warm-gray hover:text-brand-black` → `text-brand-warm-gray hover:text-white`
- Empty text: stays `text-brand-warm-gray`
- Footer border: `border-gray-100` → `border-white/10`
- Total label: `text-brand-warm-gray` stays
- Total price: `text-brand-black` → `text-brand-yellow`
- Info text: `text-brand-warm-gray` stays
- Checkout button: `bg-brand-dark text-white ... hover:bg-brand-black` → `bg-brand-yellow text-brand-black ... hover:bg-brand-amber`

**Step 2: Commit**

```bash
git add app/components/cart.tsx
git commit -m "style: dark cart sidebar with yellow checkout button"
```

---

### Task 10: Cart item — Dark with yellow prices

**Files:**
- Modify: `app/components/cart-item.tsx`

**Step 1: Update cart item styles**

Changes:
- Row border: `border-gray-100` → `border-white/10`
- Product name: `text-brand-black` → `text-white`
- Volume text: `text-brand-warm-gray` stays
- +/- buttons: `border border-gray-200 ... text-brand-warm-gray hover:border-brand-dark/30` → `border border-white/20 ... text-brand-warm-gray hover:border-brand-yellow/40`
- Quantity: `text-brand-black` → `text-white`
- Price: `text-brand-black` → `text-brand-yellow`
- Remove button: `text-brand-warm-gray/40 hover:text-red-500` stays

**Step 2: Commit**

```bash
git add app/components/cart-item.tsx
git commit -m "style: dark cart items with yellow prices"
```

---

### Task 11: Storefront FAB — Yellow floating button

**Files:**
- Modify: `app/components/storefront.tsx`

**Step 1: Update floating cart button**

Changes:
- FAB button: `bg-brand-dark text-white` → `bg-brand-yellow text-brand-black`

**Step 2: Commit**

```bash
git add app/components/storefront.tsx
git commit -m "style: yellow floating cart button"
```

---

### Task 12: Visual QA + final commit

**Step 1: Run production build**

Run: `cd app && npx next build`
Expected: Build succeeds with no errors

**Step 2: Visual QA in browser**

Start dev server and check:
- [ ] Homepage: dark bg, yellow accents, brand energy
- [ ] Catalog: dark cards, yellow prices, yellow filter buttons
- [ ] Cart: dark sidebar, yellow total, yellow checkout
- [ ] Features: dark bg, yellow icons
- [ ] FAQ: dark bg, yellow toggles
- [ ] Footer: yellow top border
- [ ] Mobile responsive: check at 390px width
- [ ] Checkout form: still light (not affected)

**Step 3: Fix any issues found during QA**

**Step 4: Final commit if needed**
