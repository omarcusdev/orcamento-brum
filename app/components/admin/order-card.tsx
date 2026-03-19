"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"

type OrderCardProps = {
  pedido: {
    id: string
    status: string
    documento_status: string
    total: number
    data_evento: string
    horario_evento: string
    endereco: string
    metodo_pagamento: string | null
    pago: boolean
    created_at: string
    clientes: { nome: string; telefone: string }
  }
  index?: number
}

const docStatusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Docs pendentes", className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  enviado: { label: "Docs enviados", className: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  verificado: { label: "Docs verificados", className: "text-green-400 bg-green-400/10 border-green-400/30" },
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const OrderCard = ({ pedido, index = 0 }: OrderCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
    whileHover={{ y: -2 }}
  >
    <Link
      href={`/admin/pedidos/${pedido.id}`}
      className="block bg-brand-surface rounded-xl border border-white/10 p-4 hover:border-brand-yellow/30 transition"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-white">{pedido.clientes.nome}</p>
          <p className="text-xs text-brand-warm-gray">{pedido.clientes.telefone}</p>
        </div>
        <OrderStatusBadge status={pedido.status as PedidoStatus} />
      </div>
      <div className="flex items-center justify-between text-sm text-brand-gray-light">
        <span>
          {new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} as {pedido.horario_evento.slice(0, 5)}
        </span>
        <span className="font-bold text-brand-yellow">{formatPrice(pedido.total)}</span>
      </div>
      <p className="text-xs text-brand-warm-gray mt-1 truncate">{pedido.endereco}</p>
      <div className="mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${docStatusConfig[pedido.documento_status]?.className ?? ""}`}>
          {docStatusConfig[pedido.documento_status]?.label ?? pedido.documento_status}
        </span>
      </div>
    </Link>
  </motion.div>
)

export default OrderCard
