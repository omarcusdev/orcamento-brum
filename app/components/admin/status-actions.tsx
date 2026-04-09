"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"
import { advanceOrderStatus, cancelOrder } from "@/lib/admin-actions"
import DispatchModal from "@/components/admin/dispatch-modal"

type StatusActionsProps = {
  pedidoId: string
  currentStatus: PedidoStatus
  documentoStatus: string
  frete: number
  dispatchText?: string
}

const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  aguardando_documentos: "confirmado",
  confirmado: "enviar_para_entregador",
  enviar_para_entregador: "em_rota",
  em_rota: "entregue",
  entregue: "pago",
  pago: "recolhido",
}

const StatusActions = ({ pedidoId, currentStatus, documentoStatus, frete, dispatchText }: StatusActionsProps) => {
  const [loading, setLoading] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)

  const nextStatus = nextStatusMap[currentStatus]

  const handleAdvance = async () => {
    if (currentStatus === "confirmado") {
      setShowDispatch(true)
      return
    }
    if (frete === 0 && !confirm("Frete nao definido. Deseja continuar sem frete?")) return
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

  if (currentStatus === "recolhido" || currentStatus === "cancelado") return null

  const docsVerified = documentoStatus === "verificado"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-brand-warm-gray">Status atual:</span>
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${statusConfig[currentStatus].color}`}>
          {statusConfig[currentStatus].label}
        </span>
      </div>

      {nextStatus && (
        <>
          <motion.button
            onClick={handleAdvance}
            disabled={loading || !docsVerified}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
          </motion.button>
          {!docsVerified && (
            <p className="text-yellow-400 text-xs text-center">Verifique os documentos primeiro</p>
          )}
        </>
      )}
      <motion.button
        onClick={handleCancel}
        disabled={loading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full border border-red-500/30 text-red-400 font-medium py-3 rounded-lg hover:bg-red-500/10 transition cursor-pointer disabled:opacity-50"
      >
        Cancelar Pedido
      </motion.button>

      {showDispatch && dispatchText && (
        <DispatchModal
          pedidoId={pedidoId}
          dispatchText={dispatchText}
          frete={frete}
          onClose={() => setShowDispatch(false)}
        />
      )}
    </div>
  )
}

export default StatusActions
