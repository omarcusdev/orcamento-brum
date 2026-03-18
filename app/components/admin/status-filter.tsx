"use client"

import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"

type StatusFilterProps = {
  selected: PedidoStatus | "todos"
  counts: Record<string, number>
  onChange: (status: PedidoStatus | "todos") => void
}

const allStatuses: (PedidoStatus | "todos")[] = [
  "todos", "novo", "aguardando_pagamento", "confirmado", "em_rota", "entregue", "recolhido", "finalizado", "cancelado"
]

const StatusFilter = ({ selected, counts, onChange }: StatusFilterProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4"
  >
    {allStatuses.map((status, index) => {
      const count = status === "todos"
        ? Object.values(counts).reduce((a, b) => a + b, 0)
        : counts[status] ?? 0
      const label = status === "todos" ? "Todos" : statusConfig[status].label

      return (
        <motion.button
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.12 + index * 0.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onChange(status)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            selected === status
              ? "bg-brand-yellow text-brand-black"
              : "bg-brand-surface text-brand-gray-light border border-white/10 hover:border-brand-yellow/40"
          }`}
        >
          {label} ({count})
        </motion.button>
      )
    })}
  </motion.div>
)

export default StatusFilter
