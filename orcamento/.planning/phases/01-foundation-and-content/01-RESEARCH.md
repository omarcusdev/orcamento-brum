# Phase 1: Foundation and Content - Research

**Researched:** 2026-02-27
**Domain:** Static HTML proposal page — project setup, HTML structure, copywriting, Tailwind CSS v4 mobile-first styling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Copywriting e Tom**
- Tom profissional direto: "Você terá um sistema completo..." — confiança sem arrogância, tuteia o cliente
- Hero focado no cliente: "Seu delivery de chopp, automatizado" — o cliente se vê no centro
- Linguagem técnica: usar termos como "API do WhatsApp", "webhook", "integração" — o cliente pediu expertise técnica
- Headers orientados a resultado: "O que você terá em 45 dias" ao invés de "Escopo do trabalho"

**Seção Sobre / Social Proof**
- Posicionamento como dev full-stack com 7 anos de experiência (desde 2019)
- Dados do LinkedIn para bio:
  - Fundador do oZapGPT — solução que integra IA ao WhatsApp para automatizar atendimento (time de 4 pessoas)
  - Founding Engineer na Opdv por 4 anos — sistema de gestão para restaurantes com cardápio digital, chatbot WhatsApp, integrações iFood/Rappi/Uber Eats. Opdv adquirida pelo iFood em 2025
  - Co-Founder do GDG Porto Alegre — organizou eventos e palestrou por 2 anos
  - 22k seguidores no Instagram (@omarcusdev) criando conteúdo tech
- Social proof matador: oZapGPT (automação WhatsApp) + Opdv (delivery/restaurantes adquirida pelo iFood) — encaixa perfeitamente com o projeto do cliente
- Projeto zap-gpt-free no GitHub com 594 stars — demonstra expertise real em WhatsApp

**Seção de Escopo**
- Resumo + bullets: título do módulo + 3-5 bullets com entregas concretas
- Lista vertical: um módulo abaixo do outro, sequencial
- Nomes técnicos: "Landing Page", "Formulário de Pedidos", "Automação WhatsApp", etc.
- Sem seção explícita de exclusões — foco no que está incluso
- Mobile-first é prioridade #1 — tudo deve ser pensado primeiro para 375px

**Condições Comerciais**
- Valor total: R$ 12.000 (3x R$ 4.000)
- Parcelas vinculadas a marcos de entrega:
  - 1ª parcela: R$ 4.000 na aprovação da proposta
  - 2ª parcela: R$ 4.000 na entrega do MVP base (~dia 20)
  - 3ª parcela: R$ 4.000 na entrega final (dia 45)
- Formas de pagamento: Pix e cartão
- Sem menção a garantias ou política de revisões
- Prazo: 45 dias

