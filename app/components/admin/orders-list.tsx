"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import type { PedidoStatus } from "@/lib/types"
import StatusFilter from "@/components/admin/status-filter"
import OrderCard from "@/components/admin/order-card"

type OrderWithClient = {
  id: string
  status: string
  documento_status: string
  total: number
  data_evento: string
  horario_evento: string
  endereco: string
  metodo_pagamento: string | null
  pago: boolean
  created_at: string
  clientes: { nome: string; telefone: string }
}

type OrdersListProps = {
  initialOrders: OrderWithClient[]
}

const normalizeOrders = (raw: unknown[]) =>
  raw.map((row) => {
    const record = row as Record<string, unknown>
    return {
      ...record,
      clientes: Array.isArray(record.clientes) ? record.clientes[0] : record.clientes,
    }
  }) as OrderWithClient[]

const OrdersList = ({ initialOrders }: OrdersListProps) => {
  const [orders, setOrders] = useState(initialOrders)
  const [filter, setFilter] = useState<PedidoStatus | "todos">("todos")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        async () => {
          const { data } = await supabase
            .from("pedidos")
            .select("id, status, documento_status, total, data_evento, horario_evento, endereco, metodo_pagamento, pago, created_at, clientes(nome, telefone)")
            .order("created_at", { ascending: false })

          if (data) setOrders(normalizeOrders(data as unknown[]))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const counts = orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1
    return acc
  }, {})

  const filtered = orders.filter((order) => {
    const matchesFilter = filter === "todos" || order.status === filter
    const matchesSearch = search === "" || order.clientes.nome.toLowerCase().includes(search.toLowerCase()) || order.endereco.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-4"
      >
        <input
          type="text"
          placeholder="Buscar por nome ou endereco..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg bg-brand-surface border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
        />
      </motion.div>
      <StatusFilter selected={filter} counts={counts} onChange={setFilter} />
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-brand-warm-gray py-8"
          >
            Nenhum pedido encontrado
          </motion.p>
        ) : (
          filtered.map((order, index) => (
            <OrderCard key={order.id} pedido={order} index={index} />
          ))
        )}
      </div>
    </div>
  )
}

export default OrdersList
