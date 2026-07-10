# Consignado — separar "a pagar" do "paga só se usar" (tela + mensagem)

**Data:** 2026-07-10
**Origem:** Pedido do cliente (Jean) via WhatsApp — pedidos com consignado saem para o cliente com o valor cheio, obrigando o Jean a mandar mensagem manual explicando que parte é consignado.

## Problema

Ao lançar um pedido manual com barris consignados, o total exibido e enviado é o **valor cheio** — todos os barris precificados como se fossem usados. O commit `8c2bae2` passou a incluir `💰 Valor total` na mensagem de confirmação; para pedidos com consignado isso agora expõe o número cheio sem contexto.

Consequência: o cliente recebe a confirmação com um valor maior do que ele realmente paga de imediato, e o Jean precisa mandar uma segunda mensagem manual ("1 barril é consignado, paga só se usar...").

### Estado atual (mecânica confirmada no código)

- Consignado é marcado **por linha** na criação (`manual-order-drawer.tsx`). Misturar firme + consignado do mesmo produto = duas linhas. Cada barril consignado nasce `pendente` e é acertado depois (`usado`/`devolvido`) na tela de detalhe.
- `pedido.total` guarda o **valor cheio** de propósito: `calculateStoredTotals` usa `subtotalMax` (firmes + consignado ainda-não-devolvido), abatendo os devolvidos só no acerto. Isso é uma decisão de contabilidade — não muda.
- A mensagem de confirmação (`confirmacao-message.ts` + `notificacoes.ts`) recebe só `pedido.total` e não tem noção de consignado.
- O resumo do drawer mostra `Subtotal (=subtotalMax) / Frete / Total`, sem separar consignado.

## Objetivo

Deixar claro, tanto na **tela de criação** quanto na **mensagem ao cliente**, quanto o cliente paga de fato agora (firmes + frete) e quanto é consignado (paga só se usar). Sem mudar o valor guardado no banco nem a lógica de acerto.

## Abordagem escolhida — só display + mensagem

`pedido.total` continua sendo o valor cheio no banco. A mudança é puramente de **apresentação** (resumo do drawer) e **texto** (mensagem de confirmação). Sem migration, sem coluna nova, sem alterar o fluxo de acerto (settlement).

Alternativas descartadas:
- **Guardar "valor firme" no banco** (coluna/migration): rippla em relatórios, acerto e edição para uma dor que é de comunicação. YAGNI.
- **Marcar consignado por barril na criação**: reforma de UX grande; não é o que foi pedido. YAGNI.

## Definições (uma fórmula só, usada em todo lugar)

Para um conjunto de itens com `subtotal` e `is_consignado`:

```
consignado    = Σ subtotal dos itens consignados (não devolvidos)
totalCheio    = pedido.total  (= subtotalMax − desconto + frete)
aPagar        = totalCheio − consignado   (= firmes + frete − desconto)
firmes        = totalCheio − consignado − frete + desconto  (para exibição no drawer)
hasConsignado = consignado > 0
```

`aPagar = totalCheio − consignado` é a única definição, idêntica no drawer e no servidor — garante que a tela e a mensagem sempre batem.

## Mudanças

### 1. Helper puro em `app/lib/pricing.ts`

Nova função `consignadoSplit(items, frete, desconto)` que retorna `{ firmes, consignado, aPagar, totalCheio, hasConsignado }`, reaproveitando `calculateStoredTotals`/`calculateOrderTotals` já existentes. Pura e testável.

### 2. Resumo do drawer — `manual-order-drawer.tsx`

Quando `hasConsignado`, trocar o bloco `Subtotal / Frete / Total` por:

```
A pagar agora            R$ 580,00     ← destaque (amarelo/negrito)
  Firmes                 R$ 550,00
  Frete                  R$  30,00
Consignado (só se usar)  R$ 800,00
─────────────────────────────────
Total se usar tudo       R$ 1.380,00
No acerto a gente abate os barris devolvidos.
```

Sem consignado: mantém exatamente o layout atual (`Subtotal / Frete / Total`).

Computação vem do `consignadoSplit` aplicado aos `itemRowsForTotals` que o componente já monta (mais o `frete`; desconto = 0 no drawer, que não tem campo de desconto).

### 3. Mensagem de confirmação — `confirmacao-message.ts` + `notificacoes.ts`

Consignado é armazenado **1 linha por barril** (`quantidade=1` cada — ver `pedido-edit.ts` `createManualOrder`), então 3 barris consignados = 3 linhas de `pedido_itens`. Para a mensagem não repetir "1x Donzela (consignado)" três vezes, as linhas são **agrupadas por `(produto, is_consignado)`** somando a quantidade — helper puro `summarizeConfirmationItens` (co-locado em `confirmacao-message.ts`), que também soma o `consignadoTotal`. O `consignadoTotal` sai das linhas cruas (antes do agrupamento); o agrupamento afeta só a lista exibida.

`notificacoes.ts` passa a selecionar `produto_id, is_consignado, subtotal` de `pedido_itens`, chama `summarizeConfirmationItens` e repassa `itens` (agrupados, com `is_consignado`) + `consignadoTotal` a `buildConfirmationMessage`.

`buildConfirmationMessage` ganha:
- Itens consignados anotados na lista: `• 2x Donzela 50L (consignado)`.
- Quando `consignadoTotal > 0`, o bloco de valor vira:

```
💰 *A pagar:* R$ 580,00
📦 *Consignado (paga só se usar):* R$ 800,00
💳 *Pagamento:* PIX
```

- Rodapé discreto (itálico WhatsApp) após o bloco de evento:

```
_Total se usar tudo: R$ 1.380,00_
```

Quando `consignadoTotal == 0` (pedido de checkout do cliente, ou manual sem consignado): mensagem **idêntica à atual** (`💰 *Valor total:* …`, sem anotação de item, sem rodapé). Fallback por construção — nenhum pedido sem consignado muda.

## Casos de borda

- **Pedido todo consignado** (como no print do Jean, 3 barris consignados): `aPagar = frete`, `consignado = subtotal cheio`. Fica correto e esclarecedor.
- **Desconto** (via edição): `aPagar = totalCheio − consignado` já absorve o desconto corretamente, pois `totalCheio = pedido.total`.
- **`pago = true` + consignado**: cenário contraditório (não dá pra pré-pagar consignado). Fora de escopo; a mensagem mantém o rótulo "A pagar" sem tratamento especial.

## Testes

- `confirmacao-message.test.ts`:
  - `summarizeConfirmationItens`: agrupa 3 barris consignados do mesmo produto em `3x … (consignado)`; preserva linha firme; soma `consignadoTotal`; mantém ordem.
  - `buildConfirmationMessage`: caso com consignado (quebra `A pagar`/`Consignado` + anotação de item + rodapé); caso sem consignado (**byte-a-byte igual ao atual** — params novos opcionais); caso todo-consignado.
- `pricing.test.ts`: `consignadoSplit` — sem consignado, misto (1 firme + 2 consignado), todo consignado, com desconto.

## Fora de escopo

- Alterar `pedido.total` armazenado ou a lógica de acerto (`settleConsignado`).
- Consignado no checkout do cliente (não existe hoje).
- Marcação de consignado por barril.
