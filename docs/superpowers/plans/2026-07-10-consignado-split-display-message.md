# Consignado split (tela + mensagem) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, na tela de criação de pedido manual e na mensagem de confirmação ao cliente, o valor "a pagar agora" (firmes + frete) separado do consignado (paga só se usar), em vez do valor cheio.

**Architecture:** Mudança só de apresentação e texto. `pedido.total` continua o valor cheio no banco; a lógica de acerto (settlement) não muda. Uma fórmula única — `aPagar = totalCheio − consignado` — alimenta tanto o resumo do drawer quanto a mensagem. Toda a matemática vive em helpers puros e testados (`consignadoSplit` em `pricing.ts`; `summarizeConfirmationItens` em `confirmacao-message.ts`).

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Vitest, Tailwind v4. Sem migration, sem mudança de banco.

**Spec:** `docs/superpowers/specs/2026-07-10-consignado-split-display-message-design.md`

## Global Constraints

- `pedido.total` armazenado **não muda** — a mudança é display + texto. Nenhuma migration.
- Pedido **sem** consignado (checkout do cliente, ou manual sem consignado): a mensagem tem que sair **byte-a-byte igual à atual**. Os novos parâmetros de `buildConfirmationMessage` são **opcionais** com default = comportamento antigo.
- Consignado é gravado **1 linha por barril** (`quantidade=1`) em `pedido_itens`. `consignadoTotal` = soma de `subtotal` das linhas `is_consignado` (linhas cruas, antes de qualquer agrupamento).
- `formatBRL` (pt-BR) produz `R$ 1.380,00` (ponto de milhar, vírgula decimal, espaço normal após `R$`). As assertions de string dependem disso.
- Rodar comandos a partir de `app/`. Commits pequenos e frequentes (um por task).
- Reaproveitar helpers existentes de `pricing.ts` (`calculateStoredTotals`, `round2`) — DRY.

---

### Task 1: Helper `consignadoSplit` em `pricing.ts`

Fonte única da fórmula `aPagar = totalCheio − consignado`, usada pelo drawer (Task 3). Pura e testável.

**Files:**
- Modify: `app/lib/pricing.ts` (adicionar ao final)
- Test: `app/lib/pricing.test.ts` (adicionar describe ao final)

**Interfaces:**
- Consumes: `OrderItemForTotals` (`{ subtotal, is_consignado, consignado_status }`), `calculateStoredTotals`, `round2` — já existentes em `pricing.ts`.
- Produces: `consignadoSplit(items: OrderItemForTotals[], frete: number, desconto: number): ConsignadoSplit` onde `ConsignadoSplit = { firmes: number; consignado: number; aPagar: number; totalCheio: number; hasConsignado: boolean }`.

- [ ] **Step 1: Write the failing test**

Adicionar ao final de `app/lib/pricing.test.ts`. Primeiro, incluir `consignadoSplit` no import existente da linha 2:

```ts
import { calculateLine, getBasePrice, calculateOrderTotals, calculateStoredTotals, priceManualOrderLines, consignadoSplit } from "./pricing"
```

Depois, o novo bloco no final do arquivo:

