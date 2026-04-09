import type { PedidoStatus } from "@/lib/types"

const statusConfig: Record<PedidoStatus, { label: string; color: string }> = {
  aguardando_documentos: { label: "Aguardando Documentos", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  confirmado: { label: "Confirmado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  enviar_para_entregador: { label: "Enviar p/ Entregador", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  em_rota: { label: "Em Rota", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
  entregue: { label: "Entregue", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  recolhido: { label: "Recolhido", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400 border-red-500/30" },
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
