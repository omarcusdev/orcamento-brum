"use client"

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
  <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
    {allStatuses.map((status) => {
      const count = status === "todos"
        ? Object.values(counts).reduce((a, b) => a + b, 0)
        : counts[status] ?? 0
      const label = status === "todos" ? "Todos" : statusConfig[status].label

      return (
        <button
          key={status}
          onClick={() => onChange(status)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer ${
            selected === status
              ? "bg-brand-yellow text-brand-black"
              : "bg-white text-gray-500 border border-gray-200 hover:border-brand-yellow"
          }`}
        >
          {label} ({count})
        </button>
      )
    })}
  </div>
)

export default StatusFilter