```ts
describe("consignadoSplit", () => {
  const item = (subtotal: number, is_consignado = false, consignado_status: string | null = null) => ({
    subtotal,
    is_consignado,
    consignado_status,
  })

  it("sem consignado: firmes = subtotal, consignado = 0, hasConsignado false", () => {
    const r = consignadoSplit([item(500), item(500)], 50, 0)
    expect(r).toEqual({ firmes: 1000, consignado: 0, aPagar: 1050, totalCheio: 1050, hasConsignado: false })
  })

  it("misto (1 firme + 2 consignado): separa a pagar do consignado", () => {
    const r = consignadoSplit([item(550), item(400, true, "pendente"), item(400, true, "pendente")], 30, 0)
    expect(r).toEqual({ firmes: 550, consignado: 800, aPagar: 580, totalCheio: 1380, hasConsignado: true })
  })

  it("todo consignado: a pagar = so o frete", () => {
    const r = consignadoSplit(
      [item(550, true, "pendente"), item(400, true, "pendente"), item(400, true, "pendente")],
      30,
      0,
    )
    expect(r).toEqual({ firmes: 0, consignado: 1350, aPagar: 30, totalCheio: 1380, hasConsignado: true })
  })

  it("desconto abate do a pagar (firme), nao do consignado", () => {
    const r = consignadoSplit([item(550), item(400, true, "pendente")], 0, 50)
    expect(r).toEqual({ firmes: 550, consignado: 400, aPagar: 500, totalCheio: 900, hasConsignado: true })
  })

  it("consignado devolvido nao conta como consignado nem como a pagar", () => {
    const r = consignadoSplit([item(550), item(400, true, "devolvido")], 0, 0)
    expect(r).toEqual({ firmes: 550, consignado: 0, aPagar: 550, totalCheio: 550, hasConsignado: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run lib/pricing.test.ts`
Expected: FAIL — `consignadoSplit is not a function` / import não resolve.

- [ ] **Step 3: Write minimal implementation**

Adicionar ao final de `app/lib/pricing.ts` (após `calculateStoredTotals`). `round2` e `calculateStoredTotals` já existem no arquivo:

```ts
export type ConsignadoSplit = {
  firmes: number
  consignado: number
  aPagar: number
  totalCheio: number
  hasConsignado: boolean
}

// Separa, para EXIBIÇÃO, o valor firme (pago com certeza) do consignado (paga só se usar).
// aPagar = totalCheio − consignado é a única definição — idêntica no drawer e na mensagem, para
// tela e WhatsApp sempre baterem. Não altera o valor cheio armazenado no pedido.
export const consignadoSplit = (
  items: OrderItemForTotals[],
  frete: number,
  desconto: number,
): ConsignadoSplit => {
  const consignado = round2(
    items
      .filter((i) => i.is_consignado && i.consignado_status !== "devolvido")
      .reduce((sum, i) => sum + i.subtotal, 0),
  )
  const { total: totalCheio } = calculateStoredTotals(items, frete, desconto)
  const aPagar = round2(totalCheio - consignado)
  const firmes = round2(aPagar - frete + desconto)
  return { firmes, consignado, aPagar, totalCheio, hasConsignado: consignado > 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run lib/pricing.test.ts`
Expected: PASS (todos os describes do arquivo, incluindo `consignadoSplit`).

- [ ] **Step 5: Commit**

```bash
cd app && git add lib/pricing.ts lib/pricing.test.ts
git commit -m "feat(pricing): consignadoSplit helper (a pagar vs consignado)"
```

---

### Task 2: Mensagem de confirmação separa consignado

Agrupa os barris consignados (1 linha por barril no banco) numa lista limpa, soma o `consignadoTotal`, e quebra o bloco de valor em "A pagar" + "Consignado (paga só se usar)" + rodapé "Total se usar tudo". Sem consignado, a mensagem fica idêntica à de hoje.

**Files:**
- Modify: `app/lib/whatsapp/confirmacao-message.ts`
- Modify: `app/lib/whatsapp/notificacoes.ts:37-59` (query dos itens + chamada do builder)
- Test: `app/lib/whatsapp/confirmacao-message.test.ts` (adicionar describes; os existentes devem continuar passando sem edição)

**Interfaces:**
- Consumes: `consignadoSplit` não é usado aqui (o servidor já tem `pedido.total`). `formatBRL`, `firstName`, `shortId`, `formatTime`, `formatEventDate`, `metodoPagamentoLabel` — já importados no arquivo.
- Produces:
  - `summarizeConfirmationItens(rows: ConfirmationItemRow[]): { itens: ConfirmationItem[]; consignadoTotal: number }`
    - `ConfirmationItemRow = { produto_id: string; quantidade: number; subtotal: number; is_consignado: boolean; marca: string; volume: number }`
    - `ConfirmationItem = { quantidade: number; marca: string; volume: number; is_consignado: boolean }`
  - `buildConfirmationMessage` ganha campos opcionais: `itens[].is_consignado?: boolean` e `consignadoTotal?: number` (mantém a assinatura retrocompatível).

