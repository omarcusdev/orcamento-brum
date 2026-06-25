"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import type { PedidoStatus } from "@/lib/types"
import StatusFilter from "@/components/admin/status-filter"
import OrderCard from "@/components/admin/order-card"
import { PEDIDO_LIST_SELECT, normalizeOrders, type OrderListItem } from "@/lib/admin-pedidos"

type OrdersListProps = {
  initialOrders: OrderListItem[]
}

type ViewMode = "ativos" | "arquivados"
type SortMode = "recente" | "evento"

const OrdersList = ({ initialOrders }: OrdersListProps) => {
  const [orders, setOrders] = useState(initialOrders)
  const [filter, setFilter] = useState<PedidoStatus | "todos">("todos")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<ViewMode>("ativos")
  const [sort, setSort] = useState<SortMode>("recente")

  useEffect(() => {
    const supabase = createClient()

    const refetch = async () => {
      const { data } = await supabase
        .from("pedidos")
        .select(PEDIDO_LIST_SELECT)
        .order("created_at", { ascending: false })

      if (data) setOrders(normalizeOrders(data as unknown[]))
    }

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        refetch
      )
      .subscribe()

    const handleVisibility = () => { if (document.visibilityState === "visible") refetch() }
    document.addEventListener("visibilitychange", handleVisibility)

    const interval = setInterval(refetch, 30_000)

    return () => {
      supabase.removeChannel(channel)
      document.removeEventListener("visibilitychange", handleVisibility)
      clearInterval(interval)
    }
  }, [])

  const visibleByView = orders.filter((order) =>
    view === "ativos" ? order.arquivado_em == null : order.arquivado_em != null,
  )

  const counts = visibleByView.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1
    return acc
  }, {})

  const filtered = visibleByView
    .filter((order) => {
      const matchesFilter = filter === "todos" || order.status === filter
      const matchesSearch = search === "" || order.clientes.nome.toLowerCase().includes(search.toLowerCase()) || order.endereco.toLowerCase().includes(search.toLowerCase())
      return matchesFilter && matchesSearch
    })
    .slice()
    .sort((a, b) => {
      if (sort === "recente") return b.created_at.localeCompare(a.created_at)
      return (a.data_evento + a.horario_evento).localeCompare(b.data_evento + b.horario_evento)
    })

  const ativosCount = orders.filter((o) => o.arquivado_em == null).length
  const arquivadosCount = orders.length - ativosCount

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-4 flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="text"
          placeholder="Buscar por nome ou endereco..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg bg-brand-surface border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
        />
        <div className="inline-flex rounded-lg bg-brand-surface border border-white/10 p-0.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setSort("recente")}
            className={`px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${sort === "recente" ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"}`}
          >
            Recentes
          </button>
          <button
            type="button"
            onClick={() => setSort("evento")}
            className={`px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${sort === "evento" ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"}`}
          >
            Próximo evento
          </button>
        </div>
        <div className="inline-flex rounded-lg bg-brand-surface border border-white/10 p-0.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => setView("ativos")}
            className={`px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${view === "ativos" ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"}`}
          >
            Ativos ({ativosCount})
          </button>
          <button
            type="button"
            onClick={() => setView("arquivados")}
            className={`px-3 py-2 rounded-md text-xs font-semibold transition cursor-pointer ${view === "arquivados" ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"}`}
          >
            Arquivados ({arquivadosCount})
          </button>
        </div>
      </motion.div>
      <StatusFilter selected={filter} counts={counts} onChange={setFilter} />
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-brand-warm-gray py-8"
          >
            {view === "arquivados" ? "Nenhum pedido arquivado" : "Nenhum pedido encontrado"}
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
