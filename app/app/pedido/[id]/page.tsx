import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import OrderTracker from "@/components/order-tracker"

type Props = {
  params: Promise<{ id: string }>
}

const PedidoPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(nome)")
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const { data: rawItems } = await supabase
    .from("pedido_itens")
    .select("quantidade, preco_unitario, produtos(marca, volume_litros)")
    .eq("pedido_id", id)

  const items = (rawItems ?? []).map((item) => ({
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
  })) as { quantidade: number; preco_unitario: number; produtos: { marca: string; volume_litros: number } }[]

  const { data: logs } = await supabase
    .from("pedido_status_log")
    .select("*")
    .eq("pedido_id", id)
    .order("changed_at", { ascending: false })

  return <OrderTracker pedido={pedido} items={items} logs={logs ?? []} />
}

export default PedidoPage
