import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatDate = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

const ConfirmacaoPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(`
      id, total, subtotal, data_evento, horario_evento, status,
      endereco, tipo_chopeira, metodo_pagamento, observacoes,
      clientes ( nome, telefone ),
      pedido_itens ( quantidade, preco_unitario, subtotal, produtos ( marca, volume_litros ) )
    `)
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const cliente = pedido.clientes as any
  const itens = (pedido.pedido_itens as any[]) || []

  const metodoPagamentoLabel: Record<string, string> = {
    pix: "Pix",
    cartao: "Cartão",
    dinheiro: "Dinheiro",
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="font-display text-4xl text-white uppercase tracking-wider mb-2">Pedido Recebido!</h1>
          <p className="text-brand-warm-gray">
            Entraremos em contato pelo WhatsApp para confirmar.
          </p>
        </div>

        <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <span className="text-brand-warm-gray text-sm">Pedido</span>
            <span className="font-mono text-xs text-brand-gray-light">#{pedido.id.slice(0, 8)}</span>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-brand-warm-gray uppercase tracking-wider">Itens</p>
            {itens.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5">
                <span className="text-white text-sm">
                  {item.quantidade}x {item.produtos?.marca} {item.produtos?.volume_litros}L
                </span>
                <span className="text-brand-yellow text-sm font-medium">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/10">
            <span className="text-white font-medium">Total</span>
            <span className="font-display text-2xl text-brand-yellow">{formatPrice(pedido.total)}</span>
          </div>
        </div>

        <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-brand-warm-gray">Cliente</span>
            <span className="text-white">{cliente?.nome}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-warm-gray">Evento</span>
            <span className="text-white">{formatDate(pedido.data_evento)} às {pedido.horario_evento.slice(0, 5)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-warm-gray">Endereço</span>
            <span className="text-white text-right max-w-[60%]">{pedido.endereco}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-warm-gray">Chopeira</span>
            <span className="text-white capitalize">{pedido.tipo_chopeira}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-brand-warm-gray">Pagamento</span>
            <span className="text-white">{metodoPagamentoLabel[pedido.metodo_pagamento] || pedido.metodo_pagamento}</span>
          </div>
          {pedido.observacoes && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-brand-warm-gray text-xs mb-1">Observações</p>
              <p className="text-white text-sm">{pedido.observacoes}</p>
            </div>
          )}
        </div>

        <div className="bg-brand-yellow/10 border border-brand-yellow/30 rounded-xl p-4 flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-yellow mt-0.5 shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <div>
            <p className="text-brand-yellow text-sm font-medium">Envie seus documentos</p>
            <p className="text-brand-warm-gray text-xs">Na pagina de acompanhamento, envie seu documento pessoal e comprovante de residencia para agilizar a confirmacao.</p>
          </div>
        </div>

        <Link
          href={`/pedido/${pedido.id}`}
          className="block w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition text-center"
        >
          Acompanhar Pedido
        </Link>
        <Link href="/" className="block text-center text-sm text-brand-warm-gray hover:text-brand-yellow transition">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export default ConfirmacaoPage
