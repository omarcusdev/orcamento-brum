# Architecture Research

**Domain:** Commercial proposal / budget single-page static site
**Researched:** 2026-02-27
**Confidence:** HIGH (section flow and conversion patterns verified across multiple authoritative sources; Vercel config verified against official docs)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  index   │  │  style   │  │  main    │  │  assets  │   │
│  │  .html   │  │  .css    │  │  .js     │  │  /img    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │             │              │         │
│       └──────────────┴─────────────┴──────────────┘         │
│                        Single Page DOM                       │
├─────────────────────────────────────────────────────────────┤
│                     Vercel Edge CDN                          │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Global CDN distribution (static assets cached)    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `index.html` | Page skeleton, section markup, semantic structure | Single file, all sections as `<section>` elements with IDs |
| `style.css` | Visual system — typography, spacing, color palette, responsiveness | One stylesheet; CSS custom properties for tokens |
| `main.js` | Minimal interactivity — smooth scroll, WhatsApp CTA link, optional scroll-spy | Vanilla JS, no framework |
| `assets/` | Fonts, profile photo, company/tech logos | Locally hosted; no CDN dependencies at runtime |
| `vercel.json` | Deployment config — cleanUrls, cache-control headers | Minimal config; root serves index.html |

## Recommended Project Structure

```
orcamento-brum/
├── index.html              # Single page — all sections inline
├── style.css               # Full stylesheet with custom properties
├── main.js                 # Minimal JS — scroll behavior, CTA
├── assets/
│   ├── fonts/              # Self-hosted variable font (Inter or similar)
│   └── img/
│       ├── avatar.jpg      # Marcus profile photo
│       └── tech-logos/     # Stack icon SVGs (optional)
├── vercel.json             # Static deployment config
└── .planning/              # Planning artifacts (not deployed)
    └── research/
        └── ARCHITECTURE.md
```

### Structure Rationale

- **Single `index.html`**: A proposal is a linear document — no routing needed. One file eliminates build steps and reduces failure surface.
- **Single `style.css`**: No preprocessor needed at this scale. CSS custom properties replace variables. One file = one HTTP request.
- **Minimal `main.js`**: The only interactivity required is the WhatsApp CTA link and optional smooth scroll. Zero dependencies.
- **`assets/` self-hosted**: Avoids third-party CDN dependencies that could fail or add load time when client opens on mobile over WhatsApp.
- **`vercel.json` minimal**: Only needed for cache-control headers. No build command required — Vercel serves root directory directly.

## Section Flow

The optimal order maps to the client's psychological decision journey: **awareness → interest → understanding → trust → commitment**. This mirrors the classic AIDA funnel (Attention → Interest → Desire → Action) adapted for a high-ticket B2B service proposal.

### Optimal Section Order (Conversion Rationale)

| # | Section | Conversion Rationale |
|---|---------|----------------------|
| 1 | **Hero** — Headline + subheadline + primary CTA | Above-the-fold anchor. Answers "what is this and why does it matter?" within 5 seconds. Single CTA establishes the one action the page wants. |
| 2 | **Problem Statement** — Client's current situation | Loss-aversion framing before solution. Client recognizes their pain; they feel understood. Primes them to value the solution. |
| 3 | **Proposed Solution** — High-level approach + stack | Pivots from pain to resolution. Introduces Marcus's methodology (code + AI) as the differentiator before getting into specifics. |
| 4 | **Scope — 6 MVP Modules** | Detail zone. Client now motivated to read deeply. Lists all 6 modules with deliverable clarity. Reduces scope ambiguity = reduces risk perception. |
| 5 | **Timeline & Phases** | Answers "when do I get this?" Concrete 45-day breakdown with phases makes the abstract real. Builds confidence in execution capability. |
| 6 | **Investment** — R$ 10.000 fechado | Placed after full scope is understood. Client sees value before seeing cost. Stating "valor fechado" removes negotiation ambiguity. |
| 7 | **Social Proof / Differentials** — Experience + stack | Placed near CTA per CRO research showing trust signals directly above CTA increase conversions significantly. Validates the ask. |
| 8 | **About / Credentials** — Marcus Gonçalves | Personal credibility after establishing value. Brief — supports section 7 rather than leading with ego. |
| 9 | **CTA — Final conversion** | Bottom CTA for readers who consumed everything. WhatsApp link, pre-filled message, urgent framing ("Vamos conversar"). |
| 10 | **Footer** — Contact, legal notice | Minimal. Name, date, contact info. |

### Section Flow Diagram

