"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { formatCpf, validateCpf } from "@/lib/cpf"
import { getOrdersByCpf } from "@/lib/actions"
import { statusConfig } from "@/components/order-status-badge"
import type { PedidoStatus } from "@/lib/types"
import { formatBRL, formatEventDate } from "@/lib/format"

type OrderSummary = {
  id: string
  status: PedidoStatus
  documento_status: "pendente" | "enviado" | "verificado"
  data_evento: string
  horario_evento: string
  total: number
  frete: number
  subtotal: number
  created_at: string
  itens: { quantidade: number; marca: string; volume: number }[]
}

const inputClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 placeholder:text-brand-warm-gray/40"

const MeusPedidosForm = () => {
  const [cpf, setCpf] = useState("")
  const [loading, setLoading] = useState(false)
  const [pedidos, setPedidos] = useState<OrderSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCpf(cpf)) {
      setError("CPF invalido")
      return
    }

    setLoading(true)
    setError(null)

    const result = await getOrdersByCpf(cpf)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setPedidos(result.pedidos as OrderSummary[])
    setLoading(false)
  }

  return (
    <section className="py-12 md:py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-brand-yellow font-medium mb-8 flex items-center gap-2 text-sm tracking-wide hover:text-brand-amber transition-colors duration-200"
        >
          <span>←</span> Voltar ao inicio
        </Link>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-5xl font-bold text-white mb-2 uppercase tracking-wider"
        >
          Meus Pedidos
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-gray-light mb-10"
        >
          Coloque o CPF para exibir seus pedidos
        </motion.p>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex gap-3 mb-10"
        >
          <input
            type="text"
            value={cpf}
            onChange={(e) => { setCpf(formatCpf(e.target.value)); setError(null) }}
            placeholder="000.000.000-00"
            maxLength={14}
            className={inputClassName}
          />
          <motion.button
            type="submit"
            disabled={loading || cpf.length < 14}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            className="bg-brand-yellow text-brand-black font-medium px-6 py-3 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? "Buscando..." : "Buscar"}
          </motion.button>
        </motion.form>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm mb-6"
          >
            {error}
          </motion.p>
        )}

        {pedidos !== null && pedidos.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-brand-warm-gray mb-4">Nenhum pedido encontrado para este CPF.</p>
            <Link
              href="/"
              className="inline-block bg-brand-yellow text-brand-black font-medium px-8 py-3 rounded-md text-sm tracking-wide uppercase hover:bg-brand-amber transition-colors duration-200"
            >
              Fazer um pedido
            </Link>
          </motion.div>
        )}

        {pedidos && pedidos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {pedidos.map((pedido) => {
              const displayStatus = statusConfig[pedido.status]
              return (
                <Link key={pedido.id} href={`/pedido/${pedido.id}`}>
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="bg-brand-surface rounded-xl border border-white/10 p-5 hover:border-brand-yellow/30 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="font-mono text-xs text-brand-warm-gray">#{pedido.id.slice(0, 8)}</span>
                        <p className="text-white text-sm mt-1">
                          {formatEventDate(pedido.data_evento, { day: "2-digit", month: "short", year: "numeric" })} as {pedido.horario_evento.slice(0, 5)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border tracking-wide ${displayStatus.color}`}>
                        {displayStatus.label}
                      </span>
                    </div>
                    <div className="space-y-1 mb-3">
                      {pedido.itens.map((item, i) => (
                        <p key={i} className="text-brand-gray-light text-sm">
                          {item.quantidade}x {item.marca} {item.volume}L
                        </p>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-white/10">
                      {pedido.frete > 0 && (
                        <div className="space-y-1 mb-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-warm-gray">Subtotal</span>
                            <span className="text-brand-gray-light">{formatBRL(pedido.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-400">Frete adicionado</span>
                            <span className="text-amber-400">{formatBRL(pedido.frete)}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-display text-brand-yellow font-bold">{formatBRL(pedido.total)}</span>
                        <span className="text-brand-yellow text-xs">Ver detalhes →</span>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              )
            })}
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default MeusPedidosForm
