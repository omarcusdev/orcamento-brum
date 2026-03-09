# Feature Research

**Domain:** Commercial proposal / budget page (freelancer → client, HTML static)
**Researched:** 2026-02-27
**Confidence:** MEDIUM — findings drawn from multiple web sources; no authoritative single standard exists for proposal pages

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the client will notice are missing. Absence signals unprofessionalism or lack of care.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Professional cover / hero section | First impression formed in under 7 seconds; no cover = no credibility anchor | LOW | Freelancer name, project title, date, brief tagline |
| Clear problem statement / context section | Demonstrates you understood what the client actually needs, not a generic pitch | LOW | Mirror the client's language; reference the chopp delivery business specifically |
| Scope of work with deliverables | Clients need to know exactly what they're buying before approving anything | MEDIUM | Must list all 6 MVP modules clearly; vague scope loses trust instantly |
| Defined timeline | Even if client didn't ask, absence creates anxiety; they need to know when they get their product | LOW | 45-day total with milestones/phases |
| Closed price (valor fechado) | No price = no proposal; ambiguous pricing = negotiation trap | LOW | R$ 10,000 clearly stated; no per-module breakdown per project decision |
| Payment terms | Clients expect to know how/when to pay before signing anything | LOW | Upfront percentage + remainder on delivery (standard Brazilian market) |
| About / who is proposing section | Establishes who the client is trusting with their money | LOW | Marcus Gonçalves name, relevant experience, technical approach |
| Call to action (CTA) | Without a clear next step the proposal dies; clients don't self-initiate | LOW | WhatsApp link or "I accept" button; must be visible without scrolling far |
| Mobile responsiveness | Client will likely open this link in WhatsApp on mobile | MEDIUM | Mobile-first layout; tap targets sized for thumbs |
| Professional typography and white space | Poor visual design undermines technical credibility; "you're selling a product, show you can build one" | LOW | Clean corporate look; no wall of text |
| Contact information | Client needs a way to reach out with questions before deciding | LOW | WhatsApp number + email at minimum |

---

### Differentiators (Competitive Advantage)

Features that other freelancers in this context won't have. Each one increases the gap between "another proposal PDF" and a memorable, trustworthy experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sticky bottom CTA bar | Always-visible action button as client scrolls; boosts conversion by ~27% on mobile per CRO research | LOW | Fixed bottom bar on mobile: "Quero fechar — falar no WhatsApp"; appears after user scrolls past hero |
| Scroll progress indicator | Shows client how much content remains; signals that information is organized and respects their time | LOW | Thin colored bar at top of viewport; pure CSS scroll-driven animation (no JS needed in modern browsers) |
| Phased delivery timeline (visual) | Timeline visualization = proof of planning; separates planners from cowboys | MEDIUM | Visual milestone steps with weeks/phases; CSS-only horizontal or vertical stepper |
| Scope accordion / expandable modules | Lets client dive deep into modules they care about without drowning in text upfront | LOW | Each of the 6 MVP modules expandable; summary visible, details hidden by default |
| Outcome-framed section headers | "What you'll have in 45 days" instead of "scope of work" reframes investment as result | LOW | Zero implementation cost; just copywriting discipline |
| Technology rationale section | Explains why code > no-code for their case; differentiates Marcus from no-code freelancers who also applied | LOW | One paragraph max; confidence signal, not a lecture |
| Social proof / past work signal | Even one relevant case study or reference increases trust significantly; testimonials lift conversions up to 270% | LOW | One past project example relevant to automation/delivery; or a named client reference if permitted |
| Smooth scroll section navigation | Named section anchor links with smooth scroll; feels polished vs. walls of text | LOW | Sticky mini-nav or jump links in hero; native CSS `scroll-behavior: smooth` |
| Subtle scroll-triggered fade-in animations | Content appearing as client scrolls feels alive and premium vs. a static PDF | LOW | CSS `@keyframes` + Intersection Observer (or pure CSS `animation-timeline: view()` in modern browsers) |
| Numbered delivery phases with icons | Visual chunking of the 45 days into concrete phases reduces "45 days feels abstract" anxiety | LOW | 3-4 phases: kickoff, build, testing, delivery — with week numbers |
| Print / PDF-friendly layout | Client may need to share or save internally; print media query ensures clean output | LOW | `@media print` with hidden animations and full content visible |

---

### Anti-Features (Deliberately NOT Build)

Features that seem helpful but add cost without conversion benefit — or actively damage the proposal's purpose.

| Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Interactive price calculator / configurable pricing | Seems client-friendly and modern | Price is closed (R$ 10,000 total); configurability implies negotiability and invites scope debates. This proposal has a fixed value by design | State the closed price clearly with confidence; add a brief rationale ("valor fechado porque o escopo é definido") |
| Module-by-module price breakdown | Transparency feels trustworthy | Creates line-item negotiation. Client will ask to remove module 4 to save money. The project decisions document explicitly rules this out | Describe value of each module without attaching a price; total stays opaque per-line |
| Video embed or auto-play media | Feels innovative and engaging | Adds load time, unreliable on mobile network, can auto-play at embarrassing moments in shared contexts; client is opening via WhatsApp link | Static content with one embedded link to portfolio/LinkedIn is sufficient |
| Multi-page document structure with page breaks | Mimics traditional PDF proposals | Static HTML page that simulates PDF pages is a UX regression; scrolling is natural on mobile | Single continuous scroll page with clear section anchors |
| Client login / password protection | Seems professional and exclusive | Over-engineering for a single static HTML proposal; adds friction and may prevent the client from forwarding the link internally | Deploy publicly on Vercel; obscurity via unique URL is sufficient |
| Chat widget or live chat | Looks modern | Adds third-party dependency, requires monitoring, feels invasive on a proposal page | A clear WhatsApp CTA button achieves the same goal without complexity |
| E-signature / digital acceptance form | Used by Proposify, PandaDoc etc.; seems professional | Requires backend or third-party service; for a R$ 10k deal a WhatsApp "aceito" message followed by a simple contract PDF is the actual Brazilian market norm | Prominent WhatsApp CTA + verbal/message confirmation workflow |
| Countdown timer / urgency widget | Conversion tactic | Fake urgency is transparent and undermines the professional trust the page is trying to build | Scarcity through natural context: "Agenda limitada, disponível para iniciar em [date]" in plain text |
| Dark mode toggle | Considered a modern UX feature | Scope creep with zero conversion benefit for a single-use proposal page | Let the OS/browser handle if using `prefers-color-scheme`; don't build a manual toggle |
| Full portfolio gallery | Shows breadth of work | Distraction; client is here to decide on this proposal, not browse a portfolio | One focused past project reference that directly parallels their use case |

---

## Feature Dependencies

```
[Mobile-first layout]
    └──required by──> [Sticky bottom CTA bar]
    └──required by──> [Scope accordion]
    └──required by──> [Smooth scroll navigation]

[Scope accordion]
    └──enhances──> [Scope of work section]

[Scroll progress indicator]
    └──enhances──> [Smooth scroll navigation]

[Phased timeline visual]
    └──required by──> [Numbered delivery phases with icons]

[Sticky bottom CTA bar]
    └──conflicts with──> [Footer-only CTA]
    (pick one pattern; both creates confusion)

[Print / PDF-friendly layout]
    └──requires──> [Hidden sticky bar in @media print]
    └──requires──> [All accordion content expanded in @media print]
```

### Dependency Notes

- **Sticky CTA bar requires mobile-first layout:** A sticky bar that covers content on small screens must be tested against all section heights; mobile layout decisions must come first.
- **Accordion requires mobile-first layout:** Tap targets and expand/collapse behavior differ significantly between mobile and desktop; build mobile first to avoid retrofit.
- **Print layout requires accordion content visible:** If modules are collapsed by default via CSS, a `@media print` rule must force `display: block` on all hidden content so the printed version is complete.
- **Scroll progress conflicts with multi-page structure:** Progress bars only make sense on a single continuous scroll page; choosing single-page early unlocks scroll-based features.

---

## MVP Definition

### Launch With (v1)

The minimum required to send a professional, conversion-ready proposal.

- [ ] Hero / cover section — establishes identity and project in 3 seconds
- [ ] Problem understanding section — mirrors client's context (chopp delivery, the brief they posted)
- [ ] Scope of work — all 6 MVP modules, readable and scannable
- [ ] Who is Marcus section — brief, outcome-focused, one relevant reference or past project
- [ ] Timeline section — 45 days broken into phases, visual
- [ ] Closed price section — R$ 10,000 clearly, with brief value framing
- [ ] Payment terms — percentage structure (e.g., 50% upfront, 50% on delivery)
- [ ] Primary CTA — WhatsApp link, high contrast, above-the-fold on mobile
- [ ] Mobile responsiveness — tested at 375px width minimum
- [ ] Sticky bottom CTA bar — low effort, high conversion return on mobile

### Add After Validation (v1.x)

Add these if the proposal is reused for future clients or if this client takes time to decide.