- [ ] **Step 1: Write the failing test**

No topo de `app/lib/whatsapp/confirmacao-message.test.ts`, ajustar o import (linha 2) para incluir o novo helper:

```ts
import { buildConfirmationMessage, summarizeConfirmationItens } from "./confirmacao-message"
```

Adicionar ao final do arquivo (NÃO tocar nos testes existentes):

```ts
describe("summarizeConfirmationItens", () => {
  const row = (
    produto_id: string,
    quantidade: number,
    subtotal: number,
    is_consignado: boolean,
    marca: string,
    volume: number,
  ) => ({ produto_id, quantidade, subtotal, is_consignado, marca, volume })

  it("agrupa barris consignados do mesmo produto em uma linha e soma o valor", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 1, 550, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
    ])
    expect(itens).toEqual([{ quantidade: 3, marca: "Donzela", volume: 50, is_consignado: true }])
    expect(consignadoTotal).toBe(1350)
  })

  it("mantem firme e consignado do mesmo produto em linhas separadas, na ordem de entrada", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 1, 550, false, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
    ])
    expect(itens).toEqual([
      { quantidade: 1, marca: "Donzela", volume: 50, is_consignado: false },
      { quantidade: 2, marca: "Donzela", volume: 50, is_consignado: true },
    ])
    expect(consignadoTotal).toBe(800)
  })

  it("consignadoTotal e 0 quando nao ha consignado", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 2, 1000, false, "Vila Imperio", 50),
    ])
    expect(itens).toEqual([{ quantidade: 2, marca: "Vila Imperio", volume: 50, is_consignado: false }])
    expect(consignadoTotal).toBe(0)
  })
})

describe("buildConfirmationMessage — consignado", () => {
  const base = {
    clienteNome: "Joao Silva",
    pedidoId: "3b3a7901-aaaa-bbbb-cccc-dddddddddddd",
    dataEvento: "2026-07-25",
    horarioEvento: "17:00:00",
    metodoPagamento: "pix",
  }

  it("quebra A pagar + Consignado, anota o item consignado e mostra o rodape", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [
        { quantidade: 1, marca: "Donzela", volume: 50, is_consignado: false },
        { quantidade: 2, marca: "Donzela", volume: 50, is_consignado: true },
      ],
      total: 1380,
      consignadoTotal: 800,
    })
    expect(msg).toContain("• 1x Donzela 50L\n• 2x Donzela 50L (consignado)")
    expect(msg).toContain("💰 *A pagar:* R$ 580,00")
    expect(msg).toContain("📦 *Consignado (paga só se usar):* R$ 800,00")
    expect(msg).toContain("_Total se usar tudo: R$ 1.380,00_")
    expect(msg).not.toContain("*Valor total:*")
  })

  it("sem consignadoTotal: formato antigo (Valor total, sem rodape nem 'A pagar')", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [{ quantidade: 2, marca: "Vila Imperio", volume: 50, is_consignado: false }],
      total: 1000,
    })
    expect(msg).toContain("💰 *Valor total:* R$ 1.000,00")
    expect(msg).not.toContain("A pagar")
    expect(msg).not.toContain("Total se usar tudo")
  })

  it("todo consignado: a pagar mostra so o frete embutido no total", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [{ quantidade: 3, marca: "Donzela", volume: 50, is_consignado: true }],
      total: 1380,
      consignadoTotal: 1350,
    })
    expect(msg).toContain("💰 *A pagar:* R$ 30,00")
    expect(msg).toContain("📦 *Consignado (paga só se usar):* R$ 1.350,00")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run lib/whatsapp/confirmacao-message.test.ts`
Expected: FAIL — `summarizeConfirmationItens is not a function`; os novos casos de `buildConfirmationMessage` também falham.

- [ ] **Step 3: Write minimal implementation**

Reescrever `app/lib/whatsapp/confirmacao-message.ts` inteiro:

```ts
// Mensagem de confirmação enviada ao cliente quando o pedido é criado (checkout ou pedido manual).
// Formato "WhatsApp": linhas curtas + itens em lista (•), *negrito* nos rótulos. Função pura/testada;
// o envio em si fica em notificacoes.ts.

import { formatEventDate, firstName, shortId, formatTime, formatBRL, metodoPagamentoLabel } from "@/lib/format"

export type ConfirmationItemRow = {
  produto_id: string
  quantidade: number
  subtotal: number
  is_consignado: boolean
  marca: string
  volume: number
}

export type ConfirmationItem = {
  quantidade: number
  marca: string
  volume: number
  is_consignado: boolean
}

const round2 = (value: number) => Number(value.toFixed(2))

// Consignado é gravado 1 linha por barril; agrupa por (produto, consignado) somando a quantidade
// para uma lista limpa ("2x Donzela (consignado)" em vez de "1x" três vezes), e soma o valor
// consignado a partir das linhas CRUAS (antes do agrupamento).
export const summarizeConfirmationItens = (
  rows: ConfirmationItemRow[],
): { itens: ConfirmationItem[]; consignadoTotal: number } => {
  const grouped = new Map<string, ConfirmationItem>()
  for (const row of rows) {
    const key = `${row.produto_id}|${row.is_consignado}`
    const existing = grouped.get(key)
    if (existing) {
      existing.quantidade += row.quantidade
    } else {
      grouped.set(key, {
        quantidade: row.quantidade,
        marca: row.marca,
        volume: row.volume,
        is_consignado: row.is_consignado,
      })
    }
  }
  const consignadoTotal = round2(
    rows.filter((row) => row.is_consignado).reduce((sum, row) => sum + row.subtotal, 0),
  )
  return { itens: [...grouped.values()], consignadoTotal }
}

export const buildConfirmationMessage = (data: {
  clienteNome: string
  pedidoId: string
  itens: { quantidade: number; marca: string; volume: number; is_consignado?: boolean }[]
  dataEvento: string
  horarioEvento: string
  total: number
  metodoPagamento: string | null
  consignadoTotal?: number
}): string => {
  const consignado = data.consignadoTotal ?? 0
  const hasConsignado = consignado > 0
  const aPagar = round2(data.total - consignado)

  const itensList = data.itens
    .map((item) => `• ${item.quantidade}x ${item.marca} ${item.volume}L${item.is_consignado ? " (consignado)" : ""}`)
    .join("\n")

  const valorLinhas = hasConsignado
    ? [
        `💰 *A pagar:* ${formatBRL(aPagar)}`,
        `📦 *Consignado (paga só se usar):* ${formatBRL(consignado)}`,
      ]
    : [`💰 *Valor total:* ${formatBRL(data.total)}`]

  const rodapeConsignado = hasConsignado ? [``, `_Total se usar tudo: ${formatBRL(data.total)}_`] : []

  return [
    `Olá, ${firstName(data.clienteNome)}! 🍻 Recebemos seu pedido!`,
    ``,
    `*Pedido #${shortId(data.pedidoId)}*`,
    itensList,
    ``,
    ...valorLinhas,
    `💳 *Pagamento:* ${metodoPagamentoLabel(data.metodoPagamento)}`,
    ``,
    `📅 *Evento:* ${formatEventDate(data.dataEvento)} às ${formatTime(data.horarioEvento)}`,
    ...rodapeConsignado,
    ``,
    `Já já confirmamos tudo com você por aqui 😊`,
    `— ALFA Chopp Delivery`,
  ].join("\n")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run lib/whatsapp/confirmacao-message.test.ts`
Expected: PASS — os 9 testes antigos (byte-a-byte) + os novos describes. Se algum teste antigo quebrar, o formato retrocompatível foi perdido; corrigir antes de seguir.

- [ ] **Step 5: Ligar o `notificacoes.ts` para passar os dados de consignado**

Em `app/lib/whatsapp/notificacoes.ts`, adicionar o import do helper (junto do import existente de `buildConfirmationMessage`, linha 12):

```ts
import { buildConfirmationMessage, summarizeConfirmationItens } from "./confirmacao-message"
```

Substituir o bloco da query de itens + construção da mensagem (linhas 37-59) por:

```ts
    const { data: rawItems } = await supabase
      .from("pedido_itens")
      .select("produto_id, quantidade, subtotal, is_consignado, produtos(marca, volume_litros)")
      .eq("pedido_id", pedidoId)

    const rows = (rawItems ?? []).map((row) => {
      const produto = Array.isArray(row.produtos) ? row.produtos[0] : row.produtos
      return {
        produto_id: row.produto_id,
        quantidade: row.quantidade,
        subtotal: Number(row.subtotal),
        is_consignado: !!row.is_consignado,
        marca: produto?.marca ?? "Item",
        volume: produto?.volume_litros ?? 0,
      }
    })

    const { itens, consignadoTotal } = summarizeConfirmationItens(rows)

    const mensagem = buildConfirmationMessage({
      clienteNome: cliente?.nome ?? "Cliente",
      pedidoId,
      itens,
      dataEvento: pedido.data_evento,
      horarioEvento: pedido.horario_evento,
      total: Number(pedido.total),
      metodoPagamento: pedido.metodo_pagamento,
      consignadoTotal,
    })
```

- [ ] **Step 6: Typecheck**

Run: `cd app && npm run typecheck`
Expected: PASS (sem erros). Isso valida que a query estendida e a chamada do builder tipam certo.

- [ ] **Step 7: Commit**

```bash
cd app && git add lib/whatsapp/confirmacao-message.ts lib/whatsapp/confirmacao-message.test.ts lib/whatsapp/notificacoes.ts
git commit -m "feat(whatsapp): confirmacao separa a-pagar do consignado (paga so se usar)"
```

---

### Task 3: Resumo do drawer separa "A pagar agora" do consignado

Troca o bloco Subtotal/Frete/Total do resumo por A pagar agora / Firmes / Frete / Consignado / Total se usar tudo — só quando o pedido tem consignado. Sem consignado, mantém o layout de hoje. A matemática vem de `consignadoSplit` (Task 1), então não há novo cálculo aqui.

**Files:**
- Modify: `app/components/admin/manual-order-drawer.tsx` (import; remover `hasConsignado`/`total` locais; computar `split`; JSX do resumo, linhas 415-433)

**Interfaces:**
- Consumes: `consignadoSplit` (Task 1). O componente já monta `itemRowsForTotals` no formato `OrderItemForTotals`.

- [ ] **Step 1: Adicionar `consignadoSplit` ao import de pricing**

Em `app/components/admin/manual-order-drawer.tsx` linha 11:

```ts
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit } from "@/lib/pricing"
```

- [ ] **Step 2: Calcular o split e remover as variáveis agora redundantes**

Substituir as linhas 153 e 167-169:

Linha 153 — remover:
```ts
  const hasConsignado = items.some((i) => i.is_consignado)
```

Linhas 167-169 — de:
```ts
  const totals = calculateOrderTotals(itemRowsForTotals)
  // Valor cheio: consignado conta no total (abatido só no acerto), então mostramos o máximo — não R$ 0.
  const total = totals.subtotalMax + frete
```
para:
```ts
  const totals = calculateOrderTotals(itemRowsForTotals)
  // Resumo: separa "a pagar agora" (firmes + frete) do consignado. Valor cheio segue em split.totalCheio.
  const split = consignadoSplit(itemRowsForTotals, frete, 0)
```

(O drawer não tem campo de desconto, então `desconto = 0`.)

- [ ] **Step 3: Trocar o JSX do resumo (bloco das linhas 415-433)**

Substituir o `<div className="bg-brand-dark ...">` do resumo (o bloco que hoje mostra Subtotal/Frete/Total + a nota de consignado) por:

```tsx
            <div className="bg-brand-dark border border-white/10 rounded-lg p-3 text-sm space-y-1">
              {split.hasConsignado ? (
                <>
                  <div className="flex justify-between text-white font-bold">
                    <span>A pagar agora</span>
                    <span className="text-brand-yellow tabular-nums">{formatBRL(split.aPagar)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray text-xs">
                    <span className="pl-2">Firmes</span>
                    <span className="tabular-nums">{formatBRL(split.firmes)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray text-xs">
                    <span className="pl-2">Frete</span>
                    <span className="tabular-nums">{formatBRL(frete)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray">
                    <span>Consignado (só se usar)</span>
                    <span className="tabular-nums">{formatBRL(split.consignado)}</span>
                  </div>
                  <div className="flex justify-between text-white border-t border-white/10 pt-1.5 mt-1">
                    <span>Total se usar tudo</span>
                    <span className="tabular-nums">{formatBRL(split.totalCheio)}</span>
                  </div>
                  <p className="text-[11px] text-brand-warm-gray pt-1">
                    No acerto a gente abate os barris devolvidos.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-brand-warm-gray">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatBRL(totals.subtotalMax)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray">
                    <span>Frete</span>
                    <span className="tabular-nums">{formatBRL(frete)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1.5 mt-1">
                    <span>Total</span>
                    <span className="text-brand-yellow tabular-nums">{formatBRL(split.totalCheio)}</span>
                  </div>
                </>
              )}
            </div>
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd app && npm run typecheck && npm run lint`
Expected: PASS. Sem `hasConsignado`/`total` órfãos (removidos no Step 2); sem variável não usada.

- [ ] **Step 5: Build**

Run: `cd app && npm run build`
Expected: build Next completa sem erro.

- [ ] **Step 6: Commit**

```bash
cd app && git add components/admin/manual-order-drawer.tsx
git commit -m "feat(admin): resumo do pedido manual separa a-pagar do consignado"
```

---

### Task 4: Verificação end-to-end

Roda a suíte inteira e valida o resumo do drawer no navegador (staging). O envio real de WhatsApp é gated por `whatsapp_confirmacao_ativo` + pareamento do número — se estiver off, a mensagem já está coberta pelos testes unitários do builder (Task 2); não bloquear por isso.

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa + gates de CI**

Run: `cd app && npm test && npm run typecheck && npm run build`
Expected: testes verdes (os antigos de confirmação inclusos, provando o fallback byte-a-byte), typecheck limpo, build ok.

- [ ] **Step 2: Drive no navegador (staging)**

Abrir o admin (staging), `Novo pedido manual`, adicionar um produto que tenha `preco_segundo_barril` (ex.: Donzela 50L), quantidade ≥ 1, marcar **Consignado**, pôr um frete. Conferir no resumo:
- "A pagar agora" = firmes + frete (destaque amarelo).
- "Consignado (só se usar)" com o valor dos barris.
- "Total se usar tudo" = valor cheio.
Desmarcar consignado → resumo volta a Subtotal/Frete/Total.

- [ ] **Step 3: (Opcional, se o número estiver pareado + flag on) confirmar a mensagem real**

Criar um pedido manual de teste com consignado para um telefone controlado e conferir a mensagem recebida: bloco "A pagar" / "Consignado (paga só se usar)" + rodapé "Total se usar tudo". Se o bot estiver off, registrar como pendente e seguir — coberto por unit test.

---

## Notas de implementação

- **Sem migration.** `pedido.total` continua o valor cheio; `settleConsignado`/`recalcPedidoTotals` intactos.
- **Retrocompat da mensagem** é a restrição mais delicada: os 9 testes existentes de `buildConfirmationMessage` NÃO devem ser editados e têm que passar. Eles são o gate do fallback sem-consignado.
- **Ordem das tasks importa:** Task 3 depende de `consignadoSplit` (Task 1). Task 2 é independente das outras duas.
