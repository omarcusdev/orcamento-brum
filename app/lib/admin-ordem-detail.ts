import { calculateOrderTotals, type OrderItemForTotals } from "@/lib/pricing"

export type OrderDisplayTotals = {
  hasPendente: boolean
  totalMin: number
  totalMax: number
}

// Total exibido no detalhe do pedido. Com consignado pendente mostramos uma faixa min/max
// (devolvido vs usado); o subtotal min/max vem de calculateOrderTotals.
export const orderDisplayTotals = (
  items: OrderItemForTotals[],
  desconto: number,
  frete: number,
): OrderDisplayTotals => {
  const totals = calculateOrderTotals(items)
  return {
    hasPendente: totals.hasPendente,
    totalMin: totals.subtotalMin - desconto + frete,
    totalMax: totals.subtotalMax - desconto + frete,
  }
}

type DispatchItemRow = {
  quantidade: number
  produtos: { marca: string; volume_litros: number } | { marca: string; volume_litros: number }[] | null
}

// Achata as linhas cruas do Supabase (produtos vem objeto OU array, dependendo do join) para o
// formato que buildDispatchText espera.
export const toDispatchItens = (items: DispatchItemRow[]) =>
  (items ?? []).map((item) => {
    const produto = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
    return { quantidade: item.quantidade, marca: produto?.marca ?? "", volume: produto?.volume_litros ?? 0 }
  })
