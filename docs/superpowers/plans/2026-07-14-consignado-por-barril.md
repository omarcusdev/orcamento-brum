# Consignado por barril — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No drawer de criar pedido manual, trocar o checkbox "Consignado" tudo-ou-nada por um toggle Firme/Consignado por barril (barril nasce Firme), mantendo server/schema/pricing intactos via achatamento pros itens-wire existentes.

**Architecture:** `DraftItem` vira `{ produto_id, barrels: boolean[] }`. Uma função pura nova `priceBarrels` rotula o preço de cada barril (firme-first, consistente com `priceManualOrderLines`). No preview e no submit, cada linha achata pros itens-wire `{ produto_id, quantidade, is_consignado }` já consumidos por `priceManualOrderLines`/`createManualOrder` — nenhum deles muda. A trava `hasFirmeItem` opera no array achatado.

**Tech Stack:** TypeScript, React 19, Next.js 15, Vitest.

## Global Constraints

- Barril novo nasce **Firme** (`is_consignado = false`).
- `priceBarrels` é a única fonte do preço-por-barril de exibição; não reimplementar a regra de 2º-barril na mão.
- `pricing.ts` (fora do novo helper), `schemas.ts`, `createManualOrder`, `priceManualOrderLines`, `hasFirmeItem` ficam **inalterados**.
- Escopo: só `manual-order-drawer.tsx`. Não tocar `edit-order-drawer.tsx`.
- CI pula vitest — rodar `npx vitest run` local antes de pronto.

---

### Task 1: Função pura `priceBarrels`

**Files:**
- Modify: `app/lib/pricing.ts` (adicionar após `barrelUnitPrices`, ~L66)
- Test: `app/lib/pricing.test.ts`

**Interfaces:**
- Produces:
  - `type BarrelPrice = { is_consignado: boolean; preco: number }`
  - `priceBarrels(produto: ProdutoForPricing, barrels: readonly boolean[], metodoPagamento?: PaymentMethod): BarrelPrice[]`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `app/lib/pricing.test.ts`. Importar `priceBarrels` no import de `./pricing` do topo (junto de `barrelUnitPrices`).

```ts
describe("priceBarrels", () => {
  const brahma = { id: "b", preco_avista: 880, preco_cartao: null, preco_segundo_barril: 750 }
  it("1 firme = preco cheio", () => {
    expect(priceBarrels(brahma, [false])).toEqual([{ is_consignado: false, preco: 880 }])
  })
  it("2 firme = cheio + 2o barril", () => {
    expect(priceBarrels(brahma, [false, false])).toEqual([
      { is_consignado: false, preco: 880 },
      { is_consignado: false, preco: 750 },
    ])
  })
  it("1 firme + 1 consignado = firme cheio, consignado 2o", () => {
    expect(priceBarrels(brahma, [false, true])).toEqual([
      { is_consignado: false, preco: 880 },
      { is_consignado: true, preco: 750 },
    ])
  })
  it("firme leva o preco cheio mesmo com consignado antes na ordem da UI", () => {
    expect(priceBarrels(brahma, [true, false])).toEqual([
      { is_consignado: true, preco: 750 },
      { is_consignado: false, preco: 880 },
    ])
  })
  it("tudo consignado: 1o consignado cheio, resto 2o barril", () => {
    expect(priceBarrels(brahma, [true, true])).toEqual([
      { is_consignado: true, preco: 880 },
      { is_consignado: true, preco: 750 },
    ])
  })
  it("soma bate com priceManualOrderLines no mesmo conjunto achatado (misto)", () => {
    const barrels = [false, true, true]
    const perBarrel = priceBarrels(brahma, barrels).reduce((s, b) => s + b.preco, 0)
    const wire = [
      { produto_id: "b", quantidade: 1, is_consignado: false },
      { produto_id: "b", quantidade: 2, is_consignado: true },
    ]
    const viaLines = priceManualOrderLines(wire, [brahma]).reduce((s, l) => s + l.subtotal, 0)
    expect(perBarrel).toBe(viaLines)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx vitest run lib/pricing.test.ts -t priceBarrels`
Expected: FAIL — `priceBarrels is not a function`.

- [ ] **Step 3: Implementar o mínimo**

Em `app/lib/pricing.ts`, após o `export const barrelUnitPrices = ...` (~L66):

```ts
export type BarrelPrice = { is_consignado: boolean; preco: number }

// Preço de cada barril na ORDEM DA UI, consistente com priceManualOrderLines: firme-first por
// produto — o 1º barril do produto custa o preço cheio, o 2º+ custa o preço de 2º-barril.
// firmeCount empurra os consignado pra depois dos firmes; se firmeCount===0 o 1º consignado é o cheio.
export const priceBarrels = (
  produto: ProdutoForPricing,
  barrels: readonly boolean[],
  metodoPagamento: PaymentMethod = "pix",
): BarrelPrice[] => {
  const { firstUnitPrice, secondUnitPrice } = barrelUnitPrices(produto, metodoPagamento)
  const firmeCount = barrels.filter((isConsignado) => !isConsignado).length
  let firmeSeen = 0
  let consignadoSeen = 0
  return barrels.map((isConsignado) => {
    const position = isConsignado ? firmeCount + consignadoSeen++ : firmeSeen++
    return { is_consignado: isConsignado, preco: position === 0 ? firstUnitPrice : secondUnitPrice }
  })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx vitest run lib/pricing.test.ts`
Expected: PASS (toda a suíte de pricing).

- [ ] **Step 5: Commit**

```bash
git add app/lib/pricing.ts app/lib/pricing.test.ts
git commit -m "feat(consignado): pure priceBarrels — per-barrel firme/consignado pricing"
```

---

### Task 2: Drawer — toggle firme/consignado por barril

**Files:**
- Modify: `app/components/admin/manual-order-drawer.tsx`

**Interfaces:**
- Consumes: `priceBarrels` de `@/lib/pricing`.

> Sem teste unitário (drawer não tem harness RTL). Verificação: typecheck + build + eyeball em staging.

- [ ] **Step 1: Import — trocar a linha de import de pricing (L11)**

De:
```ts
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit, hasFirmeItem, REQUIRE_FIRME_MESSAGE } from "@/lib/pricing"
```
Para:
```ts
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit, hasFirmeItem, REQUIRE_FIRME_MESSAGE, priceBarrels } from "@/lib/pricing"
```
E remover `Checkbox` do import de `@/components/ui` (deixa de ser usado). Remover também o helper `describeBarrels` (L50-57, deixa de ser usado).

- [ ] **Step 2: Modelo — `DraftItem` (L36-40)**

De `{ produto_id, quantidade, is_consignado }` para:
```ts
type DraftItem = {
  produto_id: string
  barrels: boolean[] // cada = isConsignado; barril novo nasce firme (false)
}
```

- [ ] **Step 3: `addItem` + operações de barril (L136-152)**

Trocar `addItem`/`updateItem`/`removeItem` por:
```ts
  const addItem = () => {
    if (produtos.length === 0) return
    setItems((prev) => [...prev, { produto_id: produtos[0].id, barrels: [false] }])
  }

  const setItemProduto = (idx: number, produto_id: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, produto_id } : it)))

  const setItemQty = (idx: number, qty: number) =>
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const next = Math.max(1, Math.min(100, Math.floor(qty)))
      const barrels = it.barrels.slice(0, next)
      while (barrels.length < next) barrels.push(false) // barris novos nascem firme
      return { ...it, barrels }
    }))

  const setBarrelConsignado = (idx: number, barrelIdx: number, isConsignado: boolean) =>
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, barrels: it.barrels.map((b, bi) => (bi === barrelIdx ? isConsignado : b)) } : it,
    ))

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }
```

- [ ] **Step 4: Achatar pros itens-wire + preview (substituir L154 `pricedLines`)**

Inserir `wireItems` antes de `pricedLines` e trocar a fonte de `priceManualOrderLines`:
```ts
  // Achata cada produto (barrels[]) pros itens-wire {produto_id, quantidade, is_consignado}
  // que o server/pricing já consomem — agrupando firmes e consignado da linha.
  const wireItems = items.flatMap((item) => {
    const firmeCount = item.barrels.filter((b) => !b).length
    const consignadoCount = item.barrels.length - firmeCount
    const lines: ManualOrderInput["items"] = []
    if (firmeCount > 0) lines.push({ produto_id: item.produto_id, quantidade: firmeCount, is_consignado: false })
    if (consignadoCount > 0) lines.push({ produto_id: item.produto_id, quantidade: consignadoCount, is_consignado: true })
    return lines
  })

  const pricedLines = priceManualOrderLines(wireItems, produtos, metodoPagamento)
```
(`itemRowsForTotals`, `totals`, `split` logo abaixo ficam **iguais** — já derivam de `pricedLines`.)

- [ ] **Step 5: `canSubmit` (L170-178) — trocar as 2 cláusulas de itens**

De:
```ts
    items.every((i) => i.quantidade >= 1) &&
    hasFirmeItem(items) &&
```
Para:
```ts
    items.every((i) => i.barrels.length >= 1) &&
    hasFirmeItem(wireItems) &&
```

- [ ] **Step 6: Submit (L194-207) — usar `wireItems`**

Na montagem de `input`, trocar `items,` por `items: wireItems,`.

- [ ] **Step 7: Render da linha de item (substituir L353-396)**

```tsx
            {items.map((item, idx) => {
              const produto = produtos.find((p) => p.id === item.produto_id)
              const barrelPrices = produto
                ? priceBarrels(produto, item.barrels, metodoPagamento)
                : item.barrels.map((b) => ({ is_consignado: b, preco: 0 }))
              return (
                <div key={idx} className="bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Select value={item.produto_id} onChange={(e) => setItemProduto(idx, e.target.value)} className="flex-1">
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                    </Select>
                    <NumberStepper value={item.barrels.length} onChange={(next) => setItemQty(idx, next)} min={1} max={100} />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label="Remover item"
                      className="text-red-400 hover:bg-red-500/10 rounded p-1.5 cursor-pointer transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {item.barrels.map((isConsignado, barrelIdx) => (
                      <div key={barrelIdx} className="flex items-center gap-2">
                        <span className="text-xs text-brand-warm-gray w-16 shrink-0">Barril {barrelIdx + 1}</span>
                        <Segmented
                          value={isConsignado ? "consignado" : "firme"}
                          onChange={(v) => setBarrelConsignado(idx, barrelIdx, v === "consignado")}
                          ariaLabel={`Barril ${barrelIdx + 1}: firme ou consignado`}
                          options={[
                            { value: "firme", label: "Firme" },
                            { value: "consignado", label: "Consignado" },
                          ]}
                        />
                        <span className="text-xs tabular-nums text-brand-warm-gray ml-auto shrink-0">{formatBRL(barrelPrices[barrelIdx]?.preco ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  {item.barrels.some((b) => b) && (
                    <p className="text-[11px] text-brand-warm-gray italic">Consignado: paga só se usar.</p>
                  )}
                </div>
              )
            })}
```

- [ ] **Step 8: Warning inline (perto do rodapé, ~L466) — usar `wireItems`**

Trocar `items.length > 0 && !hasFirmeItem(items)` por `items.length > 0 && !hasFirmeItem(wireItems)`.

- [ ] **Step 9: Verificar typecheck + build**

Run: `cd /Users/marcusgoncalves/projects/orcamento-brum/app && npx tsc --noEmit && npm run build`
Expected: sem erros de tipo (checar que `Checkbox`/`describeBarrels` removidos não deixaram referência órfã); build ok.

- [ ] **Step 10: Commit**

```bash
git add app/components/admin/manual-order-drawer.tsx
git commit -m "feat(consignado): per-barrel firme/consignado toggle in manual order drawer"
```

---

## Verificação final

- [ ] `cd app && npx vitest run` — suíte verde.
- [ ] `cd app && npx tsc --noEmit` — sem erros.
- [ ] `cd app && npm run build` — ok.
- [ ] Push staging → eyeball no navegador: Brahma x2 = Barril 1 Firme + Barril 2 Consignado → "Criar pedido" habilita, resumo mostra "A pagar" firme + "Consignado só se usar"; marcar os 2 consignado → trava (botão off + aviso âmbar).

## Self-review

- **Cobertura do spec:** modelo barrels[] (Task 2 Step 2) ✓; UI toggle por barril (Step 7) ✓; achatar pro wire sem tocar server/pricing (Step 4/6) ✓; default firme (Step 3) ✓; priceBarrels + testes + consistência (Task 1) ✓; remove gate hasSegundoBarril (o novo render não tem gate) ✓; trava opera no wire (Step 5/8) ✓. Sem gaps.
- **Placeholders:** nenhum.
- **Tipos:** `ManualOrderInput["items"]` = `{produto_id, quantidade, is_consignado}[]` — bate com o que `wireItems` monta e com o submit. `priceBarrels` retorna `BarrelPrice[]` indexado por `barrelIdx`. `Segmented` value union "firme"|"consignado". OK.
