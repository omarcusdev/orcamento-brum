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

// Public wrapper over unitPricesFor — returns the guarded per-barrel prices so callers
// (like addPedidoItem) don't re-implement the "2º-barril must be cheaper than à vista" rule.
export const barrelUnitPrices = (produto: ProdutoForPricing, metodoPagamento: PaymentMethod = "pix") =>
  unitPricesFor(produto, metodoPagamento)

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

// Valor "cheio" que fica salvo no pedido (colunas subtotal/total). Conta o consignado como SE FOSSE
// usado (= subtotalMax: firmes + consignado que NÃO foi devolvido), abatendo só os barris devolvidos
// no acerto. Assim o pedido nasce com o valor total em vez de R$ 0 enquanto o consignado está pendente.
// Usado tanto na criação (createManualOrder) quanto no acerto (settleConsignado) p/ ficarem coerentes.
export const calculateStoredTotals = (
  items: OrderItemForTotals[],
  frete: number,
  desconto: number,
): { subtotal: number; total: number } => {
  const subtotal = round2(calculateOrderTotals(items).subtotalMax)
  const total = round2(subtotal - desconto + frete)
  return { subtotal, total }
}

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
  const firmes = round2(items.filter((i) => !i.is_consignado).reduce((sum, i) => sum + i.subtotal, 0))
  return { firmes, consignado, aPagar, totalCheio, hasConsignado: consignado > 0 }
}

// Regra de negócio: todo pedido precisa de ao menos 1 barril firme (não-consignado).
// Um pedido 100% consignado deixa o cliente pagando só o frete — bloqueado em todos os guards.
export const REQUIRE_FIRME_MESSAGE = "Pedido precisa de ao menos 1 item nao-consignado (firme)"

export const hasFirmeItem = (items: readonly { is_consignado: boolean }[]): boolean =>
  items.some((i) => !i.is_consignado)
