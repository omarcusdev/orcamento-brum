import Link from "next/link"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"

type OrderCardProps = {
  pedido: {
    id: string
    status: string
    total: number
    data_evento: string
    horario_evento: string
    endereco: string
    metodo_pagamento: string | null
    pago: boolean
    created_at: string
    clientes: { nome: string; telefone: string }
  }
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const OrderCard = ({ pedido }: OrderCardProps) => (
  <Link
    href={`/admin/pedidos/${pedido.id}`}
    className="block bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition"
  >
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-semibold text-brand-black">{pedido.clientes.nome}</p>
        <p className="text-xs text-gray-400">{pedido.clientes.telefone}</p>
      </div>
      <OrderStatusBadge status={pedido.status as PedidoStatus} />
    </div>
    <div className="flex items-center justify-between text-sm text-gray-500">
      <span>
        {new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} as {pedido.horario_evento.slice(0, 5)}
      </span>
      <span className="font-bold text-brand-black">{formatPrice(pedido.total)}</span>
    </div>
    <p className="text-xs text-gray-400 mt-1 truncate">{pedido.endereco}</p>
  </Link>
)

export default OrderCard
