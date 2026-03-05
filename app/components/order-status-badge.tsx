import type { PedidoStatus } from "@/lib/types"

const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700" },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-yellow-100 text-yellow-700" },
  confirmado: { label: "Confirmado", color: "bg-green-100 text-green-700" },
  em_rota: { label: "Em Rota", color: "bg-purple-100 text-purple-700" },
  entregue: { label: "Entregue", color: "bg-indigo-100 text-indigo-700" },
  recolhido: { label: "Recolhido", color: "bg-gray-100 text-gray-700" },
  finalizado: { label: "Finalizado", color: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700" },
}

const OrderStatusBadge = ({ status }: { status: PedidoStatus }) => {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}

export { statusConfig }
export default OrderStatusBadge
