"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useConfirm } from "@/components/admin/confirm-provider"
import { archiveOrder, unarchiveOrder } from "@/lib/admin-actions"

type ArchiveToggleProps = {
  pedidoId: string
  arquivado: boolean
}

const ArchiveToggle = ({ pedidoId, arquivado }: ArchiveToggleProps) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm } = useConfirm()

  const handle = async () => {
    if (
      !arquivado &&
      !(await confirm({
        title: "Excluir pedido",
        message: "Excluir este pedido da esteira? Ele vai pra aba 'Arquivados' e pode ser restaurado depois.",
        confirmLabel: "Excluir",
        variant: "danger",
      }))
    )
      return
    setLoading(true)
    setError(null)
    try {
      if (arquivado) {
        await unarchiveOrder(pedidoId)
      } else {
        await archiveOrder(pedidoId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <motion.button
        onClick={handle}
        disabled={loading}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full font-medium py-3 rounded-lg transition cursor-pointer disabled:opacity-50 ${
          arquivado
            ? "border border-white/10 text-brand-gray-light hover:bg-white/5 hover:border-white/20"
            : "border border-red-500/30 text-red-400 hover:bg-red-500/10"
        }`}
      >
        {loading ? "..." : arquivado ? "Restaurar pedido (mover de volta)" : "Excluir pedido (mover para arquivados)"}
      </motion.button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}

export default ArchiveToggle
