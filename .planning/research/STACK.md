# Stack Research

**Domain:** Static HTML commercial proposal/budget page
**Researched:** 2026-02-27
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| HTML5 | Native | Markup and structure | Single `index.html` with semantic sections is the simplest structure Vercel can serve with zero config. No framework overhead, no build required unless using Tailwind CLI. |
| Tailwind CSS | 4.2.1 | Utility-first styling and responsive layout | Industry standard for rapid professional UI without writing custom CSS. v4 is a ground-up rewrite — 3.5x faster full builds, CSS-first config with `@theme`, zero content path config needed. Released Jan 2025, stable as of Feb 2025. v3 is legacy now. |
| Alpine.js | 3.15.8 | Micro-interactions (mobile menu, smooth scroll, accordion sections) | Lightest reactive layer for static HTML — 16.6KB gzipped via CDN, no build step, declarative HTML attributes. Ideal for this scope: toggling sections, handling the WhatsApp CTA click state. Pure vanilla JS is viable but Alpine eliminates repetitive querySelector boilerplate. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Inter (variable font) | Latest via Google Fonts or rsms.me CDN | Professional typographic baseline | Most-accessed font on Google Fonts (414B accesses/year), optimized for screen readability, covers the full weight range in one variable font file. Use for all body and heading text. |
| Heroicons | 2.2.0 | Section decorators, checkmarks, contact icons | Made by Tailwind Labs, inline SVG usage requires zero JS, consistent with Tailwind's visual language. Copy SVGs directly — no npm needed. Outline style for clean corporate look. |
| IntersectionObserver API | Native (browser built-in) | Fade-in / slide-in animations on scroll | AOS 2.3.4 is 7 years unmaintained — avoid. Native IntersectionObserver + CSS `@keyframes` achieves the same effect with zero dependencies. CSS scroll-driven animations are the modern 2025 standard but Safari 26+ only — use IntersectionObserver for universal support. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Tailwind CLI (`@tailwindcss/cli`) | Compile and purge Tailwind CSS from HTML classes | Run `npx @tailwindcss/cli -i src/input.css -o dist/output.css --watch` during dev. Produces a minified, purged CSS file for production. No Vite or webpack needed for a single-page static site. |
| Vite | Optional: asset bundling if JS grows complex | Vite 7.x if you add multiple JS modules or need HMR. Overkill for this single-file proposal — only adopt if scope expands. |
| Vercel CLI | Deploy from terminal | `npx vercel` from project root. Vercel auto-detects no framework and serves `index.html` directly. No `vercel.json` needed for the default case. |

## Installation

```bash
# Initialize project
npm init -y

# Tailwind CLI (compile CSS from HTML classes)
npm install -D tailwindcss @tailwindcss/cli

# Create input CSS
echo '@import "tailwindcss";' > src/input.css

# Dev: watch and rebuild
npx @tailwindcss/cli -i src/input.css -o dist/output.css --watch

# Production: minified build
npx @tailwindcss/cli -i src/input.css -o dist/output.css --minify
```

No npm package needed for Alpine.js, Inter, or Heroicons — all loaded via CDN or inline SVG in the HTML.

```html
<!-- In <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">

<!-- Before </body> -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.15.8/dist/cdn.min.js"></script>
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Tailwind CSS v4 | Bootstrap 5 | If the team is Bootstrap-fluent and delivery time is the only concern. Bootstrap's opinionated components create visual uniformity that's harder to escape for a custom corporate look. |
| Tailwind CSS v4 | Pure CSS (custom) | If the page will never be maintained by another developer and no design system alignment is needed. For a one-off proposal with potential future changes, Tailwind provides better maintainability. |
| Alpine.js 3 | Vanilla JS only | If the page has zero interactive elements (no mobile nav, no accordion, no CTA tracking). For this proposal scope with a WhatsApp button and mobile menu, Alpine saves meaningful time. |
| Alpine.js 3 | Vue 3 / React | Only justified if the page will evolve into a full application. For a static proposal, both frameworks are gross overkill. |
| Tailwind CLI | Vite + Tailwind | Use Vite if you want HMR during dev or if JS logic grows to multiple modules. For a single HTML file, Vite adds unnecessary ceremony. |
| Heroicons (inline SVG) | Font Awesome | Font Awesome CDN loads a full icon font (~300KB). Inline SVG Heroicons load zero extra bytes. For a proposal page, every KB matters for mobile clients opening a WhatsApp link. |
| IntersectionObserver (native) | AOS 2.3.4 | AOS is 7 years unmaintained (last release 2019). Do not use it. GSAP is powerful but 67KB — overkill for fade-ins. Native wins here. |
| Google Fonts CDN (Inter) | Self-hosted Inter | Self-hosting is better for GDPR compliance and avoids an extra DNS lookup. For this project scope (one-time proposal, no GDPR obligations), Google Fonts CDN is acceptable. Self-host if performance profiling shows it's a bottleneck. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| AOS 2.3.4 (michalsnik/aos) | Last updated 2019, 7 years of zero maintenance, known issues with modern browsers and frameworks. Effectively abandoned. | Native IntersectionObserver + CSS animations |
| jQuery | Zero justification for a greenfield proposal page in 2026. Adds 87KB for DOM manipulation Alpine.js handles in 16KB. | Alpine.js or vanilla JS |
| Bootstrap 5 | Opinionated component styles fight against custom corporate design. Tailwind's utility approach gives full control without fighting defaults. | Tailwind CSS v4 |
| Tailwind CSS v3 | Legacy. v4 (Jan 2025) is the current standard, 3.5x faster builds, CSS-first config, no content path needed. Starting a greenfield project on v3 is technical debt from day one. | Tailwind CSS v4 |
| GSAP (GreenSock) | 67KB minified. Powerful, but designed for complex sequential animations, not simple scroll fade-ins on a proposal page. | Native IntersectionObserver + CSS transitions |
| React / Vue / Svelte | All require a build step, add JS bundle weight, and are architecturally wrong for a single static HTML page. Vercel hosts them fine, but the complexity is unjustified. | Plain HTML + Alpine.js |
| Tailwind Play CDN (`@tailwindcss/browser`) | Official docs warn this is for prototyping only, not production — it parses classes at runtime in the browser (slow, no purging). | Tailwind CLI with build step |

## Stack Patterns by Variant

**If delivery speed is the priority (no build step at all):**
- Skip Tailwind CLI, load Tailwind Play CDN during development only
- Switch to CLI before deploying to Vercel
- Because the Play CDN is ~112KB unparsed and runtime-compiled — unacceptable for a professional client link

**If the client wants a PDF export of the proposal:**
- Add a `@media print` stylesheet block in the HTML
- Use `window.print()` triggered by a button
- No library needed — browsers handle print layout natively

**If the page needs to track when the client opens it:**
- Add a simple Vercel Analytics snippet (free tier, no cookies, privacy-first)
- Because knowing if the client opened the proposal helps follow-up timing

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| tailwindcss@4.2.1 | Node.js 20+ | v4 dropped support for Node 16/18 in some CLI variants. Use Node 20+ to be safe. |
| @tailwindcss/cli@4.2.1 | tailwindcss@4.2.1 | Must be the same major version. CLI is now a separate package from the core. |
| alpinejs@3.15.8 | Modern browsers (Chrome 111+, Safari 16+, Firefox 128+) | Same target as Tailwind v4. No IE11 support — acceptable for a 2026 professional proposal. |
| Inter variable font | All modern browsers | Variable font axis (`wght`, `opsz`) supported in Chrome 66+, Safari 11+, Firefox 62+. |

## Sources

- [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) — v4.0 release announcement, verified Jan 22 2025 (HIGH confidence)
- [tailwindcss.com/docs/installation/tailwind-cli](https://tailwindcss.com/docs/installation/tailwind-cli) — CLI installation, `@tailwindcss/cli` package confirmed (HIGH confidence)
- GitHub releases tailwindlabs/tailwindcss — v4.2.1 as of Feb 23 2025 (HIGH confidence)
- GitHub releases alpinejs/alpine — v3.15.8 as of Feb 2025 (HIGH confidence)
- GitHub releases tailwindlabs/heroicons — v2.2.0 confirmed (HIGH confidence)
- [npmjs.com/package/aos](https://www.npmjs.com/package/aos) — AOS 2.3.4, last published 7 years ago (HIGH confidence, recommendation: avoid)
- [developer.mozilla.org IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) — native browser API, universal modern browser support (HIGH confidence)
- [developer.mozilla.org CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations) — Chrome 115+, Edge 115+, Safari 26+ only (MEDIUM confidence for production use, limited Safari support until 2026)
- [fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter) — Inter variable font, 414B accesses/year, verified (HIGH confidence)
- WebSearch: Alpine.js vs vanilla JS for static HTML — multiple sources confirm Alpine as the minimal interactive layer for static sites (MEDIUM confidence)
- WebSearch: Vite 7.3.1 current stable — confirmed via vite.dev/blog/announcing-vite7 (MEDIUM confidence, noted as optional for this project)

---
*Stack research for: Static HTML commercial proposal page (orcamento-brum)*
*Researched: 2026-02-27*
