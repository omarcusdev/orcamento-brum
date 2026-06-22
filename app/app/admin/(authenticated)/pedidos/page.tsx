import { createClient } from "@/lib/supabase/server"
import FadeIn from "@/components/admin/fade-in"
import OrdersList from "@/components/admin/orders-list"
import NewOrderTrigger from "@/components/admin/new-order-trigger"
import { archiveRecolhidoOrders } from "@/lib/admin-actions"
import type { Produto } from "@/lib/types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeOrders = (raw: any[]) =>
  raw.map((row: Record<string, any>) => ({
    ...row,
    clientes: Array.isArray(row.clientes) ? row.clientes[0] : row.clientes,
  })) as {
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
  }[]

const PedidosPage = async () => {
  await archiveRecolhidoOrders()
  const supabase = await createClient()

  const [{ data: rawOrders }, { data: produtos }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, status, documento_status, total, data_evento, horario_evento, endereco, metodo_pagamento, created_at, arquivado_em, clientes(nome, telefone)")
      .order("created_at", { ascending: false }),
    supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  ])

  const orders = normalizeOrders((rawOrders ?? []) as unknown[])

  return (
    <div>
      <FadeIn>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-bold text-white tracking-wide">PEDIDOS</h1>
          <NewOrderTrigger produtos={(produtos ?? []) as Produto[]} />
        </div>
      </FadeIn>
      <OrdersList initialOrders={orders} />
    </div>
  )
}

export default PedidosPage
