"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { Pedido, PedidoStatusLog, PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import OrderTimeline from "@/components/order-timeline"
import DocumentUploadSection from "@/components/document-upload-section"

type OrderTrackerProps = {
  pedido: Pedido & { clientes: { nome: string } }
  items: { quantidade: number; preco_unitario: number; produtos: { marca: string; volume_litros: number } }[]
  logs: PedidoStatusLog[]
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const OrderTracker = ({ pedido: initialPedido, items, logs: initialLogs }: OrderTrackerProps) => {
  const [pedido, setPedido] = useState(initialPedido)
  const [logs, setLogs] = useState(initialLogs)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`pedido-${pedido.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedido.id}` },
        (payload) => {
          setPedido((prev) => ({ ...prev, ...payload.new }))
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedido_status_log", filter: `pedido_id=eq.${pedido.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as PedidoStatusLog, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [pedido.id])

  return (
    <div className="min-h-screen bg-brand-dark px-4 py-12">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="font-display text-4xl text-white uppercase tracking-wider mb-2">
            Acompanhar Pedido
          </h1>
          <p className="text-brand-warm-gray font-mono text-xs">
            #{pedido.id.slice(0, 8)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-brand-surface rounded-xl border border-white/10 p-6"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <span className="text-brand-warm-gray text-sm">Status atual</span>
            <OrderStatusBadge status={pedido.status as PedidoStatus} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Cliente</span>
              <span className="text-white font-medium">{pedido.clientes.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Evento</span>
              <span className="text-white">{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} às {pedido.horario_evento.slice(0, 5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Endereço</span>
              <span className="text-white text-right max-w-[60%]">{pedido.endereco}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Chopeira</span>
              <span className="text-white capitalize">{pedido.tipo_chopeira}</span>
            </div>
          </div>
        </motion.div>

        <DocumentUploadSection
          pedidoId={pedido.id}
          documentoStatus={pedido.documento_status}
        />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-brand-surface rounded-xl border border-white/10 p-6"
        >
          <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-3">Itens</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center py-1.5 text-sm">
              <span className="text-white">{item.quantidade}x {item.produtos.marca} {item.produtos.volume_litros}L</span>
              <span className="text-brand-yellow font-medium">{formatPrice(item.preco_unitario * item.quantidade)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/10">
            <span className="text-white font-medium">Total</span>
            <span className="font-display text-2xl text-brand-yellow">{formatPrice(pedido.total)}</span>
          </div>
        </motion.div>

        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-brand-surface rounded-xl border border-white/10 p-6"
          >
            <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-4">Histórico</p>
            <OrderTimeline logs={logs} />
          </motion.div>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-brand-warm-gray hover:text-brand-yellow transition"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export default OrderTracker