### Claude's Discretion
- Número de WhatsApp e email de contato (usar dados públicos do perfil ou placeholder)
- Mensagem pré-preenchida do CTA WhatsApp
- Escolha exata de ícones para os módulos
- Imagem OG para preview no WhatsApp
- Ordem exata das seções (seguir pesquisa de arquitetura: Hero → Problema → Escopo → Timeline → Valor → Pagamento → Sobre → CTA)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-01 | Hero/cover com nome "Marcus Gonçalves", título do projeto, data e tagline profissional | Architecture pattern: hero is section #1; headline must reference chopp/delivery by name (Pitfall 7) |
| CONT-02 | Seção de entendimento do problema espelhando o brief do cliente (delivery de chopp, eventos, automação) | Architecture pattern: Problem is section #2; must lead with client context, not credentials (Pitfall 7) |
| CONT-03 | Escopo detalhado com os 6 módulos do MVP (landing page, formulário, WhatsApp, pagamentos, painel, escalabilidade) | Architecture pattern: Scope is section #4; each module with title + 3-5 bullets of concrete deliverables (user decision) |
| CONT-04 | Timeline visual de 45 dias dividida em fases com marcos de entrega | Architecture pattern: Timeline is section #5; anchored to relative weeks (Pitfall UX: vague timeline) |
| CONT-05 | Valor fechado de R$ 12.000 com framing de valor após demonstrar escopo e benefícios | Architecture pattern: Investment is section #6; must follow scope and timeline — price never in first 3 sections (Pitfall 3). Note: REQUIREMENTS.md says R$ 10.000, but CONTEXT.md (user decision) overrides to R$ 12.000 |
| CONT-06 | Condições de pagamento (3x R$ 4.000 vinculado a marcos; Pix e cartão) | Content from locked decisions; placed adjacent to investment section |
| CONT-07 | Seção "Sobre" com apresentação profissional de Marcus Gonçalves e experiência relevante | Architecture pattern: About is section #8 after trust signals; bio from locked decisions (oZapGPT, Opdv, GDG, @omarcusdev) |
| CONT-08 | Informações de contato (WhatsApp + email) | Footer section or CTA section; WhatsApp number in international format wa.me/55XXXXXXXXXXX (Pitfall integration gotcha) |
| CONT-09 | Headers orientados a resultado ("O que você terá em 45 dias" ao invés de "Escopo") | Locked decision on copywriting tone — applies to all section headings across the page |
| CONT-10 | Seção de rationale tecnológico explicando por que código > no-code para o caso do cliente | New section (not in ARCHITECTURE.md canonical order); insert between Solution and Scope or as subsection of Solution; plain-language outcomes first, tech stack secondary (Pitfall UX: jargon) |
| CONT-11 | Referência de projeto passado relevante (social proof) — sinal de confiança | Locked decision: oZapGPT + Opdv + zap-gpt-free (594 stars) as differentiators; place in Sobre/Differentials section (section #7) |
| CONV-01 | CTA primário para WhatsApp visível no hero e no final da página | Single CTA mechanism only; wa.me link with URL-encoded pre-filled message; repeat at top + bottom (Pitfall 2 and Anti-Pattern 3) |
| CONV-02 | Página mobile-first responsiva, testada a partir de 375px | CSS architecture constraint: mobile-first from line 1; body font min 16px; CTA button min 48px tap height; no horizontal scroll (Pitfall 5) |
| CONV-03 | Tipografia profissional (Inter ou equivalente) com espaçamento adequado | Stack decision: Inter variable font via Google Fonts CDN; font-display: swap; use only weights 400 and 600; 64px+ between sections |
| TECH-01 | Open Graph tags corretas para preview profissional no WhatsApp | Static in <head> before any JS; og:title, og:description, og:image (absolute HTTPS, <300KB, 1200x630), og:url, og:type; verify by pasting Vercel URL into actual WhatsApp chat (Pitfall 1) |
| TECH-02 | Página deployada na Vercel com URL funcional | Stack decision: GitHub push → Vercel auto-deploy; framework preset "Other"; no build command; root directory; minimal vercel.json with cleanUrls and cache headers |
| TECH-04 | Página usa Tailwind CSS v4 com build via Tailwind CLI | Stack decision: tailwindcss@4.2.1 + @tailwindcss/cli@4.2.1; input.css with @import "tailwindcss"; CLI watch during dev, --minify for production |
</phase_requirements>

---

## Summary

Phase 1 delivers a shippable commercial proposal page — every requirement in this phase is a content and CSS architecture decision, not an interactivity problem. The stack is intentionally minimal: HTML5 + Tailwind CSS v4 via CLI + Inter font. No JavaScript is needed in Phase 1 (Alpine.js and animations are Phase 2). The entire phase can be executed in four sequential plans: project setup, HTML structure, copywriting, and CSS styling.

The most critical constraint for this phase is mobile-first from the first line of code. The proposal link is sent via WhatsApp and opened on a phone — if the first impression on mobile is broken, no amount of good content recovers trust. Every CSS rule must be written for 375px first with `min-width` media queries for wider viewports. This constraint cannot be retrofitted; it must be established before any section is styled.

The second most critical constraint is content architecture: Open Graph tags must be in static HTML (not JS-injected) before the first Vercel deploy, and the investment section (R$ 12.000) must appear only after the client has seen the full scope of 6 modules and the 45-day timeline. Section order is a conversion decision backed by the AIDA funnel — it is not a design preference.

**Primary recommendation:** Write all content in plan 01-03 before applying final CSS in 01-04, so section copy and visual hierarchy decisions are not made independently.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTML5 | Native | Page structure and semantic markup | Single index.html eliminates routing, build steps, and failure surface — correct for a read-only document |
| Tailwind CSS | 4.2.1 | Utility-first styling, responsive layout, design system | v4 (Jan 2025): CSS-first config, 3.5x faster builds, no content path config — current standard; v3 is legacy |
| @tailwindcss/cli | 4.2.1 | Compiles and purges Tailwind CSS from HTML classes | Separate package from core in v4; produces minified, purged CSS for production with no Vite/webpack |
| Inter (variable font) | Latest | Professional typographic baseline | Most-accessed Google Font; one variable file covers all weights; optimized for screen readability |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Heroicons | 2.2.0 | Section icons, checkmarks, contact icons | Made by Tailwind Labs; copy inline SVG — zero runtime cost, zero extra requests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind CSS v4 | Bootstrap 5 | Bootstrap opinionated components fight custom corporate look; Tailwind utility approach provides full control |
| Tailwind CLI | Vite + Tailwind | Vite adds HMR and multi-module support — overkill for a single HTML file with no JS modules |
| Tailwind CLI | Tailwind Play CDN (`@tailwindcss/browser`) | Play CDN is ~112KB runtime-parsed — unacceptable for production; official docs warn against it |
| Inter via Google Fonts CDN | Self-hosted Inter | Self-hosting avoids DNS lookup and GDPR risk; for this single-use proposal with no GDPR obligations, CDN is acceptable — decide based on PageSpeed profiling |

**Installation:**
```bash
npm init -y
npm install -D tailwindcss @tailwindcss/cli
```

Create `src/input.css`:
```css
@import "tailwindcss";
```

Dev watch:
```bash
npx @tailwindcss/cli -i src/input.css -o dist/output.css --watch
```

Production build:
```bash
npx @tailwindcss/cli -i src/input.css -o dist/output.css --minify
```

No npm package needed for Inter or Heroicons — both loaded via CDN link or inline SVG in HTML.

---

## Architecture Patterns

### Recommended Project Structure

```
orcamento-brum/
├── index.html              # All sections inline — single page document
├── src/
│   └── input.css           # Tailwind entry point (@import "tailwindcss")
├── dist/
│   └── output.css          # Compiled by Tailwind CLI (gitignored or committed)
├── assets/
│   └── img/
│       ├── avatar.webp     # Marcus profile photo, max 100KB
│       └── og-image.jpg    # Open Graph image, 1200x630px, max 300KB
├── vercel.json             # Cache headers and cleanUrls
└── package.json            # Tailwind CLI dev dependency
```

### Pattern 1: Section-as-Component via Tailwind Scoping

**What:** Each `<section>` has a unique `id` for anchor navigation and a semantic class name. All child elements are styled with Tailwind utilities scoped to that section. No shared utility classes that bleed across sections.
**When to use:** All sections — keeps styles predictable, prevents visual drift between sections.

```html
<section id="scope" class="py-16 md:py-24 bg-slate-50">
  <div class="max-w-2xl mx-auto px-6">
    <h2 class="text-2xl font-semibold text-slate-900 mb-8">O que você terá em 45 dias</h2>
    <ul class="space-y-6">
      <!-- modules -->
    </ul>
  </div>
</section>
```

### Pattern 2: CSS Custom Properties as Design Tokens

**What:** Define brand colors, spacing scale, and typography as CSS custom properties on `:root` in input.css using Tailwind v4's `@theme` directive. No magic numbers inline. Use `@theme` in Tailwind v4 (replaces `tailwind.config.js` from v3).
**When to use:** Always — single source of truth for the color palette and spacing, enabling consistent visual tweaks without hunting through HTML.

```css
/* src/input.css */
@import "tailwindcss";

@theme {
  --color-brand-primary: #1e293b;
  --color-brand-accent: #f59e0b;
  --color-brand-surface: #f8fafc;
  --font-sans: 'Inter', sans-serif;
}
```

### Pattern 3: Mobile-First Media Queries

**What:** All base Tailwind classes target mobile (375px). Responsive prefixes (`md:`, `lg:`) progressively enhance for wider viewports. Never write a desktop style and then override for mobile.
**When to use:** Every CSS rule — this is the primary constraint for Phase 1.

```html
<!-- Mobile: full width stack; md+: two-column grid -->
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
```

### Pattern 4: Static Open Graph in `<head>`

**What:** All OG meta tags written as static HTML in `<head>` — not injected by JavaScript. WhatsApp's crawler does not execute JS, so dynamically inserted tags produce no preview.
**When to use:** Always; must be in place before the first Vercel deploy.

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial — MVP Delivery de Chopp | Marcus Gonçalves</title>
  <!-- Open Graph -->
  <meta property="og:title" content="Proposta Comercial — MVP Delivery de Chopp">
  <meta property="og:description" content="Sistema completo de pedidos, automação WhatsApp e painel de gestão. 45 dias. R$ 12.000.">
  <meta property="og:image" content="https://orcamento-brum.vercel.app/assets/img/og-image.jpg">
  <meta property="og:url" content="https://orcamento-brum.vercel.app">
  <meta property="og:type" content="website">
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <!-- Styles -->
  <link rel="stylesheet" href="dist/output.css">
</head>
```

### Pattern 5: WhatsApp CTA Link

**What:** A single `<a>` tag with the wa.me deep link. Phone number in full international format (country code 55 + DDD + number). Pre-filled message URL-encoded. Repeated exactly twice: in hero and at bottom of page.
**When to use:** Both CTA placements — no other contact mechanism competes on the same screen.

```html
<a href="https://wa.me/5551XXXXXXXXX?text=Ol%C3%A1%20Marcus%2C%20quero%20aprovar%20a%20proposta"
   class="inline-flex items-center justify-center gap-2 bg-green-500 text-white font-semibold px-8 py-4 rounded-full text-lg min-h-[48px] hover:bg-green-600 transition-colors"
   target="_blank" rel="noopener noreferrer">
  Aprovar proposta pelo WhatsApp
</a>
```

### Pattern 6: Vercel Static Deployment Config

**What:** Minimal `vercel.json` with `cleanUrls` and cache-control headers. No build command — Vercel serves root directory directly. Tailwind CLI output (`dist/output.css`) must be committed to git since Vercel won't run the build.
**When to use:** Created in plan 01-01 before first deploy.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Vercel dashboard settings (one-time, no CLI):**
- Framework Preset: `Other`
- Build Command: *(leave empty)*
- Output Directory: `.` (root)
- Install Command: *(leave empty)*

### Pattern 7: Section Order (Conversion Funnel)

**What:** Sections ordered to mirror the client's psychological decision journey — value established before price is revealed.
**When to use:** This order is fixed; do not reorder for aesthetic reasons.

| # | Section ID | Heading | Conversion Purpose |
|---|-----------|---------|-------------------|
| 1 | `#hero` | "Seu delivery de chopp, automatizado" | Above-fold anchor; client sees themselves in the headline immediately |
| 2 | `#problema` | "O que está travando seu crescimento hoje" | Loss-aversion framing; client recognizes their pain |
| 3 | `#solucao` | "A abordagem: código próprio, controle total" | Pivots from pain to resolution; introduces rationale técnico (CONT-10) |
| 4 | `#escopo` | "O que você terá em 45 dias" | Detail zone; 6 modules with 3-5 bullets each |
| 5 | `#timeline` | "Como chegamos lá: semana a semana" | 45-day breakdown by week; makes execution concrete |
| 6 | `#investimento` | "Investimento" | R$ 12.000 revealed after full scope; "valor fechado" framing |
| 7 | `#pagamento` | "Condições de pagamento" | 3x R$ 4.000 by milestone; Pix and card |
| 8 | `#diferenciais` | "Por que Marcus Gonçalves" | oZapGPT + Opdv social proof; zap-gpt-free 594 stars |
| 9 | `#sobre` | "Quem está por trás disso" | Brief bio; LinkedIn highlights; @omarcusdev |
| 10 | `#cta` | "Vamos fechar?" | Final conversion; WhatsApp CTA repeated; explicit next step |
| 11 | `footer` | — | Name, date, minimal contact |

### Anti-Patterns to Avoid

- **Price before scope:** Investment section in positions 1-5 anchors client on cost before value is established. Price must follow scope + timeline.
- **Opening with "Sou Marcus":** First visible sentence must reference chopp, delivery, or the client's specific context — not the developer's credentials.
- **Multiple competing CTAs:** Only one CTA mechanism (WhatsApp link). No email, phone form, or secondary button on the same screen.
- **Desktop-first CSS:** Writing at 1440px and adding `@media (max-width)` overrides. Mobile-first means `@media (min-width)` only.
- **Tailwind Play CDN in production:** Play CDN is for prototyping. Production requires Tailwind CLI with minified output.
- **OG image via JS:** WhatsApp crawler ignores JavaScript. All OG meta tags must be static HTML.
- **wa.me link without country code:** `wa.me/51XXXXXXX` fails. Must be `wa.me/5551XXXXXXX` (55 = Brazil, then DDD + number).
- **`dist/output.css` not committed:** Vercel has no build command in this setup. If the compiled CSS is gitignored, the deployed page has no styles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS purging and minification | Custom PostCSS pipeline | Tailwind CLI `--minify` flag | Tailwind CLI handles tree-shaking by scanning HTML classes — custom pipelines miss edge cases |
| Responsive type scale | Custom `clamp()` calculations | Tailwind's built-in responsive text utilities (`text-xl`, `md:text-2xl`) | Tailwind's scale is pre-tested and consistent across breakpoints |
| Inter font loading | Self-hosted with custom @font-face | Google Fonts `<link>` with `display=swap` + preconnect | Zero maintenance; variable font in one request; font-display: swap prevents FOIT |
| OG image design | Complex image generation | Static JPEG created manually at 1200x630px | No server, no API — a static image file is simpler and faster |
| WhatsApp URL encoding | Custom JS encoder | `encodeURIComponent()` or write the encoded string directly | Pre-encoded string in href is simpler and has zero runtime overhead |
| Grid layout | CSS Grid with JavaScript column calculations | Tailwind grid utilities (`grid-cols-1 md:grid-cols-2`) | Tailwind's responsive grid variants handle all breakpoints without JS |

**Key insight:** Every "custom solution" in this domain adds complexity without solving a problem that Tailwind or standard HTML patterns don't already handle. The page is a document, not an application — the closer to plain HTML/CSS, the more reliable and maintainable it is.

---

## Common Pitfalls

### Pitfall 1: Missing or Broken Open Graph Preview

**What goes wrong:** Client pastes the Vercel link in WhatsApp and sees a raw URL with no preview card. First impression destroyed before page loads.
**Why it happens:** OG tags added to HTML but `og:image` uses a relative path, HTTP URL, or the image is > 300KB.
**How to avoid:** All OG tags static in `<head>`. Image must be an absolute HTTPS URL (e.g., `https://orcamento-brum.vercel.app/assets/img/og-image.jpg`), exactly 1200x630px, under 300KB. Verify by pasting the production URL into an actual WhatsApp conversation after deploy.
**Warning signs:** Preview shows blank URL; preview shows title but no image; `og:image` content begins with `/` or `./`.

### Pitfall 2: Tailwind CLI Output Not Committed to Git

**What goes wrong:** `dist/output.css` is in `.gitignore`. Page deploys to Vercel with no stylesheet. Client sees an unstyled page.
**Why it happens:** Standard practice is to gitignore build artifacts. For this setup (no build command on Vercel), the compiled CSS must be committed.
**How to avoid:** Either commit `dist/output.css` explicitly, or configure Vercel with a build command (`npx @tailwindcss/cli -i src/input.css -o dist/output.css --minify`) and install command (`npm install`). The latter is cleaner for production — Vercel runs the build on each deploy. Either approach works; choose one in plan 01-01 and document it.
**Warning signs:** Deployed page has no visual styling; Vercel build log shows no CSS compilation step.

### Pitfall 3: Mobile Viewport Not Set

**What goes wrong:** Page renders at desktop width on iPhone/Android. Client must pinch-zoom to read anything.
**Why it happens:** `<meta name="viewport">` forgotten in `<head>`.
**How to avoid:** Always include `<meta name="viewport" content="width=device-width, initial-scale=1.0">` as the second tag in `<head>` after charset.
**Warning signs:** Page looks zoomed-out on mobile; horizontal scrollbar on phone.

### Pitfall 4: Price (R$ 12.000) in Wrong Position

**What goes wrong:** Client sees the price before understanding the 6 modules and 45-day timeline. Anchors on cost without value context. Compares to cheaper alternatives without basis.
**Why it happens:** Investment section feels "important" and gets placed early.
**How to avoid:** Investment section is #6 in the page order — after hero, problem, solution, scope, and timeline. Enforce this in the HTML structure during plan 01-02.
**Warning signs:** `<section id="investimento">` appears before `<section id="escopo">` or `<section id="timeline">` in the HTML source.

### Pitfall 5: OG Image URL Points to Undeployed Domain

**What goes wrong:** `og:image` is set to the Vercel URL before the first deploy. Image 404s; WhatsApp shows no preview image.
**Why it happens:** OG tags are written before the site is deployed.
**How to avoid:** In plan 01-01, deploy the site first (even as a skeleton) to get the production URL. Then fill in the OG image URL in plan 01-02 with the confirmed production URL.
**Warning signs:** First deploy has placeholder `og:image` value; image URL returns 404.

### Pitfall 6: wa.me Link Without Country Code

**What goes wrong:** WhatsApp link opens but does not find the contact. Click does nothing or opens a "This number is not on WhatsApp" message.
**Why it happens:** Phone number written in local format (11 9XXXX-XXXX) without Brazil's country code (55).
**How to avoid:** Always use full international format: `https://wa.me/5551XXXXXXXXX` (55 + DDD + 8 digits). URL-encode the pre-filled message with `encodeURIComponent()` or write the encoded string directly.
**Warning signs:** CTA click opens WhatsApp but fails to find the number; pre-filled message contains unencoded spaces or special characters.

### Pitfall 7: Generic Hero That Does Not Name the Client's Problem

**What goes wrong:** Hero headline is "Proposta de desenvolvimento web" or "Sou Marcus, desenvolvedor full-stack." Client does not see their specific context immediately and disengages.
**Why it happens:** Default to self-presentation rather than client-first framing.
**How to avoid:** First visible sentence must reference chopp, delivery, eventos, or the client's specific platform. Locked decision from CONTEXT.md: "Seu delivery de chopp, automatizado."
**Warning signs:** Hero headline could apply to any freelance proposal by changing the name.

---

## Code Examples

### Tailwind v4 Input CSS (CSS-first config — no tailwind.config.js)

```css
/* src/input.css */
@import "tailwindcss";

@theme {
  --color-brand-primary: #0f172a;
  --color-brand-accent: #16a34a;
  --color-brand-muted: #64748b;
  --font-sans: 'Inter', sans-serif;
}
```

Source: https://tailwindcss.com/docs/configuration (v4 CSS-first config)

### Section Structure with Anchor ID

```html
<section id="escopo" class="py-16 md:py-24">
  <div class="max-w-2xl mx-auto px-6">
    <h2 class="text-2xl font-semibold text-slate-900 mb-2">O que você terá em 45 dias</h2>
    <p class="text-slate-600 mb-10">Seis módulos integrados, entregues em sequência.</p>
    <ol class="space-y-8">
      <li>
        <h3 class="font-semibold text-slate-900 mb-3">1. Landing Page de Pedidos</h3>
        <ul class="space-y-1 text-slate-700">
          <li>Página responsiva para receber pedidos de chopp e locação de equipamentos</li>
          <li>Formulário com seleção de data, evento e quantidade</li>
          <li>Confirmação automática por WhatsApp ao enviar</li>
        </ul>
      </li>
    </ol>
  </div>
</section>
```

### Mobile-First CTA Button (min 48px tap height)

```html
<a href="https://wa.me/5551XXXXXXXXX?text=Ol%C3%A1%20Marcus%2C%20quero%20aprovar%20a%20proposta"
   class="inline-flex items-center justify-center gap-2 bg-green-600 text-white font-semibold px-8 py-4 rounded-full text-base md:text-lg min-h-[48px] w-full md:w-auto hover:bg-green-700 transition-colors"
   target="_blank" rel="noopener noreferrer">
  Aprovar proposta pelo WhatsApp
</a>
```

### Complete `<head>` Template

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial — MVP Delivery de Chopp | Marcus Gonçalves</title>
  <meta name="description" content="Sistema completo de pedidos, automação WhatsApp e painel de gestão. 45 dias. R$ 12.000.">
  <!-- Open Graph -->
  <meta property="og:title" content="Proposta Comercial — MVP Delivery de Chopp">
  <meta property="og:description" content="Sistema completo de pedidos, automação WhatsApp e painel de gestão. 45 dias. R$ 12.000.">
  <meta property="og:image" content="https://orcamento-brum.vercel.app/assets/img/og-image.jpg">
  <meta property="og:url" content="https://orcamento-brum.vercel.app">
  <meta property="og:type" content="website">
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
  <!-- Styles (Tailwind CLI output) -->
  <link rel="stylesheet" href="dist/output.css">
</head>
```

### Timeline Section (Week-Anchored)

```html
<section id="timeline" class="py-16 md:py-24 bg-slate-50">
  <div class="max-w-2xl mx-auto px-6">
    <h2 class="text-2xl font-semibold text-slate-900 mb-10">Como chegamos lá: semana a semana</h2>
    <ol class="space-y-6">
      <li class="flex gap-4">
        <span class="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 text-green-800 font-semibold flex items-center justify-center text-sm">1–2</span>
        <div>
          <h3 class="font-semibold text-slate-900">Setup e Landing Page</h3>
          <p class="text-slate-600 text-sm mt-1">Infraestrutura, domínio, formulário de pedidos funcional</p>
        </div>
      </li>
      <!-- more weeks -->
    </ol>
  </div>
</section>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` with `content: [...]` paths | CSS-first config via `@theme` in input.css | Tailwind v4 (Jan 2025) | No JavaScript config file needed; `@import "tailwindcss"` scans all files automatically |
| `tailwind.config.js` with `theme.extend` | `@theme { --variable: value; }` in CSS | Tailwind v4 (Jan 2025) | Design tokens live in CSS, not a JS config |
| AOS library for scroll animations | Native IntersectionObserver + CSS `@keyframes` | AOS last updated 2019 | Zero dependencies; animations are Phase 2 — not needed in Phase 1 |
| `npx tailwind -i ... -o ...` | `npx @tailwindcss/cli -i ... -o ...` | Tailwind v4 | CLI is now a separate package; command prefix changed |

**Deprecated/outdated:**
- `tailwind.config.js`: Replaced by CSS `@theme` in v4. Do not create this file for a v4 project.
- AOS 2.3.4: Last released 2019. Do not use — native alternatives exist and Phase 2 handles this.
- Tailwind `content` array: No longer needed in v4. CLI scans all files by default.

---

## Open Questions

1. **OG image content and design**
   - What we know: Must be 1200x630px, under 300KB, absolute HTTPS URL, static asset
   - What's unclear: What visual should the OG image show — a branded card with the proposal title? A photo of Marcus? A generic professional template?
   - Recommendation: Claude's discretion per CONTEXT.md — create a simple branded card (dark background, white text, proposal title, Marcus's name) as a static JPEG; avoid photos that compress poorly

2. **Tailwind CLI build strategy for Vercel**
   - What we know: Vercel has no build command configured; `dist/output.css` must be either committed or built by Vercel
   - What's unclear: Which approach — commit the compiled CSS (simpler) or configure Vercel with build command (cleaner gitignore)
   - Recommendation: Configure Vercel with build command (`npx @tailwindcss/cli -i src/input.css -o dist/output.css --minify`) and install command (`npm install`) — cleaner workflow, CSS is always built fresh from source

3. **Marcus's WhatsApp number**
   - What we know: Must be in international format (55 + DDD + number); Claude's discretion per CONTEXT.md
   - What's unclear: The actual number is not in any planning document
   - Recommendation: Use a placeholder `5551999999999` in plan 01-02; Marcus replaces with real number before sharing with client

4. **CONT-10 section placement (rationale técnico)**
   - What we know: The requirement exists; ARCHITECTURE.md canonical order has 10 sections
   - What's unclear: Where exactly does "por que código > no-code" fit — as its own section or as a subsection of Solution?
   - Recommendation: Integrate as a subsection within section #3 (Solução) — keeps the funnel tight; a full standalone section for technical rationale risks losing non-technical clients

---

## Sources

### Primary (HIGH confidence)
- https://tailwindcss.com/docs/installation/tailwind-cli — CLI installation, `@tailwindcss/cli` package, input.css syntax
- https://tailwindcss.com/blog/tailwindcss-v4 — v4.0 release, CSS-first config, `@theme` directive
- https://github.com/tailwindlabs/tailwindcss — v4.2.1 latest release confirmed
- https://github.com/alpinejs/alpine — v3.15.8 (Phase 2 only; not needed in Phase 1)
- https://vercel.com/docs/project-configuration/vercel-json — vercel.json schema, `cleanUrls`, `headers`
- https://vercel.com/docs/headers/cache-control-headers — Cache-Control header configuration
- https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name#other_metadata_names — viewport meta tag
- https://fonts.google.com/specimen/Inter — Inter variable font, Google Fonts CDN link format
- https://thospfuller.com/2023/12/24/open-graph-whatsapp/ — WhatsApp OG preview requirements (static HTML, HTTPS image, size limits)

### Secondary (MEDIUM confidence)
- https://brandedagency.com/blog/the-anatomy-of-a-high-converting-landing-page-14-powerful-elements-you-must-use-in-2026 — section ordering rationale, AIDA funnel for proposals
- https://instapage.com/blog/b2b-landing-page-best-practices — trust signal placement relative to CTA
- https://betterproposals.io/proposal-templates/freelance-web-design-proposal-template — section structure, CTA patterns
- https://kreev.io/blog/freelance-proposal-mistakes/ — pitfall documentation, common failure modes
- https://www.proposify.com/blog/business-proposal-writing-mistakes — scope and CTA pitfalls

### Tertiary (LOW confidence)
- StickyCTAs.com — +27% conversion claim for sticky CTA; directionally valid but single source; sticky bar is Phase 2 anyway

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Tailwind v4.2.1 and @tailwindcss/cli verified via GitHub releases; Inter and Heroicons verified via official sources
- Architecture: HIGH — Section order and conversion rationale triangulated across 8+ authoritative sources; Vercel config verified against official docs
- Pitfalls: HIGH — Eight pitfalls drawn from domain research file already validated; Phase 1-specific pitfalls (OG, mobile, price placement) are well-documented with official source backing
- Copywriting content: HIGH — Locked decisions from CONTEXT.md (user-verified); bio details from LinkedIn (public record)

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stable domain; Tailwind v4 and Vercel config are unlikely to break in this window)