```
[Hero: "Proposta para o MVP de Delivery de Chopp"]
          ↓  (scroll / curiosity)
[Problem: "Você precisa de um MVP completo e funcional em 45 dias"]
          ↓  (empathy established)
[Solution: "Stack código + IA — controle total, entrega no prazo"]
          ↓  (credibility starts building)
[Scope: 6 Módulos detalhados]
          ↓  (value is concrete)
[Timeline: Fases de entrega — 45 dias]
          ↓  (execution is believable)
[Investment: R$ 10.000 — valor fechado]
          ↓  (cost anchored after value)
[Differentials + Social Proof]
          ↓  (trust peak — right before final ask)
[About Marcus — brevíssimo]
          ↓
[CTA: "Vamos fechar? Fale pelo WhatsApp →"]
          ↓
[Footer]
```

## Architectural Patterns

### Pattern 1: Section-as-Component via BEM-like CSS Classes

**What:** Each `<section>` has a single root class (e.g., `.section-scope`, `.section-timeline`). All child elements scoped under it.
**When to use:** Always — keeps styles predictable and prevents bleed between sections.
**Trade-offs:** Slightly verbose class names in exchange for zero specificity conflicts.

**Example:**
```html
<section class="section-scope" id="scope">
  <div class="section-scope__header">
    <h2 class="section-scope__title">Escopo do MVP</h2>
  </div>
  <ul class="section-scope__modules">
    <li class="section-scope__module">...</li>
  </ul>
</section>
```

### Pattern 2: CSS Custom Properties as Design Tokens

**What:** Define all colors, typography scales, and spacing values as `--variables` on `:root`. No magic numbers inline.
**When to use:** Always for a page that may need visual tweaks later (client feedback, adjustments).
**Trade-offs:** None at this scale — only benefit.

**Example:**
```css
:root {
  --color-primary: #1a1a2e;
  --color-accent: #f59e0b;
  --color-surface: #ffffff;
  --color-muted: #64748b;
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --space-section: 80px;
  --space-section-mobile: 48px;
  --radius-card: 8px;
}
```

### Pattern 3: Mobile-First Media Queries

**What:** Base styles target mobile (375px). `@media (min-width: 768px)` progressively enhances for desktop.
**When to use:** Always — client will open the WhatsApp link on mobile. Mobile experience is primary.
**Trade-offs:** Slightly harder to mentally model for desktop-first developers, but critical for this use case.

**Example:**
```css
.section-scope__modules {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .section-scope__modules {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}
```

### Pattern 4: Inline Sections, No JS Routing

**What:** All 10 sections exist as static `<section>` tags in `index.html`. No dynamic rendering, no SPA routing.
**When to use:** Always for a single-page proposal site with no dynamic data.
**Trade-offs:** Slightly long HTML file (~400-600 lines). Acceptable — no build complexity, instant load.

## Data Flow

### Request Flow (Static)

```
Client opens WhatsApp link
    ↓
Browser → Vercel Edge CDN (nearest PoP)
    ↓
CDN serves index.html (cached, ~1ms TTFB)
    ↓
Browser parses HTML, requests style.css + main.js (parallel)
    ↓
Page renders — no server round-trips after initial load
    ↓
Client clicks WhatsApp CTA
    ↓
Browser opens wa.me link with pre-filled message (no backend)
```

### No State Management Required

This is a read-only document. There is no application state. `main.js` handles:
- Smooth scroll to anchor on nav clicks (if nav present)
- WhatsApp CTA link construction (pre-filled message via URL params)
- Optional: IntersectionObserver for section fade-in on scroll

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 proposal (current) | Single HTML file, no build tools, zero dependencies |
| 5-10 proposals (future) | Template the HTML with a simple Node script to generate from JSON config per client |
| 50+ proposals (future) | Consider a static site generator (Astro or Eleventy) with a shared template and per-client data files |

### Scaling Priorities

1. **First trigger:** When second client proposal is needed — extract data (name, scope, value, deadline) into a JSON config and generate HTML from a template. Still no framework.
2. **Second trigger:** When design iteration across many proposals is painful — introduce Tailwind or a CSS framework; still Vercel static hosting.

## Vercel Deployment Configuration

### Minimal `vercel.json` for a Plain Static HTML Site

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, stale-while-revalidate=86400"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Rationale:**
- `cleanUrls: true` — Serves `index.html` at `/` without the `.html` suffix
- Short cache on HTML (1h + stale-while-revalidate) — Allows updates to propagate when proposal text is corrected
- Long cache on `assets/` (1 year immutable) — Fonts and images never change; aggressive caching for mobile load speed

### Deploy Pipeline

