import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import type { PedidoStatus } from "@/lib/types"
import OrderStatusBadge from "@/components/order-status-badge"
import OrderTimeline from "@/components/order-timeline"
import StatusActions from "@/components/admin/status-actions"
import FadeIn from "@/components/admin/fade-in"
import DocumentSection from "@/components/admin/document-section"
import FreteInput from "@/components/admin/frete-input"
import FreteBanner from "@/components/admin/frete-banner"
import ArchiveToggle from "@/components/admin/archive-toggle"
import ConsignadoBanner from "@/components/admin/consignado-banner"
import EditOrderTrigger from "@/components/admin/edit-order-trigger"
import EditLog from "@/components/admin/edit-log"
import { formatBRL, formatEventDate, metodoPagamentoLabel } from "@/lib/format"
import { buildDispatchText } from "@/lib/whatsapp/entregador-message"
import { LOCKED_EDIT_STATUSES, isFreteLocked } from "@/lib/admin-status"
import { orderDisplayTotals, toDispatchItens } from "@/lib/admin-ordem-detail"
import type { Produto } from "@/lib/types"

type Props = {
  params: Promise<{ id: string }>
}

const AdminOrderDetailPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, clientes(id, nome, telefone, email, cpf, documento_pessoal_urls, comprovante_residencia_url, documento_verificado, documento_verificado_em), entregadores(id, nome, telefone)")
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const { data: items } = await supabase
    .from("pedido_itens")
    .select("id, produto_id, quantidade, preco_unitario, subtotal, is_consignado, consignado_status, produtos(marca, volume_litros)")
    .eq("pedido_id", id)

  const [{ data: logs }, { data: editLogs }, { data: produtos }] = await Promise.all([
    supabase
      .from("pedido_status_log")
      .select("*")
      .eq("pedido_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("pedido_edit_log")
      .select("*")
      .eq("pedido_id", id)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  ])

  const whatsappLink = `https://wa.me/${pedido.clientes.telefone.replace(/\D/g, "")}`

  const { data: conversaCliente } = await supabase
    .from("conversas_whatsapp")
    .select("id")
    .eq("cliente_id", pedido.clientes.id)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  const itemsForTotals = (items ?? []).map((i: any) => ({
    subtotal: Number(i.subtotal),
    is_consignado: !!i.is_consignado,
    consignado_status: i.consignado_status as string | null,
  }))
  const totals = orderDisplayTotals(itemsForTotals, pedido.desconto ?? 0, pedido.frete ?? 0)
  const consignadosPendentes = (items ?? []).filter((i: any) => i.is_consignado && i.consignado_status === "pendente")

  const lockedForEdit = LOCKED_EDIT_STATUSES.includes(pedido.status)
  const editablePedido = {
    id: pedido.id,
    status: pedido.status,
    data_evento: pedido.data_evento,
    horario_evento: pedido.horario_evento,
    endereco: pedido.endereco,
    endereco_completo: pedido.endereco_completo,
    observacoes: pedido.observacoes,
    rampas_escadas: pedido.rampas_escadas,
    tipo_chopeira: pedido.tipo_chopeira as "gelo" | "eletrica",
    frete: Number(pedido.frete ?? 0),
    desconto: Number(pedido.desconto ?? 0),
    metodo_pagamento: pedido.metodo_pagamento as "pix" | "cartao" | "dinheiro" | null,
    pago: !!pedido.pago,
  }
  const editableItems = (items ?? []).map((item: any) => ({
    id: item.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unitario: Number(item.preco_unitario),
    is_consignado: !!item.is_consignado,
    consignado_status: item.consignado_status,
    subtotal: Number(item.subtotal),
    produtos: Array.isArray(item.produtos) ? item.produtos[0] : item.produtos,
  }))

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

      {pedido.frete === 0 && !isFreteLocked(pedido.status) && (
        <FreteBanner />
      )}

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
                {conversaCliente && (
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/whatsapp?conversa=${conversaCliente.id}`}
                      className="text-sm text-brand-yellow hover:underline"
                    >
                      Abrir conversa no WhatsApp →
                    </Link>
                  </div>
                )}
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
              documentoStatus={pedido.documento_status}
              documentoPessoalUrls={pedido.clientes.documento_pessoal_urls}
              comprovanteResidenciaUrl={pedido.clientes.comprovante_residencia_url}
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
                  <span className="text-white">{formatEventDate(pedido.data_evento)}</span>
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
                {pedido.rampas_escadas && (
                  <div>
                    <span className="text-brand-warm-gray block mb-1">Rampas/Escadas</span>
                    <span className="text-sm text-white">{pedido.rampas_escadas}</span>
                  </div>
                )}
                {pedido.observacoes && (
                  <div>
                    <span className="text-brand-warm-gray block mb-1">Observacoes</span>
                    <span className="text-sm text-white">{pedido.observacoes}</span>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>

          {consignadosPendentes.length > 0 && (
            <FadeIn delay={0.17}>
              <div className="space-y-3">
                {consignadosPendentes.map((item: any) => {
                  const marca = item.produtos?.marca ?? item.produtos?.[0]?.marca
                  const volume = item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros
                  return (
                    <ConsignadoBanner
                      key={item.id}
                      itemId={item.id}
                      produtoLabel={`${marca} ${volume}L`}
                      subtotal={Number(item.subtotal)}
                    />
                  )
                })}
              </div>
            </FadeIn>
          )}

          <FadeIn delay={0.2}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ITENS</h2>
              {(items ?? []).map((item: any, idx: number) => {
                const marca = item.produtos?.marca ?? item.produtos?.[0]?.marca
                const volume = item.produtos?.volume_litros ?? item.produtos?.[0]?.volume_litros
                const consignTag = item.is_consignado
                  ? ` · consignado${item.consignado_status === "pendente" ? " (pendente)" : item.consignado_status === "devolvido" ? " (devolvido)" : " (usado)"}`
                  : ""
                return (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span className={item.consignado_status === "devolvido" ? "text-brand-warm-gray line-through" : "text-brand-gray-light"}>
                      {item.quantidade}x {marca} {volume}L{consignTag}
                    </span>
                    <span className="font-medium text-white">{formatBRL(Number(item.subtotal))}</span>
                  </div>
                )
              })}
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-warm-gray">Subtotal</span>
                  <span className="text-white">{formatBRL(pedido.subtotal)}</span>
                </div>
                {pedido.desconto > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-warm-gray">Desconto</span>
                    <span className="text-green-400">- {formatBRL(pedido.desconto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm items-center">
                  <div>
                    <span className="text-brand-yellow font-medium">Frete</span>
                    {pedido.frete === 0 && !isFreteLocked(pedido.status) && (
                      <span className="text-amber-400 text-xs ml-2">← definir valor</span>
                    )}
                  </div>
                  <FreteInput
                    pedidoId={pedido.id}
                    initialFrete={pedido.frete}
                    readOnly={isFreteLocked(pedido.status)}
                  />
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-white/10">
                  <span className="text-white">Total</span>
                  <span className="text-brand-yellow">
                    {totals.hasPendente
                      ? `${formatBRL(totals.totalMin)} / ${formatBRL(totals.totalMax)}`
                      : formatBRL(pedido.total)}
                  </span>
                </div>
                {totals.hasPendente && (
                  <p className="text-xs text-brand-warm-gray text-right">Min (consignado devolvido) / Max (consignado usado)</p>
                )}
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-brand-warm-gray">Pagamento</span>
                <span className="text-brand-yellow">{metodoPagamentoLabel(pedido.metodo_pagamento)}</span>
              </div>
            </div>
          </FadeIn>
        </div>

        <div className="space-y-6">
          <FadeIn delay={0.12}>
            <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
              <h2 className="font-display text-lg font-bold text-white tracking-wide mb-4">ACOES</h2>
              <StatusActions
                pedidoId={pedido.id}
                currentStatus={pedido.status as PedidoStatus}
                documentoStatus={pedido.documento_status}
                frete={pedido.frete ?? 0}
                dispatchText={buildDispatchText({
                  pedidoId: pedido.id,
                  clienteNome: pedido.clientes.nome,
                  clienteTelefone: pedido.clientes.telefone,
                  dataEvento: pedido.data_evento,
                  horarioEvento: pedido.horario_evento,
                  tipoChopeira: pedido.tipo_chopeira,
                  rampasEscadas: pedido.rampas_escadas,
                  subtotal: pedido.subtotal,
                  frete: pedido.frete ?? 0,
                  metodoPagamento: pedido.metodo_pagamento,
                  observacoes: pedido.observacoes,
                  endereco: pedido.endereco,
                  enderecoCompleto: pedido.endereco_completo,
                  itens: toDispatchItens(items ?? []),
                })}
              />
              {!lockedForEdit && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <EditOrderTrigger
                    pedido={editablePedido}
                    items={editableItems}
                    produtos={(produtos ?? []) as Produto[]}
                  />
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-white/10">
                <ArchiveToggle pedidoId={pedido.id} arquivado={!!pedido.arquivado_em} />
                {pedido.arquivado_em && (
                  <p className="text-xs text-brand-warm-gray mt-2 text-center">
                    Arquivado em {new Date(pedido.arquivado_em).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          </FadeIn>

          {pedido.entregadores && (
            <FadeIn delay={0.15}>
              <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ENTREGADOR</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">Nome</span>
                    <span className="text-white">{pedido.entregadores.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-warm-gray">WhatsApp</span>
                    <a
                      href={`https://wa.me/${pedido.entregadores.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:underline"
                    >
                      {pedido.entregadores.telefone}
                    </a>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {(logs ?? []).length > 0 && (
            <FadeIn delay={0.18}>
              <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
                <h2 className="font-display text-lg font-bold text-white tracking-wide mb-4">HISTORICO</h2>
                <OrderTimeline logs={logs ?? []} />
              </div>
            </FadeIn>
          )}

          {(editLogs ?? []).length > 0 && (
            <FadeIn delay={0.2}>
              <EditLog entries={(editLogs ?? []) as never} />
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminOrderDetailPage
