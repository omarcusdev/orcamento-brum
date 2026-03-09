# Phase 1: Foundation and Content - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Página HTML estática de proposta comercial completa para MVP de delivery de chopp. Inclui todo o conteúdo (hero, problema, escopo 6 módulos, timeline, valor, pagamento, sobre, contato, rationale técnico, social proof), layout mobile-first com Tailwind CSS v4, CTA WhatsApp funcional, Open Graph tags para preview correto no chat, e deploy na Vercel. A prioridade absoluta é funcionar bem no mobile — o cliente vai abrir pelo WhatsApp no celular.

</domain>

<decisions>
## Implementation Decisions

### Copywriting e Tom
- Tom profissional direto: "Você terá um sistema completo..." — confiança sem arrogância, tuteia o cliente
- Hero focado no cliente: "Seu delivery de chopp, automatizado" — o cliente se vê no centro
- Linguagem técnica: usar termos como "API do WhatsApp", "webhook", "integração" — o cliente pediu expertise técnica
- Headers orientados a resultado: "O que você terá em 45 dias" ao invés de "Escopo do trabalho"

### Seção Sobre / Social Proof
- Posicionamento como dev full-stack com 7 anos de experiência (desde 2019)
- Dados do LinkedIn para bio:
  - Fundador do oZapGPT — solução que integra IA ao WhatsApp para automatizar atendimento (time de 4 pessoas)
  - Founding Engineer na Opdv por 4 anos — sistema de gestão para restaurantes com cardápio digital, chatbot WhatsApp, integrações iFood/Rappi/Uber Eats. Opdv adquirida pelo iFood em 2025
  - Co-Founder do GDG Porto Alegre — organizou eventos e palestrou por 2 anos
  - 22k seguidores no Instagram (@omarcusdev) criando conteúdo tech
- Social proof matador: oZapGPT (automação WhatsApp) + Opdv (delivery/restaurantes adquirida pelo iFood) — encaixa perfeitamente com o projeto do cliente
- Projeto zap-gpt-free no GitHub com 594 stars — demonstra expertise real em WhatsApp

### Seção de Escopo
- Resumo + bullets: título do módulo + 3-5 bullets com entregas concretas
- Lista vertical: um módulo abaixo do outro, sequencial
- Nomes técnicos: "Landing Page", "Formulário de Pedidos", "Automação WhatsApp", etc.
- Sem seção explícita de exclusões — foco no que está incluso
- Mobile-first é prioridade #1 — tudo deve ser pensado primeiro para 375px

### Condições Comerciais
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

</decisions>

<specifics>
## Specific Ideas

- O perfil de Marcus é ideal pra este cliente: oZapGPT (WhatsApp) + Opdv (delivery/restaurantes, adquirida pelo iFood) — usar isso como diferencial forte
- A experiência com a Opdv precisa ser destacada: sistema de gestão para restaurantes com integrações de delivery é exatamente o domínio do cliente
- O projeto zap-gpt-free (594 stars no GitHub) prova domínio técnico em automação WhatsApp
- O valor subiu de R$ 10.000 pra R$ 12.000 (3x R$ 4.000) — apresentar como parcelamento por marco de entrega, não como aumento

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-content*
*Context gathered: 2026-02-27*
