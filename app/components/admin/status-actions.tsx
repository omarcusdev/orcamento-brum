"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"
import { advanceOrderStatus, cancelOrder } from "@/lib/admin-actions"
import DispatchModal from "@/components/admin/dispatch-modal"
import RevertStatusModal from "@/components/admin/revert-status-modal"

type StatusActionsProps = {
  pedidoId: string
  currentStatus: PedidoStatus
  documentoStatus: string
  frete: number
  dispatchText?: string
}

const nextStatusMap: Partial<Record<PedidoStatus, PedidoStatus>> = {
  confirmado: "enviar_para_entregador",
  enviar_para_entregador: "em_rota",
  em_rota: "entregue",
  entregue: "pago",
  pago: "recolhido",
}

const StatusActions = ({ pedidoId, currentStatus, documentoStatus, frete, dispatchText }: StatusActionsProps) => {
  const [loading, setLoading] = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const [showRevert, setShowRevert] = useState(false)

  const nextStatus = nextStatusMap[currentStatus]
  const canShowRevert = currentStatus !== "confirmado" && currentStatus !== "cancelado"

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

  if (currentStatus === "recolhido" || currentStatus === "cancelado") {
    if (currentStatus === "cancelado") return null
    return (
      <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-warm-gray">Status atual:</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${statusConfig[currentStatus].color}`}>
              {statusConfig[currentStatus].label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowRevert(true)}
            className="w-full text-sm text-brand-warm-gray hover:text-white border border-white/10 rounded-lg py-2 transition"
          >
            Voltar status
          </button>
        </div>
        {showRevert && (
          <RevertStatusModal
            pedidoId={pedidoId}
            currentStatus={currentStatus}
            onClose={() => setShowRevert(false)}
          />
        )}
      </>
    )
  }

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
          {!docsVerified && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <span className="text-yellow-400 text-sm">Documentacao pendente de verificacao</span>
            </div>
          )}
          <motion.button
            onClick={handleAdvance}
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
          </motion.button>
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

      {canShowRevert && (
        <button
          type="button"
          onClick={() => setShowRevert(true)}
          className="w-full text-sm text-brand-warm-gray hover:text-white border border-white/10 rounded-lg py-2 transition"
        >
          Voltar status
        </button>
      )}

      {showDispatch && dispatchText && (
        <DispatchModal
          pedidoId={pedidoId}
          dispatchText={dispatchText}
          frete={frete}
          documentoStatus={documentoStatus}
          onClose={() => setShowDispatch(false)}
        />
      )}

      {showRevert && (
        <RevertStatusModal
          pedidoId={pedidoId}
          currentStatus={currentStatus}
          onClose={() => setShowRevert(false)}
        />
      )}
    </div>
  )
}

export default StatusActions
