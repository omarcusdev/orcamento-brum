import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import OrderTimeline from "@/components/order-timeline"
import StatusActions from "@/components/admin/status-actions"

type Props = {
  params: Promise<{ id: string }>
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const AdminOrderDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(nome, telefone, email)")
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const { data: items } = await supabase
    .from("pedido_itens")
    .select("quantidade, preco_unitario, produtos(marca, volume_litros)")
    .eq("pedido_id", id)

  const { data: logs } = await supabase
    .from("pedido_status_log")
    .select("*")
    .eq("pedido_id", id)
    .order("changed_at", { ascending: false })

  const whatsappLink = `https://wa.me/${pedido.clientes.telefone.replace(/\D/g, "")}`

  return (
    <div>
      <Link href="/admin/pedidos" className="text-brand-yellow font-medium mb-4 inline-block hover:underline">
        ← Voltar
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-black">{pedido.clientes.nome}</h1>
          <p className="text-sm text-gray-400 font-mono">{pedido.id.slice(0, 8)}</p>
        </div>
        <OrderStatusBadge status={pedido.status as PedidoStatus} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-brand-black mb-3">Cliente</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nome</span>
                <span>{pedido.clientes.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telefone</span>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                  {pedido.clientes.telefone}
                </a>
              </div>
              {pedido.clientes.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span>{pedido.clientes.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-brand-black mb-3">Evento</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Data</span>
                <span>{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Horario</span>
                <span>{pedido.horario_evento.slice(0, 5)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Chopeira</span>
                <span className="capitalize">{pedido.tipo_chopeira}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Endereco</span>
                <span className="text-sm">{pedido.endereco}</span>
              </div>
              {pedido.observacoes && (
                <div>
                  <span className="text-gray-500 block mb-1">Observacoes</span>
                  <span className="text-sm">{pedido.observacoes}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-brand-black mb-3">Itens</h2>
            {(items ?? []).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm py-1">
                <span className="text-gray-600">
                  {item.quantidade}x {item.produtos?.marca ?? item.produtos?.[0]?.marca} {item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros}L
                </span>
                <span className="font-medium">{formatPrice(item.preco_unitario * item.quantidade)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold mt-3 pt-3 border-t border-gray-100">
              <span>Total</span>
              <span>{formatPrice(pedido.total)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-500">Pagamento</span>
              <span className={pedido.pago ? "text-green-600 font-medium" : "text-yellow-600"}>
                {pedido.metodo_pagamento ?? "—"} {pedido.pago ? "✓ Pago" : "• Pendente"}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-bold text-brand-black mb-4">Acoes</h2>
            <StatusActions pedidoId={pedido.id} currentStatus={pedido.status as PedidoStatus} pago={pedido.pago} />
          </div>

          {(logs ?? []).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="font-bold text-brand-black mb-4">Historico</h2>
              <OrderTimeline logs={logs ?? []} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetailPage
