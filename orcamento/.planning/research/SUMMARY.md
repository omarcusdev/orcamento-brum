# Project Research Summary

**Project:** orcamento-brum
**Domain:** Static HTML commercial proposal page — freelancer (Marcus Gonçalves) to client (chopp delivery MVP)
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a single-page, static HTML commercial proposal shared via a WhatsApp link. The client is a business owner evaluating a R$ 10,000 MVP for a chopp delivery platform. The competitive context is unusually favorable: most competing freelancers send PDF files or plain WhatsApp messages. A polished, mobile-first HTML page already differentiates significantly before a single word is read. The recommended approach is the simplest possible stack — HTML5 + Tailwind CSS v4 + Alpine.js 3 — deployed to Vercel with zero build complexity. No framework, no backend, no database. The entire product is a persuasion document that exists to produce one outcome: the client sending a WhatsApp message to accept.

The architecture is radically simple by design. Ten sections in a single `index.html`, one `style.css`, one minimal `main.js`, assets in `/assets`, deployed to Vercel from a GitHub push with no build command. The section order follows a deliberate psychological funnel: problem first, solution second, scope third, timeline fourth, price fifth — price is never revealed before value is demonstrated. The CTA mechanism is a single WhatsApp deep link (`wa.me`) with a pre-filled acceptance message, repeated at the top and bottom. No competing actions.

The primary risks are not technical — they are content and conversion risks. Missing Open Graph tags break the WhatsApp preview before the client ever loads the page. Vague scope language creates post-approval disputes that damage the client relationship. Price placed before value anchors the client on cost rather than return. And a desktop-first layout that breaks on mobile destroys trust at the moment of first impression, since the link is opened on a phone via WhatsApp. All eight critical pitfalls can be avoided in Phase 1 through disciplined content architecture and mobile-first CSS — no special tooling required.

## Key Findings

### Recommended Stack

The stack is intentionally minimal. Tailwind CSS v4 (released January 2025) handles all visual styling via a build-time CLI step — no Vite, no webpack, no framework. Alpine.js 3 (16.6KB) provides the only interactivity needed: accordion expand/collapse for scope modules, mobile menu toggling, and the sticky CTA bar. The Inter variable font covers all typographic needs in a single file. Heroicons inline SVGs add section decorators with zero runtime cost.

The single most important stack decision is to avoid AOS (7 years unmaintained), GSAP (67KB overkill), jQuery (87KB with no justification), and any SPA framework (React, Vue, Svelte) which are architecturally wrong for a static read-only document. Native `IntersectionObserver` + CSS `@keyframes` replaces AOS cleanly.

**Core technologies:**
- HTML5: Single `index.html` with all sections inline — eliminates routing complexity and build steps
- Tailwind CSS v4.2.1: Utility-first styling via CLI build — faster than v3, CSS-first config, no content path config needed
- Alpine.js 3.15.8: Minimal reactivity via CDN — accordion, mobile nav, sticky CTA; no build step required
- Inter variable font: Professional typographic baseline, one file for all weights via Google Fonts or self-hosted
- Heroicons 2.2.0: Inline SVG icons — zero runtime cost, consistent visual language with Tailwind
- IntersectionObserver (native): Scroll-triggered fade-in animations — replaces AOS with zero dependencies
- Vercel: Static hosting with global CDN, auto-deploys on git push, no build command needed

### Expected Features

**Must have (table stakes) — P1, required for launch:**
- Hero/cover section with headline, subheadline, and primary WhatsApp CTA
- Problem statement that mirrors the client's specific chopp delivery context
- Scope of work listing all 6 MVP modules with explicit inclusions and exclusions
- Visual phased timeline — 45 days broken into labeled phases with week numbers
- Closed price section (R$ 10,000) placed after full scope with value framing adjacent
- Payment terms (percentage structure, upfront + on delivery)
- Who is Marcus section — brief, outcome-focused, one relevant past project reference
- Sticky bottom CTA bar — always-visible WhatsApp button on mobile
- Mobile responsiveness — designed at 375px first, tested on a physical device

**Should have (differentiators) — P2, add before or shortly after launch:**
- Scope accordion — each of the 6 modules expandable for detail; summary visible by default
- Smooth scroll section navigation with anchor IDs
- Scroll-triggered fade-in animations (CSS + IntersectionObserver)
- Technology rationale section — brief "por que código vs. no-code" paragraph
- Scroll progress indicator — thin CSS bar at top viewport

**Defer (v2+):**
- Social proof / testimonials — requires client permission, not available at launch
- Multi-proposal variant support — premature for a single-client page
- Print / PDF-friendly `@media print` styles — only if client requests it

**Anti-features — deliberately excluded:**
- Interactive price calculator (implies negotiability on a closed-price deal)
- Per-module price breakdown (invites line-item negotiation)
- E-signature or digital acceptance form (overkill; WhatsApp "aceito" is the Brazilian market norm)
- Video embeds (unreliable on mobile cellular, adds load time)
- Chat widget (requires monitoring; WhatsApp CTA accomplishes the same goal)

### Architecture Approach

The architecture is a flat static site: one HTML file, one CSS file, one minimal JS file, and a `/assets` folder. There is no application state, no routing, no API calls. The deployment pipeline is GitHub push → Vercel auto-detect → serve root directory. A minimal `vercel.json` sets cache-control headers (1 hour for HTML, 1 year immutable for assets) and `cleanUrls: true`. The section order follows the AIDA funnel adapted for B2B proposals: problem → solution → scope → timeline → investment → trust signals → CTA.

**Major components:**
1. `index.html` — All 10 sections inline as `<section>` elements with IDs; semantic structure; Open Graph meta tags in `<head>`
2. `style.css` — Full visual system via CSS custom properties for design tokens; mobile-first media queries; BEM-like class scoping per section
3. `main.js` — WhatsApp CTA link construction; smooth scroll; optional IntersectionObserver for fade-in animations; no framework
4. `assets/` — Self-hosted fonts, compressed profile photo (WebP, max 100KB), optional tech logos as SVG
5. `vercel.json` — Cache-control headers and `cleanUrls`; no build command; Vercel serves root directory directly

### Critical Pitfalls

1. **Missing Open Graph tags** — WhatsApp shows a blank URL with no preview card; add `og:title`, `og:description`, `og:image` (absolute HTTPS URL, under 300KB), `og:url`, `og:type` in static `<head>` before any JS; verify by pasting the Vercel URL into an actual WhatsApp conversation
2. **Price revealed before value is established** — Client anchors on R$ 10,000 without understanding what they are buying; enforce section order: problem → scope → timeline → price; never place price in the first three sections
3. **Vague scope with no exclusions** — Post-approval disputes destroy the client relationship; every module must list explicit inclusions AND at least one explicit exclusion ("não inclui")
4. **Not mobile-first** — The link is opened on a phone via WhatsApp; design at 375px first; body font minimum 16px; CTA button minimum 48px tap height; test on a physical device, not just DevTools
5. **Generic opening that doesn't name the client's problem** — "Sou Marcus, desenvolvedor com X anos..." is a proposal killer; the first visible sentence must reference chopp, delivery, or the client's specific context by name
6. **Slow load from unoptimized images** — Profile photo max 100KB WebP; any hero image max 200KB; PageSpeed Insights mobile score must be 90+ before the link is shared
7. **Multiple competing CTAs** — Single CTA mechanism only (WhatsApp `wa.me` link); repeat it twice (hero + footer section); no email, phone, or form competing on the same screen
8. **Wall of text with no visual hierarchy** — Page must be scannable in 30 seconds; section cards, icon-numbered modules, aggressive whitespace (64px+ between sections); grayscale screenshot test — hierarchy must survive without color

## Implications for Roadmap

Based on combined research, this project maps cleanly to two phases. The decision is driven by the fact that all critical pitfalls are content and CSS architecture decisions that must be locked before a single layout pixel is placed. Phase 1 produces a shippable, conversion-ready proposal. Phase 2 adds the polish layer that differentiates from a PDF but is not required for the client to make a decision.

### Phase 1: Foundation and Content Structure

**Rationale:** All eight critical pitfalls are Phase 1 problems. Content architecture (section order, scope language, CTA copy, price framing) must be decided before layout. HTML structure with correct Open Graph tags and semantic sections must exist before CSS is applied. Mobile-first CSS architecture cannot be retrofitted — it must be the first constraint.

**Delivers:** A shippable proposal page — correct section order, all 10 sections populated with real content, WhatsApp CTA functional, Open Graph preview working, mobile layout tested on a physical device.

**Addresses (from FEATURES.md P1 list):**
- Hero section with primary CTA
- Problem statement (client-specific, mentioning chopp/delivery)
- Scope of work — all 6 MVP modules with inclusions and explicit exclusions
- Visual phased timeline (45 days, week-numbered phases)
- Closed price section (R$ 10,000, placed after scope)
- Payment terms
- Who is Marcus section
- Sticky bottom CTA bar
- Mobile responsiveness at 375px minimum

**Avoids (from PITFALLS.md):**
- Missing OG tags (Pitfall 1) — in-scope for HTML foundation task
- No clear CTA (Pitfall 2) — single WhatsApp mechanism, defined in content task
- Price before value (Pitfall 3) — enforced by section order
- Vague scope (Pitfall 4) — explicit inclusions and exclusions per module
- Not mobile-first (Pitfall 5) — constraint from first line of CSS
- Wall of text (Pitfall 6) — design system with typographic hierarchy
- Generic opening (Pitfall 7) — content review gate before HTML is written

### Phase 2: Polish and Performance

**Rationale:** Scroll animations, accordion interactions, and asset optimization are the polish layer. They cannot be built until Phase 1 layout is stable, because animations break on layout changes and accordion behavior depends on final module content. Image optimization requires final asset selection.

**Delivers:** A memorable, premium proposal experience — scroll-triggered animations, module accordion, scroll progress indicator, smooth navigation, and PageSpeed mobile score 90+.

**Addresses (from FEATURES.md P2 list):**
- Scope accordion (Alpine.js `x-show` / `x-collapse`)
- Scroll-triggered fade-in animations (IntersectionObserver + CSS `@keyframes`)
- Smooth scroll navigation with section anchor IDs
- Scroll progress indicator (CSS scroll-driven animation or JS fallback)
- Technology rationale section copy

**Uses (from STACK.md):**
- Alpine.js 3.15.8 — accordion and interaction behavior
- IntersectionObserver API (native) — scroll animations
- Tailwind CSS v4 CLI — purged, minified production CSS

**Avoids (from PITFALLS.md):**
- Slow load from unoptimized assets (Pitfall 8) — image compression to WebP, PageSpeed gate before sharing

### Phase Ordering Rationale

- Content must precede code: scope language, price framing, and CTA copy are the highest-leverage decisions; no layout should be written until content structure is locked
- Section order is an architecture constraint, not a design preference: placing price after scope is a conversion decision backed by CRO research — it cannot be changed by a designer later without understanding the reasoning
- Mobile-first is a Day 1 CSS constraint: retrofitting responsive styles onto a desktop layout creates broken tap targets and layout reflows that are expensive to fix; the constraint must be established before the first section is styled
- Phase 2 depends on Phase 1 stability: animations and accordion behavior require final section heights and content; adding them to a page still under content revision creates wasted rework
- The "deploy and share" gate belongs at the end of Phase 1, not Phase 2: the client does not need scroll animations to make a decision; Phase 2 is polish, not conversion-critical

### Research Flags

Phases with well-documented patterns (skip `/gsd:research-phase`):
- **Phase 1:** Static HTML structure, Tailwind v4 CSS setup, and Vercel deployment are exhaustively documented in official sources; the patterns are standard and the research already covers them fully
- **Phase 2:** Alpine.js accordion, IntersectionObserver animations, and Tailwind CLI builds are well-understood patterns; no additional research needed

