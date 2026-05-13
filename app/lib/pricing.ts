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
