# Requirements: Proposta Comercial — MVP Delivery de Chopp

**Defined:** 2026-02-27
**Core Value:** A proposta deve transmitir profissionalismo e competência técnica, detalhando o escopo completo do MVP de forma clara para que o cliente aprove o investimento de R$ 10.000.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Conteúdo e Estrutura

- [x] **CONT-01**: Página exibe hero/cover com nome "Marcus Gonçalves", título do projeto, data e tagline profissional
- [x] **CONT-02**: Página exibe seção de entendimento do problema que espelha o brief do cliente (delivery de chopp, eventos, automação)
- [x] **CONT-03**: Página exibe escopo detalhado com os 6 módulos do MVP (landing page, formulário, WhatsApp, pagamentos, painel, escalabilidade)
- [x] **CONT-04**: Página exibe timeline visual de 45 dias dividida em fases com marcos de entrega
- [x] **CONT-05**: Página exibe valor fechado de R$ 10.000 com framing de valor (após demonstrar escopo e benefícios)
- [x] **CONT-06**: Página exibe condições de pagamento (percentual de entrada + restante na entrega)
- [x] **CONT-07**: Página exibe seção "Sobre" com apresentação profissional de Marcus Gonçalves e experiência relevante
- [x] **CONT-08**: Página exibe informações de contato (WhatsApp + email)
- [x] **CONT-09**: Página usa headers orientados a resultado ("O que você terá em 45 dias" ao invés de "Escopo")
- [x] **CONT-10**: Página exibe seção de rationale tecnológico explicando por que código > no-code para o caso do cliente
- [x] **CONT-11**: Página exibe referência de projeto passado relevante (social proof) como sinal de confiança

### Conversão e UX

- [x] **CONV-01**: Página exibe CTA primário para WhatsApp visível no hero e no final da página
- [x] **CONV-02**: Página é mobile-first responsiva, testada a partir de 375px de largura
- [x] **CONV-03**: Página usa tipografia profissional (Inter ou equivalente) com espaçamento adequado
- [ ] **CONV-04**: Página exibe sticky bottom CTA bar no mobile que aparece após rolar o hero
- [ ] **CONV-05**: Página implementa smooth scroll com anchor links entre seções
- [ ] **CONV-06**: Página exibe scroll progress indicator (barra fina no topo da viewport)

### Interatividade e Polish

- [ ] **POLH-01**: Módulos do escopo são exibidos em accordion expandível (resumo visível, detalhes ao clicar)
- [ ] **POLH-02**: Conteúdo das seções aparece com fade-in animation ao rolar (IntersectionObserver + CSS keyframes)
- [ ] **POLH-03**: Página tem layout otimizado para print/PDF via @media print (sticky bar oculta, accordions expandidos, animações desativadas)

### Técnico e Deploy

- [x] **TECH-01**: Página inclui Open Graph tags corretas para preview profissional no WhatsApp (título, descrição, imagem)
- [x] **TECH-02**: Página é deployada na Vercel com URL funcional
- [ ] **TECH-03**: Página atinge score 90+ no PageSpeed Insights mobile
- [x] **TECH-04**: Página usa Tailwind CSS v4 com build via Tailwind CLI

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Evolução

- **EVOL-01**: Página tem domínio customizado (ex: proposta.marcusgoncalves.dev)
- **EVOL-02**: Vercel Analytics habilitado para rastrear aberturas do cliente
- **EVOL-03**: Template reutilizável para futuras propostas (variáveis de projeto/cliente)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Calculadora de preço interativa | Preço é fechado (R$ 10.000); configurabilidade convida negociação |
| Breakdown de valor por módulo | Gera negociação linha a linha; decisão explícita do projeto |
| Embed de vídeo | Peso extra, instável em mobile/WhatsApp, não agrega conversão |
| Login/senha de acesso | Over-engineering para proposta estática; URL obscura basta |
| Chat widget | Dependência de terceiro, WhatsApp CTA resolve o mesmo |
| E-signature digital | Requer backend; "aceito" no WhatsApp é norma do mercado brasileiro |
| Timer de urgência/countdown | Urgência artificial destrói confiança profissional |
| Dark mode toggle | Escopo desnecessário para página de uso único |
| Galeria de portfólio completa | Distração; uma referência relevante é suficiente |
| Multi-page com page breaks | Regressão de UX; scroll contínuo é natural no mobile |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 1 | Complete |
| CONT-02 | Phase 1 | Complete |
| CONT-03 | Phase 1 | Complete |
| CONT-04 | Phase 1 | Complete |
| CONT-05 | Phase 1 | Complete |
| CONT-06 | Phase 1 | Complete |
| CONT-07 | Phase 1 | Complete |
| CONT-08 | Phase 1 | Complete |
| CONT-09 | Phase 1 | Complete |
| CONT-10 | Phase 1 | Complete |
| CONT-11 | Phase 1 | Complete |
| CONV-01 | Phase 1 | Complete |
| CONV-02 | Phase 1 | Complete |
| CONV-03 | Phase 1 | Complete |
| CONV-04 | Phase 2 | Pending |
| CONV-05 | Phase 2 | Pending |
| CONV-06 | Phase 2 | Pending |
| POLH-01 | Phase 2 | Pending |
| POLH-02 | Phase 2 | Pending |
| POLH-03 | Phase 2 | Pending |
| TECH-01 | Phase 1 | Complete |
| TECH-02 | Phase 1 | Complete |
| TECH-03 | Phase 2 | Pending |
| TECH-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
