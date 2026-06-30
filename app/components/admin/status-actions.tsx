"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge, { statusConfig } from "@/components/order-status-badge"
import { advanceOrderStatus, cancelOrder } from "@/lib/admin-actions"
import DispatchModal from "@/components/admin/dispatch-modal"
import RevertStatusModal from "@/components/admin/revert-status-modal"
import { Button } from "@/components/ui"

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
            <OrderStatusBadge status={currentStatus} />
          </div>
          <Button type="button" variant="secondary" fullWidth onClick={() => setShowRevert(true)}>
            Voltar status
          </Button>
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
        <OrderStatusBadge status={currentStatus} />
      </div>

      {nextStatus && (
        <>
          {!docsVerified && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <span className="text-yellow-400 text-sm">Documentacao pendente de verificacao</span>
            </div>
          )}
          <Button onClick={handleAdvance} disabled={loading} fullWidth size="lg">
            {loading ? "Atualizando..." : `Mover para: ${statusConfig[nextStatus].label}`}
          </Button>
        </>
      )}
      <Button onClick={handleCancel} disabled={loading} variant="danger" fullWidth size="lg">
        Cancelar Pedido
      </Button>

      {canShowRevert && (
        <Button type="button" variant="secondary" fullWidth onClick={() => setShowRevert(true)}>
          Voltar status
        </Button>
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
