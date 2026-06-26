import { createClient } from "@/lib/supabase/server"
import FadeIn from "@/components/admin/fade-in"
import OrdersList from "@/components/admin/orders-list"
import NewOrderTrigger from "@/components/admin/new-order-trigger"
import { archiveRecolhidoOrders } from "@/lib/admin-actions"
import { PEDIDO_LIST_SELECT, normalizeOrders } from "@/lib/admin-pedidos"
import type { Produto } from "@/lib/types"

const PedidosPage = async () => {
  await archiveRecolhidoOrders()
  const supabase = await createClient()

  const [{ data: rawOrders }, { data: produtos }] = await Promise.all([
    supabase
      .from("pedidos")
      .select(PEDIDO_LIST_SELECT)
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
