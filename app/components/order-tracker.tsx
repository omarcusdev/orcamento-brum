"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import type { Pedido, PedidoStatusLog, PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import OrderTimeline from "@/components/order-timeline"

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
    <div className="min-h-screen bg-brand-cream/30 px-4 py-16">
      <div className="max-w-lg mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-2xl md:text-3xl font-bold text-brand-black mb-1"
        >
          Acompanhar Pedido
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-sm text-brand-warm-gray font-mono mb-8"
        >
          {pedido.id.slice(0, 8)}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100/80 p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm text-brand-warm-gray">Status atual</span>
            <OrderStatusBadge status={pedido.status as PedidoStatus} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Cliente</span>
              <span className="font-medium text-brand-black">{pedido.clientes.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Evento</span>
              <span className="text-brand-black">{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} às {pedido.horario_evento.slice(0, 5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Endereço</span>
              <span className="text-right max-w-[200px] text-brand-black">{pedido.endereco}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-warm-gray">Chopeira</span>
              <span className="capitalize text-brand-black">{pedido.tipo_chopeira}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-100/80 p-6 mb-6"
        >
          <h2 className="font-display font-bold text-brand-black mb-4">Itens</h2>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm py-1.5">
              <span className="text-brand-warm-gray">{item.quantidade}x {item.produtos.marca} {item.produtos.volume_litros}L</span>
              <span className="font-medium text-brand-black">{formatPrice(item.preco_unitario * item.quantidade)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold mt-4 pt-4 border-t border-gray-100">
            <span className="text-brand-black">Total</span>
            <span className="font-display text-brand-black">{formatPrice(pedido.total)}</span>
          </div>
        </motion.div>

        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="bg-white rounded-lg shadow-sm border border-gray-100/80 p-6"
          >
            <h2 className="font-display font-bold text-brand-black mb-5">Histórico</h2>
            <OrderTimeline logs={logs} />
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default OrderTracker
