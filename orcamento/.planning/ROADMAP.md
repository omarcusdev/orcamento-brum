# Roadmap: Proposta Comercial — MVP Delivery de Chopp

## Overview

Uma proposta comercial estática de alta conversão, entregue em duas fases. A Fase 1 produz uma página funcional e pronta para envio ao cliente — conteúdo completo, layout mobile-first, CTA no WhatsApp e deploy na Vercel. A Fase 2 adiciona a camada de polish que diferencia a proposta de um PDF comum: interatividade via accordion, animações de scroll, indicador de progresso e otimização de performance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Content** - Página shippable com todo o conteúdo, layout mobile-first, CTA funcional e deploy
- [ ] **Phase 2: Polish and Performance** - Interatividade, animações, scroll progress e PageSpeed 90+ mobile

## Phase Details

### Phase 1: Foundation and Content
**Goal**: O cliente recebe um link WhatsApp que abre uma proposta profissional, completa, legível no celular, com CTA funcional e preview correto no chat
**Depends on**: Nothing (first phase)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08, CONT-09, CONT-10, CONT-11, CONV-01, CONV-02, CONV-03, TECH-01, TECH-02, TECH-04
**Success Criteria** (what must be TRUE):
  1. Ao colar o link da Vercel no WhatsApp, aparece preview com título, descrição e imagem — não uma URL nua
  2. Ao abrir o link em um celular de 375px, todas as seções são legíveis e navegáveis sem zoom ou scroll horizontal
  3. O botão WhatsApp no hero e no final da página abre o app com mensagem pré-preenchida de aceite
  4. A seção de investimento (R$ 12.000) aparece após o cliente ter visto o escopo completo dos 6 módulos e o cronograma de 45 dias
  5. A tipografia usa fonte profissional (Inter ou equivalente) com hierarquia visual clara e espaçamento adequado entre seções
**Plans**: TBD

Plans:
- [x] 01-01: Setup do projeto — estrutura de arquivos, Tailwind CLI, vercel.json, deploy inicial
- [x] 01-02: HTML foundation — index.html completo com todas as seções, Open Graph tags, semântica, anchors
- [x] 01-03: Conteúdo e copywriting — textos de todas as seções (hero, problema, escopo, timeline, valor, pagamento, sobre, contato, rationale técnico)
- [x] 01-04: CSS mobile-first — design system completo via Tailwind, todas as seções estilizadas, responsividade de 375px+

### Phase 2: Polish and Performance
**Goal**: A proposta entrega uma experiência premium — interatividade fluida, animações de scroll, navegação âncora, layout otimizado para impressão e score PageSpeed 90+ no mobile
**Depends on**: Phase 1
**Requirements**: CONV-04, CONV-05, CONV-06, POLH-01, POLH-02, POLH-03, TECH-03
**Success Criteria** (what must be TRUE):
  1. Cada um dos 6 módulos do escopo é exibido resumido por padrão e expande ao clicar, sem recarregar a página
  2. Ao rolar a página, cada seção principal aparece com fade-in suave vindo do estado invisível
  3. Uma barra fina de progresso no topo da viewport avança conforme o scroll, indicando posição na página
  4. No mobile, uma barra CTA fixa aparece na parte inferior da tela após o usuário rolar além do hero
  5. Ao acionar Ctrl+P ou "imprimir como PDF", a página exibe todos os módulos expandidos, sem a sticky bar, sem animações e com layout adequado para impressão
**Plans**: TBD

Plans:
- [ ] 02-01: Interatividade — Alpine.js accordion nos módulos, smooth scroll, sticky CTA bar mobile (CONV-04, CONV-05, POLH-01)
- [ ] 02-02: Animações e polish — IntersectionObserver fade-in, scroll progress indicator (CONV-06, POLH-02)
- [ ] 02-03: Print styles e performance — @media print, compressão de assets, PageSpeed 90+ (POLH-03, TECH-03)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Content | 4/4 | Complete | 2026-02-28 |
| 2. Polish and Performance | 0/3 | Not started | - |
