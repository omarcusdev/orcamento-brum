"use client"

import { useEffect, useState } from "react"
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
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-brand-black mb-1">Acompanhar Pedido</h1>
        <p className="text-sm text-gray-400 font-mono mb-6">{pedido.id.slice(0, 8)}</p>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">Status atual</span>
            <OrderStatusBadge status={pedido.status as PedidoStatus} />
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cliente</span>
              <span className="font-medium">{pedido.clientes.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Evento</span>
              <span>{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} às {pedido.horario_evento.slice(0, 5)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Endereço</span>
              <span className="text-right max-w-[200px]">{pedido.endereco}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Chopeira</span>
              <span className="capitalize">{pedido.tipo_chopeira}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-bold text-brand-black mb-3">Itens</h2>
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">{item.quantidade}x {item.produtos.marca} {item.produtos.volume_litros}L</span>
              <span className="font-medium">{formatPrice(item.preco_unitario * item.quantidade)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold mt-3 pt-3 border-t border-gray-100">
            <span>Total</span>
            <span>{formatPrice(pedido.total)}</span>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-bold text-brand-black mb-4">Histórico</h2>
            <OrderTimeline logs={logs} />
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderTracker
