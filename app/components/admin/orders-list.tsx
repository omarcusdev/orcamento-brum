"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PedidoStatus } from "@/lib/types"
import StatusFilter from "@/components/admin/status-filter"
import OrderCard from "@/components/admin/order-card"

type OrderWithClient = {
  id: string
  status: string
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
            .select("id, status, total, data_evento, horario_evento, endereco, metodo_pagamento, pago, created_at, clientes(nome, telefone)")
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
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome ou endereco..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm"
        />
      </div>
      <StatusFilter selected={filter} counts={counts} onChange={setFilter} />
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Nenhum pedido encontrado</p>
        ) : (
          filtered.map((order) => <OrderCard key={order.id} pedido={order} />)
        )}
      </div>
    </div>
  )
}

export default OrdersList
