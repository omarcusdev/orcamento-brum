"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { revertOrderStatus, STATUS_FLOW_ORDER } from "@/lib/admin-actions"
import { statusConfig } from "@/components/order-status-badge"
import type { PedidoStatus } from "@/lib/types"

type Props = {
  pedidoId: string
  currentStatus: PedidoStatus
  onClose: () => void
}

const RevertStatusModal = ({ pedidoId, currentStatus, onClose }: Props) => {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currentIndex = STATUS_FLOW_ORDER.indexOf(currentStatus as never)
  const previousStatuses = (currentIndex > 0
    ? STATUS_FLOW_ORDER.slice(0, currentIndex)
    : []) as PedidoStatus[]
  const canCancel = currentStatus !== "recolhido" && currentStatus !== "cancelado"

  const handleRevert = async (target: PedidoStatus) => {
    if (!confirm(`Voltar de "${statusConfig[currentStatus].label}" para "${statusConfig[target].label}"?`)) {
      return
    }
    setLoading(target)
    setError(null)
    try {
      await revertOrderStatus(pedidoId, target)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao voltar status")
    } finally {
      setLoading(null)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-surface rounded-xl border border-white/10 p-6 max-w-md w-full space-y-4"
        >
          <div>
            <h3 className="font-display text-lg font-bold text-white tracking-wide">Voltar status</h3>
            <p className="text-sm text-brand-warm-gray mt-1">
              Status atual: <span className="text-white font-medium">{statusConfig[currentStatus].label}</span>
            </p>
          </div>

          {previousStatuses.length === 0 && !canCancel && (
            <p className="text-sm text-brand-warm-gray">Nao ha status anteriores disponiveis.</p>
          )}

          <div className="space-y-2">
            {previousStatuses.map((status) => (
              <button
                key={status}
                disabled={loading !== null}
                onClick={() => handleRevert(status)}
                className="w-full text-left px-4 py-2.5 rounded-lg bg-brand-dark border border-white/10 hover:border-brand-yellow/30 transition text-sm text-white disabled:opacity-50 cursor-pointer"
              >
                Voltar para <span className="font-semibold">{statusConfig[status].label}</span>
              </button>
            ))}

            {canCancel && (
              <button
                disabled={loading !== null}
                onClick={() => handleRevert("cancelado")}
                className="w-full text-left px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition text-sm text-red-400 disabled:opacity-50 cursor-pointer"
              >
                Marcar como <span className="font-semibold">cancelado</span>
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={onClose}
            disabled={loading !== null}
            className="text-sm text-brand-warm-gray hover:text-white disabled:opacity-50"
          >
            Fechar
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default RevertStatusModal
