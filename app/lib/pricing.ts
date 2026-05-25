import type { Produto } from "@/lib/types"

export type PaymentMethod = "pix" | "cartao" | "dinheiro"

export type LineCalculation = {
  firstUnitPrice: number
  extraUnitPrice: number
  total: number
  hasPromo: boolean
  savings: number
}

export const getBasePrice = (produto: Pick<Produto, "preco_avista" | "preco_cartao">, metodoPagamento: PaymentMethod) => {
  if (metodoPagamento === "cartao" && produto.preco_cartao) return produto.preco_cartao
  return produto.preco_avista
}

export const calculateLine = (
  produto: Pick<Produto, "preco_avista" | "preco_cartao" | "preco_segundo_barril">,
  quantidade: number,
  metodoPagamento: PaymentMethod = "pix",
): LineCalculation => {
  const safeQuantity = Math.max(0, Math.floor(quantidade))
  const firstUnitPrice = getBasePrice(produto, metodoPagamento)
  const promoApplies = produto.preco_segundo_barril != null && produto.preco_segundo_barril < firstUnitPrice
  const extraUnitPrice = promoApplies ? produto.preco_segundo_barril! : firstUnitPrice
  const extraUnits = Math.max(0, safeQuantity - 1)
  const total = safeQuantity === 0 ? 0 : firstUnitPrice + extraUnitPrice * extraUnits
  const fullPriceTotal = firstUnitPrice * safeQuantity
  const savings = Math.max(0, fullPriceTotal - total)
  return {
    firstUnitPrice,
    extraUnitPrice,
    total,
    hasPromo: promoApplies && safeQuantity >= 2,
    savings,
  }
}

export const calculateLineUnitPrice = (
  produto: Pick<Produto, "preco_avista" | "preco_cartao" | "preco_segundo_barril">,
  quantidade: number,
  metodoPagamento: PaymentMethod = "pix",
) => {
  const { total } = calculateLine(produto, quantidade, metodoPagamento)
  return quantidade > 0 ? total / quantidade : 0
}

export type ManualLineInput = {
  produto_id: string
  quantidade: number
  is_consignado: boolean
}

export type ManualLinePricing = ManualLineInput & {
  barrelPrices: number[]
  subtotal: number
  precoUnitario: number
}

export type ProdutoForPricing = Pick<Produto, "id" | "preco_avista" | "preco_cartao" | "preco_segundo_barril">

const round2 = (value: number) => Number(value.toFixed(2))

const unitPricesFor = (produto: ProdutoForPricing, metodoPagamento: PaymentMethod) => {
  const firstUnitPrice = Number(getBasePrice(produto, metodoPagamento))
  const segundoBarril = produto.preco_segundo_barril == null ? null : Number(produto.preco_segundo_barril)
  const promoApplies = segundoBarril != null && segundoBarril < firstUnitPrice
  return { firstUnitPrice, secondUnitPrice: promoApplies ? segundoBarril! : firstUnitPrice }
}

type BarrelWalk = {
  firmSeen: Record<string, number>
  consignadoSeen: Record<string, number>
  rows: ManualLinePricing[]
}

// Prices the second-barrel promo across the WHOLE order (per produto_id), not per line.
// Firm (non-consignado) barrels take the leading positions, consignado barrels follow.
// Position 0 of each produto is full price; every later barrel gets preco_segundo_barril.
export const priceManualOrderLines = (
  lines: ManualLineInput[],
  produtos: ProdutoForPricing[],
  metodoPagamento: PaymentMethod = "pix",
): ManualLinePricing[] => {
  const produtoById = new Map(produtos.map((produto) => [produto.id, produto]))

  const firmBarrelsByProduto = lines.reduce<Record<string, number>>((acc, line) => {
    if (line.is_consignado) return acc
    const qty = Math.max(0, Math.floor(line.quantidade))
    return { ...acc, [line.produto_id]: (acc[line.produto_id] ?? 0) + qty }
  }, {})

  const initial: BarrelWalk = { firmSeen: {}, consignadoSeen: {}, rows: [] }

  const walked = lines.reduce<BarrelWalk>((state, line) => {
    const qty = Math.max(0, Math.floor(line.quantidade))
    const produto = produtoById.get(line.produto_id)
    const prices = produto ? unitPricesFor(produto, metodoPagamento) : { firstUnitPrice: 0, secondUnitPrice: 0 }
    const startPosition = line.is_consignado
      ? (firmBarrelsByProduto[line.produto_id] ?? 0) + (state.consignadoSeen[line.produto_id] ?? 0)
      : state.firmSeen[line.produto_id] ?? 0
    const barrelPrices = Array.from({ length: qty }, (_, index) =>
      startPosition + index === 0 ? prices.firstUnitPrice : prices.secondUnitPrice,
    )
    const subtotal = round2(barrelPrices.reduce((sum, price) => sum + price, 0))
    const row: ManualLinePricing = {
      produto_id: line.produto_id,
      quantidade: qty,
      is_consignado: line.is_consignado,
      barrelPrices,
      subtotal,
      precoUnitario: qty > 0 ? round2(subtotal / qty) : prices.firstUnitPrice,
    }
    const counters = line.is_consignado
      ? { consignadoSeen: { ...state.consignadoSeen, [line.produto_id]: (state.consignadoSeen[line.produto_id] ?? 0) + qty } }
      : { firmSeen: { ...state.firmSeen, [line.produto_id]: (state.firmSeen[line.produto_id] ?? 0) + qty } }
    return { ...state, ...counters, rows: [...state.rows, row] }
  }, initial)

  return walked.rows
}

export type OrderItemForTotals = {
  subtotal: number
  is_consignado: boolean
  consignado_status: string | null
}

export type OrderTotals = {
  subtotalMin: number
  subtotalMax: number
  hasPendente: boolean
}

export const calculateOrderTotals = (items: OrderItemForTotals[]): OrderTotals => {
  const subtotalMin = items
    .filter((i) => !i.is_consignado || i.consignado_status === "usado")
    .reduce((sum, i) => sum + i.subtotal, 0)

  const subtotalMax = items
    .filter((i) => !i.is_consignado || i.consignado_status !== "devolvido")
    .reduce((sum, i) => sum + i.subtotal, 0)

  const hasPendente = items.some((i) => i.is_consignado && i.consignado_status === "pendente")

  return { subtotalMin, subtotalMax, hasPendente }
}
