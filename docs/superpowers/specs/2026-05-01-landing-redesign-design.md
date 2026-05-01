# Landing redesign — alfachopp.com.br pixel-copy + functional calculator

**Data:** 2026-05-01
**Tipo:** Design spec
**Escopo:** Atualização visual da homepage `/` (sem mudar páginas autenticadas)

## Contexto

O cliente já tem uma landing pública em produção (https://www.alfachopp.com.br/) com hero, calculadora de festa e footer mais elaborados que os nossos. A pedido do cliente, vamos importar esses três blocos pra nossa app, mantendo as funcionalidades reais (checkout, catálogo conectado ao Supabase, admin) intactas.

A linha que separa "pixel-copy" de "adaptação" é deliberada:
- **Visual** (layout, tipografia, copy, cores, fotos): pixel-copy fiel.
- **Comportamento** dos CTAs: aponta pros nossos fluxos reais (calculadora abre carrinho, "Pedir Agora" rola pro catálogo, "Solicitar Orçamento" abre WhatsApp do cliente).

## Decisões tomadas no brainstorming

| # | Pergunta | Resposta |
|---|---|---|
| 1 | Direção visual geral | Híbrido por seção (mas hero/calculadora/footer/header acabaram pixel-copy) |
| 2 | Calculadora — comportamento | Sugere combo de barris + adiciona ao carrinho existente |
| 3 | Hero | Pixel-copy de alfachopp.com.br |
| 4 | Footer | Pixel-copy |
| 5 | Calculadora — visual | Pixel-copy |
| 6 | Ordem da página | Header → Hero → Calculadora → Catálogo → Features → FAQ → Footer |
| 7 | Header | Pixel-copy (escopo: só na landing) |

## Composição da página

Arquivo: `app/app/page.tsx`

```
<HeaderLanding />          ← novo, pixel-copy, só nesta rota
<HeroLanding />            ← novo, substitui Hero atual
<Calculator />             ← novo, integrado ao CartProvider
<Storefront produtos>      ← existente
  <Features />             ← existente
  <Faq />                  ← existente
</Storefront>
<FooterLanding />          ← novo, substitui Footer atual
```

**Páginas que NÃO mudam** (continuam com `Header` e `Footer` atuais):
- `/admin/*`
- `/checkout`
- `/meus-pedidos`
- `/pedido/[id]`
- `/pedido/[id]/confirmacao`

## Componentes

### `HeaderLanding`

**Arquivo:** `app/components/landing/header-landing.tsx`

**Layout:**
- Sticky `top: 0; z-50`
- Inicial: transparente sobre o hero preto
- Após `scrollY > 80px`: bg sólido `#0d0d0d` + border-bottom yellow sutil
- Esquerda: logo "ALFA CHOPP" em texto duas linhas (yellow, com ícone de caneca à esquerda)
- Direita (desktop): nav `INÍCIO | NOSSOS CHOPPS | CALCULADORA | MEUS PEDIDOS` + CTA pill yellow `🛒 Pedir Agora`
- Mobile: hambúrguer abre overlay com os mesmos itens empilhados

**Decisão de escopo:** o link "MEUS PEDIDOS" é nosso (não existe no header deles), mas mantemos pra não enterrar a feature. Os outros 4 itens (3 nav + CTA) são pixel-copy.

**Anchors usados:**
- `#home` → topo da página
- `#chopps` → catálogo (precisa adicionar `id="chopps"` no `<Storefront>`)
- `#calculadora` → calculadora (já vem com id na nova section)

### `HeroLanding`

**Arquivo:** `app/components/landing/hero-landing.tsx`

**Layout split (desktop):**
- Bg sólido `#0d0d0d`
- Coluna esquerda ~55%, padding generoso vertical e left
  - Badge pill: `DELIVERY PREMIUM` (yellow bg, black text, uppercase, tracking wide)
  - H1 em duas linhas:
    - "O Melhor Chopp" (white)
    - "Pelo Melhor Preço" (yellow `#E8B912`)
  - Parágrafo: "Leve a experiência da choperia para o conforto da sua casa. Equipamento profissional, instalação rápida e o sabor inigualável que seus convidados merecem."
  - CTAs lado a lado:
    - **SOLICITAR ORÇAMENTO** — yellow filled, uppercase tracking, link → `https://wa.me/{whatsappNumero}` (config dinâmica via `getConfig("whatsapp_numero")`)
    - **VER OPÇÕES** — outline white, uppercase, link → `#calculadora` (mudei de `#chopps` deles porque na nossa ordem calculadora vem antes do catálogo)
  - Linha de checks inline: ✓ Instalação Grátis ✓ Equipamento Incluso
- Coluna direita ~45%
  - Image bleed (full height) — foto de chopp sendo servido com pessoas brindando
  - Sem texto sobreposto
  - `next/image` com `fill` + `object-cover`

**Mobile (`md:` breakpoint):**
- Empilha (texto em cima, foto embaixo)
- Headline reduzida e centralizada
- CTAs full-width empilhados
- Features inline ficam centradas

**Imagem:** `/public/landing/hero-chopp.jpg` — baixar uma foto temática de chopp/brinde do Unsplash (ou usar a deles se o cliente liberar). Tamanho alvo: 1600×1200, otimizada.

**Whatsapp sticky button** (FAB global, novo):
- Componente `WhatsappFab` em `app/components/landing/whatsapp-fab.tsx`
- Position fixed bottom-right, ícone WhatsApp verde
- Link → `https://wa.me/{whatsappNumero}`
- Renderizado **apenas na landing** (na home)

### `Calculator`

**Arquivo:** `app/components/landing/calculator.tsx`

**Anchor:** `<section id="calculadora">`

**Visual (pixel-copy do card amarelo):**
- Wrapper section com padding vertical generoso e bg `brand-dark`
- Card centralizado (`max-w-5xl`), bg `#E8B912`, padding 8-12, rounded `xl`
- Título: `CALCULADORA DE FESTA` (black, font-display, bold, uppercase tracking)
- Subtítulo: "Não sabe quanto pedir? Faça uma simulação rápida para não faltar chopp." (black/80)
- Layout 2 colunas (`md:grid-cols-2 gap-8`):

**Coluna esquerda — inputs:**
1. `NÚMERO DE PESSOAS (BEBEM CHOPP)` — input number com ícone de pessoas, default `20`, min `1`
2. `DURAÇÃO DA FESTA (HORAS)` — input number com ícone de relógio, default `4`, min `1`
3. `ESTILO DE CONSUMO` — select dropdown:
   - `Moderado (Família/Tarde)` — fator 0.4
   - `Padrão (Churrasco/Festa)` — fator 0.5 (default)
   - `Alto (Balada/Open Bar)` — fator 0.7

Inputs: bg branco, border preto, padding generoso, font bold.

**Coluna direita — resultado:**
- Card preto (`bg-brand-black` ou `#1a1a1a`), padding 6
- Texto pequeno top: "VOCÊ VAI PRECISAR DE APROX." (white/60, uppercase, tracking)
- Número gigante: `40` (yellow, font-display, text-7xl) seguido de `LITROS` (white, smaller, uppercase)
- Disclaimer: "Cálculo aproximado. Recomendamos sempre uma margem de segurança." (gray, text-xs)
- CTA: `SOLICITAR ESSA QUANTIDADE` — yellow filled, black text, full-width pill, uppercase

**Algoritmo de cálculo:**
```ts
const FATORES = { moderado: 0.4, padrao: 0.5, alto: 0.7 } as const

const calcularLitros = (pessoas: number, horas: number, estilo: keyof typeof FATORES) => {
  const bruto = pessoas * horas * FATORES[estilo]
  return Math.ceil(bruto / 5) * 5  // arredonda pra cima em múltiplos de 5
}
```

Exemplo: `20 × 4 × 0.5 = 40` → 40 litros (bate com o exemplo deles).

**Algoritmo de mapeamento litros → barris** (greedy com tie-break por menor sobra):
```ts
const resolverCombo = (litros: number) => {
  // Tenta combinações com menos itens primeiro, escolhe a com menor sobra
  const combos: Array<{ b50: number; b30: number; total: number; sobra: number }> = []
  for (let b50 = 0; b50 <= Math.ceil(litros / 50); b50++) {
    for (let b30 = 0; b30 <= Math.ceil(litros / 30); b30++) {
      const total = b50 * 50 + b30 * 30
      if (total >= litros) combos.push({ b50, b30, total, sobra: total - litros })
    }
  }
  combos.sort((a, b) => a.sobra - b.sobra || (a.b50 + a.b30) - (b.b50 + b.b30))
  return combos[0]
}
```

Exemplos validados:
- 40L → `1× 50L` (sobra 10L)
- 60L → `2× 30L` (sobra 0L)
- 80L → `1× 50L + 1× 30L` (sobra 0L)
- 100L → `2× 50L` (sobra 0L)
- 120L → `2× 50L + 1× 30L` (sobra 10L) — tem empate com `4× 30L` mas menos itens vence

**Comportamento do CTA `SOLICITAR ESSA QUANTIDADE`:**
1. Calcula `litros` com inputs atuais
2. Resolve `combo = resolverCombo(litros)`
3. Busca os produtos chopp com `marca === "Pilsen Premium"` (default), `tipo === "chopp"`, `ativo === true`, `volume_litros ∈ {30, 50}`
   - Fallback: se Pilsen não existir, primeiro chopp ativo daquele volume
4. Adiciona ao `CartProvider` via API existente:
   - Atual: `addToCart(produto)` adiciona 1 unidade e auto-abre o drawer (linha `cart-context.tsx:65`)
   - **Pequeno refactor necessário**: estender pra `addToCart(produto, quantidade = 1)` pra adicionar N de uma vez. Sem isso, calculadora teria que chamar `addToCart` + `increaseItem` (combo.b50 - 1) vezes — feio.
   - Após refactor: `addToCart(produtoPilsen50L, combo.b50)` + `addToCart(produtoPilsen30L, combo.b30)` — ambos só se quantidade > 0
5. Drawer já abre automaticamente após `addToCart` — não precisa chamar `openCart()` separado
6. Toast/feedback: "Adicionamos {b50}× 50L + {b30}× 30L de Pilsen Premium ao carrinho. Você pode trocar a marca antes de finalizar."

**Edge cases:**
- `litros === 0` ou inputs inválidos: CTA fica disabled
- Algum volume necessário sem produto disponível: alert "Nenhum barril desse tamanho disponível agora — fale com a gente no WhatsApp" + link
- `litros > 200`: notice abaixo do CTA "Eventos grandes? Fale conosco para preço especial" + CTA secundário pra WhatsApp (não bloqueia o fluxo principal)

**Estado:** `useState` local para inputs. Sem persistência (resetar ao recarregar é OK).

### `FooterLanding`

**Arquivo:** `app/components/landing/footer-landing.tsx`

**Layout 4 colunas + bottom bar** (desktop `md:grid-cols-4`, mobile `grid-cols-1`):

**Col 1 — Brand:**
- Logo "ALFA CHOPP" (mesmo formato do header)
- Tagline: "Especialistas em levar o melhor chopp para o seu evento. Qualidade, pontualidade e serviço premium."
- Ícones sociais: Instagram + Facebook (links abertos em nova aba)

**Col 2 — LINKS RÁPIDOS** (header yellow uppercase, lista vertical):
- Início → `#home`
- Nossos Chopps → `#chopps`
- Calculadora → `#calculadora`
- Dúvidas Frequentes → `#faq`

**Col 3 — CONTATO** (header yellow uppercase):
- 📞 `(21) XXXXX-XXXX` — formatado a partir de `whatsapp_numero` da config
- ✉️ `contato@alfachopp.com.br` — hardcoded por enquanto
- 📍 "Atendemos toda a região metropolitana"

**Col 4 — SIGA NO INSTAGRAM** (header yellow uppercase):
- Grid 3×1 de thumbnails (placeholder no MVP — `app/public/landing/instagram/01.jpg` 02 03)
- Cada thumbnail link pro perfil deles
- Texto "Ver perfil completo →" abaixo

**Bottom bar:**
- Border-top yellow/10, padding compacto
- Esquerda: "© {ano} Alfa Chopp Express. Todos os direitos reservados."
- Direita: ícones SVG Pix, Visa, Mastercard, Elo (em `/public/landing/payment/`)

**Cores/tipografia:**
- Bg `brand-dark`
- Headers das colunas: `text-brand-yellow`, font-display, uppercase, tracking-wider
- Textos: `text-brand-warm-gray`
- Links: hover `text-brand-yellow`

**Anchors a adicionar no resto da landing** (pra os links do nav e footer funcionarem):
- `<section id="home">` no topo do hero
- `<section id="chopps">` no `<Storefront>` (ou wrapper)
- `<section id="calculadora">` no `Calculator` (já especificado)
- `<section id="faq">` no `<Faq>`

## Mudanças no `app/app/page.tsx`

- Imports trocam: `Header` → `HeaderLanding`, `Hero` → `HeroLanding`, `Footer` → `FooterLanding`
- Adiciona `<Calculator />` entre hero e Storefront
- Adiciona `<WhatsappFab />` ao final
- Mantém `Storefront`, `Features`, `Faq` como estão (só adiciona `id` se faltar)
- Continua chamando `getActiveProducts`, `getConfig("whatsapp_numero")`, `getConteudo(...)` no server side

## Componentes/arquivos a criar ou tocar

**Novos:**
```
app/
├── components/
│   └── landing/
│       ├── header-landing.tsx       (novo)
│       ├── hero-landing.tsx         (novo)
│       ├── calculator.tsx           (novo)
│       ├── footer-landing.tsx       (novo)
│       ├── whatsapp-fab.tsx         (novo)
│       └── calculator-utils.ts      (algoritmos puros, testáveis: calcularLitros, resolverCombo)
└── public/
    └── landing/
        ├── hero-chopp.jpg
        ├── instagram/
        │   ├── 01.jpg
        │   ├── 02.jpg
        │   └── 03.jpg
        └── payment/
            ├── pix.svg
            ├── visa.svg
            ├── mastercard.svg
            └── elo.svg
```

**Modificados:**
- `app/lib/cart-context.tsx` — estender assinatura de `addToCart` pra aceitar `quantidade?: number` (default 1)
- `app/app/page.tsx` — trocar imports e composição
- `app/components/storefront.tsx` (ou wherever a section do catálogo é renderizada) — adicionar `id="chopps"` na section
- `app/components/faq.tsx` — adicionar `id="faq"` na section

## O que NÃO está em escopo

- Mudanças no `Header` ou `Footer` antigos (ficam pra admin/checkout/etc.)
- Mudanças no checkout, admin, fluxo de documentos
- Integração real com Instagram API (placeholder no MVP)
- Multi-marca de chopp na calculadora (default Pilsen, pode trocar manual no carrinho)
- Mudança de `email_contato` na config (hardcoded por enquanto)
- Migrations de banco

## Critérios de sucesso

- Landing `/` visualmente próxima de alfachopp.com.br no hero, calculadora e footer
- Calculadora funcional: inputs ajustam o cálculo em tempo real, CTA adiciona barris ao carrinho real e abre o drawer
- Combo de barris correto pros valores de teste (40, 60, 80, 100, 120 litros)
- Anchors do header/footer rolam pras seções corretas
- WhatsApp FAB sticky, link funcional
- Outras páginas (admin, checkout, meus-pedidos) intactas (mesmos `Header`/`Footer`)
- Build + typecheck verdes no CI
- Sem erros no console em produção

## Riscos / suposições

- **Foto do hero**: vamos usar uma foto Unsplash similar à deles. Se o cliente quiser a deles exata, precisa fornecer.
- **Marca padrão "Pilsen Premium"**: assume que existe `marca === "Pilsen Premium"` com volumes 30L e 50L cadastrados. Vou verificar no banco antes de implementar; se faltar, criar via admin ou ajustar fallback.
- **Email contato hardcoded**: backlog adicionar `email_contato` na tabela `configuracoes`.
- **Instagram thumbnails**: placeholders no MVP. Backlog: integração com Basic Display API.
- **Cliente já tem `whatsapp_numero` configurado**: assume que o admin populou esse campo em `configuracoes`. Se vazio, fallback pro número hardcoded `5521999999999` (igual hoje).