No phases require deeper research. This is the simplest class of web project — a single static HTML page with no API integrations, no authentication, no database, and no third-party service complexity beyond a WhatsApp `wa.me` URL.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Tailwind, Alpine.js, and Vercel docs verified; version numbers confirmed via GitHub releases as of Feb 2025 |
| Features | MEDIUM | Drawn from freelance proposal best-practice sources; no single authoritative standard exists; cross-referenced across 8+ sources; core table-stakes list is high confidence, differentiator ROI data (e.g., "sticky CTA +27%") is low-confidence single-source |
| Architecture | HIGH | Section order and conversion rationale verified across multiple CRO and B2B landing page sources; Vercel static config verified against official docs |
| Pitfalls | MEDIUM | Eight pitfalls triangulated across 10+ sources; Open Graph/WhatsApp preview behavior is high confidence; CTA single-mechanism recommendation is high confidence; scope-creep risk is standard freelance domain knowledge |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Sticky CTA conversion claim (+27%):** Single-source data point from StickyCTAs.com; treat as directionally correct but not a hard number; sticky CTA is still the right call regardless of the exact lift
- **Social proof section:** Deferred to v2+ because no testimonials are currently available; if a relevant past project can be named during content writing, add it to Phase 1 as a differentiator
- **Custom domain:** Research recommends a clean URL instead of the default `.vercel.app` subdomain for professionalism; the actual domain choice is a project decision, not a research question — flag for the implementation phase
- **Google Fonts vs. self-hosting Inter:** Research notes that self-hosting is better for GDPR and avoids a DNS lookup; for this single-use proposal with no GDPR obligations, either approach is acceptable; decide at implementation time based on load testing

## Sources

### Primary (HIGH confidence)
- [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) — Tailwind v4 release, CSS-first config, CLI package
- [tailwindcss.com/docs/installation/tailwind-cli](https://tailwindcss.com/docs/installation/tailwind-cli) — CLI installation and usage
- [GitHub: tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) — v4.2.1 confirmed
- [GitHub: alpinejs/alpine](https://github.com/alpinejs/alpine) — v3.15.8 confirmed
- [Vercel Docs — vercel.json](https://vercel.com/docs/project-configuration/vercel-json) — static config, cleanUrls, headers
- [Vercel Docs — Cache-Control Headers](https://vercel.com/docs/headers/cache-control-headers) — caching strategy
- [MDN — Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) — native browser API, universal support
- [fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter) — Inter variable font, usage stats

### Secondary (MEDIUM confidence)
- [BetterProposals — Freelance Web Design Template](https://betterproposals.io/proposal-templates/freelance-web-design-proposal-template) — proposal structure, CTA patterns
- [Kreev.io — Freelance Proposal Mistakes](https://kreev.io/blog/freelance-proposal-mistakes/) — common failure modes
- [Smashing Magazine — CSS Scroll-Driven Animations](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/) — scroll animation patterns
- [HubSpot — How to Write a Business Proposal](https://blog.hubspot.com/sales/how-to-write-business-proposal) — section ordering rationale
- [Branded Agency — High-Converting Landing Page Elements](https://brandedagency.com/blog/the-anatomy-of-a-high-converting-landing-page-14-powerful-elements-you-must-use-in-2026) — AIDA funnel for proposals
- [Instapage — B2B Landing Page Best Practices](https://instapage.com/blog/b2b-landing-page-best-practices) — trust signal placement
- [Proposify — Proposal Writing Mistakes](https://www.proposify.com/blog/business-proposal-writing-mistakes) — scope and CTA pitfalls
- [thospfuller.com — OG Tags WhatsApp](https://thospfuller.com/2023/12/24/open-graph-whatsapp/) — WhatsApp preview requirements

### Tertiary (LOW confidence)
- [StickyCTAs.com — Sticky CTA Data](https://www.stickyctas.com/articles/sticky-ctas-data) — +27% conversion claim; directionally useful, single source
- [Grassroots Creative — CRO Best Practices 2025](https://grassrootscreativeagency.com/conversion-rate-optimization-best-practices/) — single CTA conversion lift claim

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