- [ ] Scope accordion for module details — if scope section becomes too long for a fast read
- [ ] Scroll-triggered fade-in animations — after layout is stable; polish layer only
- [ ] Print / PDF-friendly `@media print` styles — if client asks for a document to share internally

### Future Consideration (v2+)

These only make sense if the proposal page becomes a reusable template for multiple proposals.

- [ ] Social proof / testimonials section — requires collecting client permission and quotes first
- [ ] Multi-proposal variant support — different clients, different scopes; premature now

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hero / cover section | HIGH | LOW | P1 |
| Problem statement | HIGH | LOW | P1 |
| Scope of work (6 modules) | HIGH | LOW | P1 |
| Closed price | HIGH | LOW | P1 |
| Payment terms | HIGH | LOW | P1 |
| WhatsApp CTA | HIGH | LOW | P1 |
| Mobile responsiveness | HIGH | MEDIUM | P1 |
| Timeline visual | HIGH | LOW | P1 |
| Who is Marcus section | MEDIUM | LOW | P1 |
| Sticky bottom CTA bar | HIGH | LOW | P1 |
| Smooth scroll navigation | MEDIUM | LOW | P2 |
| Scope accordion | MEDIUM | LOW | P2 |
| Technology rationale | MEDIUM | LOW | P2 |
| Scroll progress indicator | LOW | LOW | P2 |
| Scroll-triggered animations | LOW | LOW | P2 |
| Print / PDF layout | LOW | LOW | P3 |
| Social proof section | HIGH | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, defer

---

## Competitor Feature Analysis

Context: Other freelancers responding to this chopp delivery brief are likely sending PDF proposals or plain WhatsApp messages. The bar is low. A polished HTML page already differentiates significantly.

| Feature | PDF proposal (typical competitor) | Plain WhatsApp message | This proposal's approach |
|---------|----------------------------|-----------------------|--------------------------|
| Visual design | Generic template or none | None | Clean corporate HTML, white background, professional typography |
| Scope clarity | Bullet list or paragraph | Informal summary | 6 modules with expand/collapse and outcome framing |
| Timeline | Vague or absent | "roughly 30-45 dias" | Visual phased timeline with week numbers |
| Price presentation | Line-item or buried | Negotiation start | Closed price stated confidently with brief value justification |
| CTA | Email reply instruction | Implicit | Sticky WhatsApp button throughout the page |
| Mobile experience | PDF reader (poor) | Native | Designed mobile-first; opens cleanly from WhatsApp link |
| Trust signals | Possibly a logo | None | Past project reference, professional tone, methodology transparency |
| Animations | None | None | Subtle scroll fade-ins and timeline animation |

---

## Sources

- [How to Write a Winning Freelance Proposal (PandaDoc)](https://www.pandadoc.com/blog/how-to-write-a-winning-proposal-for-freelance-work/) — MEDIUM confidence
- [10 Freelance Proposal Mistakes That Lose You Clients (Kreev.io)](https://kreev.io/blog/freelance-proposal-mistakes/) — MEDIUM confidence
- [Freelance Web Design Proposal Template — Better Proposals](https://betterproposals.io/proposal-templates/freelance-web-design-proposal-template) — MEDIUM confidence (25,000+ uses, $15.3M closed)
- [Proposify: Interactive Proposals](https://www.proposify.com/blog/future-business-proposals-interactive) — MEDIUM confidence
- [Sticky CTAs Data — StickyCTAs.com](https://www.stickyctas.com/articles/sticky-ctas-data) — LOW confidence (single source)
- [CSS Scroll-Driven Animations — Smashing Magazine](https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/) — HIGH confidence (authoritative web dev source)
- [Freelance Proposal Structure — Kreev.io](https://kreev.io/blog/freelance-proposal-structure/) — MEDIUM confidence
- [How to Create a Killer Design Proposal — Userlytics](https://www.userlytics.com/resources/blog/how-to-create-a-killer-design-proposal-7-critical-tips/) — MEDIUM confidence
- [Proposta comercial freelancer — Nuvemshop](https://www.nuvemshop.com.br/blog/proposta-comercial/) — MEDIUM confidence (Brazilian market context)
- [Conversion Rate Optimization Best Practices 2025 — Grassroots Creative](https://grassrootscreativeagency.com/conversion-rate-optimization-best-practices/) — LOW confidence (single source)

---

*Feature research for: Commercial proposal HTML page — freelancer (Marcus Gonçalves) to client (chopp delivery MVP)*
*Researched: 2026-02-27*