```
1. git push to main (GitHub)
        ↓
2. Vercel auto-detects push via webhook
        ↓
3. No build command — Vercel serves from root directory
        ↓
4. Files distributed to global Edge CDN
        ↓
5. Preview URL generated for each push
        ↓
6. Custom domain assigned (optional: orcamento-brum.vercel.app or custom domain)
```

**Key config in Vercel dashboard (no CLI needed):**
- Framework Preset: `Other`
- Build Command: *(leave empty)*
- Output Directory: `.` (root)
- Install Command: *(leave empty)*

## Anti-Patterns

### Anti-Pattern 1: Putting Price Before Value

**What people do:** Place the investment section early (second or third) to "get it out of the way."
**Why it's wrong:** Client judges price against unknown value. Anchors on cost before understanding scope. Kills deal.
**Do this instead:** Full scope → timeline → investment. Client sees R$ 10.000 after understanding 6 modules, 45 days, and professional execution.

### Anti-Pattern 2: Starting with "About Me"

**What people do:** Open the proposal with a lengthy personal bio and credentials.
**Why it's wrong:** Client doesn't care about Marcus yet — they care about their problem. Opening with bio signals the proposal is self-centered.
**Do this instead:** Problem → solution → scope → (brief) about. Earn the right to talk about yourself by demonstrating you understand the client first.

### Anti-Pattern 3: Multiple Competing CTAs

**What people do:** Add WhatsApp button, email link, phone number, and a contact form throughout the page.
**Why it's wrong:** Choice overload reduces conversion. CRO research shows reducing to a single CTA increased conversions by 266%.
**Do this instead:** One CTA mechanism (WhatsApp link with pre-filled message). Repeat it at top (hero) and bottom (final section), same action both times.

### Anti-Pattern 4: Heavy JS Framework for a Static Proposal

**What people do:** Bootstrap a React or Vue project "just in case."
**Why it's wrong:** Framework overhead adds JS bundle size, build complexity, and potential for hydration issues. A proposal page has no dynamic state.
**Do this instead:** Vanilla HTML + CSS + minimal JS. Ships faster, loads faster, zero framework risk.

### Anti-Pattern 5: Desktop-Only Design

**What people do:** Design at 1440px, add responsive CSS as an afterthought.
**Why it's wrong:** Proposal link sent via WhatsApp — client opens it on mobile. If the first experience is broken, trust is damaged immediately.
**Do this instead:** Design at 375px first. Test on real mobile before sharing the link.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| WhatsApp CTA | `wa.me/{phone}?text={encoded_message}` URL — no API, no backend | Works on all devices; pre-fill message with client name for personalization |
| Vercel | GitHub push → auto-deploy | Connect once via Vercel dashboard; no CLI or CI configuration needed |
| Google Fonts (optional) | `<link>` preconnect + font stylesheet | Risk: third-party dependency; prefer self-hosting Inter via `assets/fonts/` for reliability on mobile networks |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| HTML ↔ CSS | Class names (BEM-like) | No inline styles; all visual control in style.css |
| HTML ↔ JS | Data attributes (`data-cta`, `data-section`) + element IDs | No logic in HTML; JS queries by attribute |
| CSS ↔ Design System | CSS custom properties on `:root` | Single source of truth for color, spacing, and type |

## Sources

- Branded Agency — High-Converting Landing Page 14 Elements (2026): https://brandedagency.com/blog/the-anatomy-of-a-high-converting-landing-page-14-powerful-elements-you-must-use-in-2026
- Lovable — Landing Page Best Practices (2026): https://lovable.dev/guides/landing-page-best-practices-convert
- Instapage — B2B Landing Page Lessons 2025: https://instapage.com/blog/b2b-landing-page-best-practices
- LandingPageFlow — CTA Placement Strategies 2026: https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages
- Stefan Kudla — Deploy Static HTML Site to Vercel: https://stefankudla.com/posts/how-to-deploy-a-static-html-css-and-javascript-website-to-vercel
- Vercel Official Docs — Static Configuration with vercel.json: https://vercel.com/docs/project-configuration/vercel-json
- Vercel Official Docs — Cache-Control Headers: https://vercel.com/docs/headers/cache-control-headers
- HubSpot — How to Write a Business Proposal: https://blog.hubspot.com/sales/how-to-write-business-proposal
- Better Proposals — Freelance Web Design Proposal Template: https://betterproposals.io/proposal-templates/freelance-web-design-proposal-template
- CXL — Above the Fold Conversion Research: https://cxl.com/blog/above-the-fold/

---
*Architecture research for: Commercial proposal HTML static page — Delivery de Chopp MVP*
*Researched: 2026-02-27*
