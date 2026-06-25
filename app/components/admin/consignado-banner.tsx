"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { settleConsignado } from "@/lib/admin-actions"
import { Button } from "@/components/ui"
import { formatBRL } from "@/lib/format"

type Props = {
  itemId: string
  produtoLabel: string
  subtotal: number
}

const ConsignadoBanner = ({ itemId, produtoLabel, subtotal }: Props) => {
  const [loading, setLoading] = useState<"usado" | "devolvido" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSettle = async (status: "usado" | "devolvido") => {
    setLoading(status)
    setError(null)
    try {
      await settleConsignado(itemId, status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro")
    } finally {
      setLoading(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3"
    >
      <div>
        <p className="text-yellow-400 font-semibold text-sm">Consignado pendente</p>
        <p className="text-brand-gray-light text-sm">
          {produtoLabel} — {formatBRL(subtotal)} aguardando settlement
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="success" disabled={loading !== null} onClick={() => handleSettle("usado")} className="flex-1">
          {loading === "usado" ? "..." : "Marcar usado"}
        </Button>
        <Button variant="secondary" disabled={loading !== null} onClick={() => handleSettle("devolvido")} className="flex-1">
          {loading === "devolvido" ? "..." : "Marcar devolvido"}
        </Button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </motion.div>
  )
}

export default ConsignadoBanner
