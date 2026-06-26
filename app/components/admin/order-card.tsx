"use client"

import { useState, type MouseEvent } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import { archiveOrder, unarchiveOrder } from "@/lib/admin-actions"
import { formatBRL, formatEventDate } from "@/lib/format"

type OrderCardProps = {
  pedido: {
    id: string
    status: string
    documento_status: string
    total: number
    data_evento: string
    horario_evento: string
    endereco: string
    metodo_pagamento: string | null
    created_at: string
    arquivado_em: string | null
    clientes: { nome: string; telefone: string }
  }
  index?: number
}

const metodoLabel: Record<string, string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" }

const docStatusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Docs pendentes", className: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  enviado: { label: "Docs enviados", className: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  verificado: { label: "Docs verificados", className: "text-green-400 bg-green-400/10 border-green-400/30" },
}

const formatRecebidoEm = (isoDate: string) => {
  const created = new Date(isoDate)
  const diffMs = Date.now() - created.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `há ${diffMin}min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `há ${diffHr}h`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return "ontem"
  if (diffDays < 7) return `há ${diffDays} dias`
  return created.toLocaleDateString("pt-BR")
}

const OrderCard = ({ pedido, index = 0 }: OrderCardProps) => {
  const [busy, setBusy] = useState(false)
  const arquivado = !!pedido.arquivado_em

  const handleArchiveClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    if (!arquivado && !confirm(`Excluir o pedido de ${pedido.clientes.nome} da esteira? Vai pra aba 'Arquivados' e pode ser restaurado.`)) return
    setBusy(true)
    try {
      if (arquivado) {
        await unarchiveOrder(pedido.id)
      } else {
        await archiveOrder(pedido.id)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao processar")
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2 }}
      className="relative"
    >
      <Link
        href={`/admin/pedidos/${pedido.id}`}
        className="block bg-brand-surface rounded-xl border border-white/10 p-4 pr-12 hover:border-brand-yellow/30 transition"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-white">{pedido.clientes.nome}</p>
            <p className="text-xs text-brand-warm-gray">
              {pedido.clientes.telefone}
              <span className="text-brand-warm-gray/60"> · Recebido {formatRecebidoEm(pedido.created_at)}</span>
            </p>
          </div>
          <OrderStatusBadge status={pedido.status as PedidoStatus} />
        </div>
        <div className="flex items-center justify-between text-sm text-brand-gray-light">
          <span>
            {formatEventDate(pedido.data_evento)} as {pedido.horario_evento.slice(0, 5)}
          </span>
          <span className="font-bold text-brand-yellow">{formatBRL(pedido.total)}</span>
        </div>
        <p className="text-xs text-brand-warm-gray mt-1 truncate">{pedido.endereco}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${docStatusConfig[pedido.documento_status]?.className ?? ""}`}>
            {docStatusConfig[pedido.documento_status]?.label ?? pedido.documento_status}
          </span>
          {pedido.metodo_pagamento && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 text-brand-gray-light bg-white/5">
              {metodoLabel[pedido.metodo_pagamento] ?? pedido.metodo_pagamento}
            </span>
          )}
          {arquivado && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-white/15 text-brand-warm-gray bg-white/5">
              Arquivado
            </span>
          )}
        </div>
      </Link>
      <motion.button
        type="button"
        onClick={handleArchiveClick}
        disabled={busy}
        whileTap={{ scale: 0.9 }}
        aria-label={arquivado ? "Restaurar pedido" : "Excluir pedido (mover para arquivados)"}
        title={arquivado ? "Restaurar pedido" : "Excluir pedido"}
        className={`absolute top-3 right-3 p-2 rounded-lg border transition cursor-pointer disabled:opacity-50 ${
          arquivado
            ? "border-white/10 text-brand-warm-gray hover:text-white hover:border-white/30 bg-brand-surface"
            : "border-red-500/20 text-red-400/80 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 bg-brand-surface"
        }`}
      >
        {arquivado ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        )}
      </motion.button>
    </motion.div>
  )
}

export default OrderCard
