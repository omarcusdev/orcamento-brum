"use client"

import { useState } from "react"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"
import { advanceOrderStatus, cancelOrder, markAsPaid } from "@/lib/admin-actions"

type StatusActionsProps = {
  pedidoId: string
  currentStatus: PedidoStatus
  pago: boolean
}

const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  novo: "aguardando_pagamento",
  aguardando_pagamento: "confirmado",
  confirmado: "em_rota",
  em_rota: "entregue",
  entregue: "recolhido",
  recolhido: "finalizado",
}

const StatusActions = ({ pedidoId, currentStatus, pago }: StatusActionsProps) => {
  const [loading, setLoading] = useState(false)

  const nextStatus = nextStatusMap[currentStatus]

  const handleAdvance = async () => {
    setLoading(true)
    await advanceOrderStatus(pedidoId, currentStatus)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar este pedido?")) return
    setLoading(true)
    await cancelOrder(pedidoId)
    setLoading(false)
  }

  const handleMarkPaid = async () => {
    setLoading(true)
    await markAsPaid(pedidoId)
    setLoading(false)
  }

  if (currentStatus === "finalizado" || currentStatus === "cancelado") return null

  return (
    <div className="space-y-3">
      {nextStatus && (
        <button
          onClick={handleAdvance}
          disabled={loading}
          className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
        >
          {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
        </button>
      )}
      {!pago && (
        <button
          onClick={handleMarkPaid}
          disabled={loading}
          className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition cursor-pointer disabled:opacity-50"
        >
          Marcar como Pago
        </button>
      )}
      <button
        onClick={handleCancel}
        disabled={loading}
        className="w-full border border-red-300 text-red-500 font-medium py-3 rounded-lg hover:bg-red-50 transition cursor-pointer disabled:opacity-50"
      >
        Cancelar Pedido
      </button>
    </div>
  )
}

export default StatusActions
