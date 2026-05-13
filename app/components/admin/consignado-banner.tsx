"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { settleConsignado } from "@/lib/admin-actions"

type Props = {
  itemId: string
  produtoLabel: string
  subtotal: number
}

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const ConsignadoBanner = ({ itemId, produtoLabel, subtotal }: Props) => {
  const [loading, setLoading] = useState<"usado" | "devolvido" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSettle = async (status: "usado" | "devolvido") => {
    if (!confirm(`Marcar consignado como ${status}?`)) return
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
          {produtoLabel} — {formatCurrency(subtotal)} aguardando settlement
        </p>
      </div>
      <div className="flex gap-2">
        <button
          disabled={loading !== null}
          onClick={() => handleSettle("usado")}
          className="flex-1 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50 cursor-pointer"
        >
          {loading === "usado" ? "..." : "Marcar usado"}
        </button>
        <button
          disabled={loading !== null}
          onClick={() => handleSettle("devolvido")}
          className="flex-1 bg-brand-dark border border-white/10 text-brand-gray-light px-3 py-2 rounded text-sm hover:border-white/20 disabled:opacity-50 cursor-pointer"
        >
          {loading === "devolvido" ? "..." : "Marcar devolvido"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </motion.div>
  )
}

export default ConsignadoBanner
