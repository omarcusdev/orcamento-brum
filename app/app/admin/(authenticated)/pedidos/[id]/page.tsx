import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import OrderTimeline from "@/components/order-timeline"
import StatusActions from "@/components/admin/status-actions"
import FadeIn from "@/components/admin/fade-in"
import DocumentSection from "@/components/admin/document-section"

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
    .select("*, clientes(id, nome, telefone, email, cpf, documento_pessoal_url, documento_verificado, documento_verificado_em)")
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
      <FadeIn>
        <Link href="/admin/pedidos" className="text-brand-yellow font-medium mb-4 inline-block hover:underline">
          ← Voltar
        </Link>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold text-white tracking-wide">{pedido.clientes.nome.toUpperCase()}</h1>
            <p className="text-sm text-brand-warm-gray font-mono">{pedido.id.slice(0, 8)}</p>
          </div>
          <OrderStatusBadge status={pedido.status as PedidoStatus} />
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <FadeIn delay={0.1}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">CLIENTE</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Nome</span>
                  <span className="text-white">{pedido.clientes.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Telefone</span>
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                    {pedido.clientes.telefone}
                  </a>
                </div>
                {pedido.clientes.cpf && (
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">CPF</span>
                    <span className="text-white">{pedido.clientes.cpf}</span>
                  </div>
                )}
                {pedido.clientes.email && (
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">Email</span>
                    <span className="text-white">{pedido.clientes.email}</span>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <DocumentSection
              clienteId={pedido.clientes.id}
              pedidoId={pedido.id}
              documentoUrl={pedido.clientes.documento_pessoal_url}
              documentoVerificado={pedido.clientes.documento_verificado}
              documentoVerificadoEm={pedido.clientes.documento_verificado_em}
            />
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">EVENTO</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Data</span>
                  <span className="text-white">{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Horario</span>
                  <span className="text-white">{pedido.horario_evento.slice(0, 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-warm-gray">Chopeira</span>
                  <span className="text-white capitalize">{pedido.tipo_chopeira}</span>
                </div>
                <div>
                  <span className="text-brand-warm-gray block mb-1">Endereco</span>
                  <span className="text-sm text-white">{pedido.endereco}</span>
                </div>
                {pedido.observacoes && (
                  <div>
                    <span className="text-brand-warm-gray block mb-1">Observacoes</span>
                    <span className="text-sm text-white">{pedido.observacoes}</span>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ITENS</h2>
              {(items ?? []).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-brand-gray-light">
                    {item.quantidade}x {item.produtos?.marca ?? item.produtos?.[0]?.marca} {item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros}L
                  </span>
                  <span className="font-medium text-white">{formatPrice(item.preco_unitario * item.quantidade)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold mt-3 pt-3 border-t border-white/10">
                <span className="text-white">Total</span>
                <span className="text-brand-yellow">{formatPrice(pedido.total)}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-brand-warm-gray">Pagamento</span>
                <span className={pedido.pago ? "text-green-400 font-medium" : "text-brand-yellow"}>
                  {pedido.metodo_pagamento ?? "—"} {pedido.pago ? "✓ Pago" : "• Pendente"}
                </span>
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="space-y-6">
          <FadeIn delay={0.12}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-4">ACOES</h2>
              <StatusActions pedidoId={pedido.id} currentStatus={pedido.status as PedidoStatus} pago={pedido.pago} />
            </div>
          </FadeIn>

          {(logs ?? []).length > 0 && (
            <FadeIn delay={0.18}>
              <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-lg font-bold text-white tracking-wide mb-4">HISTORICO</h2>
                <OrderTimeline logs={logs ?? []} />
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetailPage
