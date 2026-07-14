# Consignado por barril (toggle firme/consignado por barril no pedido manual)

**Data:** 2026-07-14
**Origem:** Ao testar a trava ">=1 firme" em staging, Jean (cliente) reportou que "não dá pra criar pedido com consignado agora". Causa: o checkbox "Consignado" é tudo-ou-nada **por linha** — marcar consignado numa linha de qty 2 torna os 2 barris consignado → 0 firme → trava dispara. Jean quer marcar **quantos** barris são consignado vs firme, de forma clara, e espera que "o primeiro não seja consignado".

## Decisão (aprovada)

**Toggle por barril.** Cada linha de item = um produto + quantidade; a linha expande em N barris, cada um com um switch **Firme | Consignado**. Barril nasce **Firme** (default). Substitui o checkbox tudo-ou-nada.

## Modelo (estado local do drawer)

`DraftItem` passa de `{ produto_id, quantidade, is_consignado }` para:

```ts
type DraftItem = { produto_id: string; barrels: boolean[] } // cada bool = isConsignado do barril; default false (firme)
```

`quantidade` do produto = `barrels.length` (min 1).

## UI da linha (`manual-order-drawer.tsx`)

```
Brahma 50L ▾   [− 2 +]   ✕
  Barril 1   [ Firme | Consignado ]   R$ 880,00
  Barril 2   [ Firme | Consignado ]   R$ 750,00
```

- **Select** de produto (igual hoje).
- **NumberStepper** de qty controla `barrels.length`: `+` anexa um barril firme (`false`); `−` remove o último; min 1.
- Por barril: `Segmented` [Firme | Consignado] + preço do barril à direita.
- O toggle aparece pra **todos** os produtos — remove o gate `hasSegundoBarril` do checkbox atual. Consignado vale pra qualquer barril; "2º barril" é só regra de **preço**, não de elegibilidade a consignado.
- Ao adicionar produto (`+ Adicionar item`): 1 barril, firme.

## Sem tocar server / schema / pricing de armazenamento

O drawer **achata** cada `DraftItem` pros itens-wire já existentes `{ produto_id, quantidade, is_consignado }`, agrupando por tipo dentro da linha:
- `firmeCount = barrels.filter(b => !b).length` → se > 0, emite `{ produto_id, quantidade: firmeCount, is_consignado: false }`
- `consignadoCount = barrels.filter(b => b).length` → se > 0, emite `{ produto_id, quantidade: consignadoCount, is_consignado: true }`

Esse array achatado (`wireItems`) alimenta:
- **Preview** de totais no drawer (`priceManualOrderLines` + `calculateOrderTotals` + `consignadoSplit`) — **inalterados**.
- **Submit** `createManualOrder(input.items = wireItems)` — server, schema (`manualOrderInputSchema`) e `priceManualOrderLines` **inalterados**.

A trava `hasFirmeItem(wireItems)` continua funcionando: só bloqueia se TODOS os barris de TODAS as linhas forem consignado. Com default firme, isso vira rede de segurança rara.

## Preço por barril (display) — função pura nova em `pricing.ts`

```ts
export type BarrelPrice = { is_consignado: boolean; preco: number }

// Preço de cada barril na ORDEM DA UI, consistente com priceManualOrderLines:
// ordena firme-first por produto (1º barril do produto = preço cheio, 2º+ = preço 2º-barril),
// mas devolve na ordem em que os barris aparecem na UI para rotular cada linha.
export const priceBarrels = (
  produto: ProdutoForPricing,
  barrels: readonly boolean[],       // cada = isConsignado, ordem da UI
  metodoPagamento: PaymentMethod = "pix",
): BarrelPrice[]
```

Lógica: `{ firstUnitPrice, secondUnitPrice } = barrelUnitPrices(produto, metodoPagamento)`. `firmeCount = barrels.filter(b => !b).length`. Percorre os barris na ordem da UI mantendo contadores `firmeSeen`/`consignadoSeen`; posição global de um barril firme = `firmeSeen`, de um consignado = `firmeCount + consignadoSeen`; preço = `posição === 0 ? firstUnitPrice : secondUnitPrice`. Assim o 1º barril firme do produto custa o preço cheio e o resto o preço 2º-barril — igual ao que `priceManualOrderLines` grava. Quando `firmeCount === 0`, o 1º consignado custa o cheio (posição 0).

## Testes (TDD, vitest — `pricing.test.ts`)

- `priceBarrels`: 1 firme → [cheio]; 2 firme → [cheio, 2º]; 1 firme + 1 consignado → firme cheio, consignado 2º; 2 consignado (firmeCount 0) → 1º consignado cheio, 2º consignado 2º; ordem-UI [consignado, firme] → firme leva o cheio (firme-first), consignado leva o 2º.
- **Consistência**: soma de `priceBarrels` == total de `priceManualOrderLines` sobre o mesmo conjunto achatado (trava contra divergência display×armazenado), num caso misto.

O drawer não tem harness de RTL — as mudanças de UI/model são verificadas por typecheck + build + eyeball em staging.

## Escopo / não-objetivos

- **Só** o drawer de **criar pedido manual** (`manual-order-drawer.tsx`). O drawer de **editar** (`edit-order-drawer.tsx`) fica pra follow-up — os guards de edição já existentes seguram o caso 100% consignado lá.
- Sem migration; sem mudança em `schemas.ts` / `createManualOrder` / `priceManualOrderLines` / `hasFirmeItem`.
- Sem atalho "todos firme / todos consignado" (YAGNI; pedidos são pequenos).

## Verificação

`npx vitest run` local, typecheck, build. Depois: push staging → re-testar no navegador (Brahma x2 = 1 firme + 1 consignado deve criar; tudo consignado deve travar).
