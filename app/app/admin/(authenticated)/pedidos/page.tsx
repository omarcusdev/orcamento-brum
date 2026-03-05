import { createClient } from "@/lib/supabase/server"
import OrdersList from "@/components/admin/orders-list"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeOrders = (raw: any[]) =>
  raw.map((row: Record<string, any>) => ({
    ...row,
    clientes: Array.isArray(row.clientes) ? row.clientes[0] : row.clientes,
  })) as {
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
  }[]

const PedidosPage = async () => {
  const supabase = await createClient()

  const { data: rawOrders } = await supabase
    .from("pedidos")
    .select("id, status, total, data_evento, horario_evento, endereco, metodo_pagamento, pago, created_at, clientes(nome, telefone)")
    .order("created_at", { ascending: false })

  const orders = normalizeOrders((rawOrders ?? []) as unknown[])

  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-black mb-6">Pedidos</h1>
      <OrdersList initialOrders={orders} />
    </div>
  )
}

export default PedidosPage
