import type { PedidoStatus } from "@/lib/types"

const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-50 text-blue-700 border-blue-200" },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmado: { label: "Confirmado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  em_rota: { label: "Em Rota", color: "bg-violet-50 text-violet-700 border-violet-200" },
  entregue: { label: "Entregue", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  recolhido: { label: "Recolhido", color: "bg-gray-50 text-gray-700 border-gray-200" },
  finalizado: { label: "Finalizado", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", color: "bg-red-50 text-red-700 border-red-200" },
}

const OrderStatusBadge = ({ status }: { status: PedidoStatus }) => {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${config.color}`}>
      {config.label}
    </span>
  )
}

export { statusConfig }
export default OrderStatusBadge
