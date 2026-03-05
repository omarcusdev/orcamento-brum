import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

const ConfirmacaoPage = async ({ params }: Props) => {
  const { id } = await params
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, total, data_evento, horario_evento, status")
    .eq("id", id)
    .single()

  if (!pedido) notFound()

  const formatPrice = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-brand-black mb-2">Pedido Recebido!</h1>
        <p className="text-gray-500 mb-6">
          Seu pedido foi registrado. Entraremos em contato pelo WhatsApp para confirmar.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pedido</span>
            <span className="font-mono text-xs">{pedido.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold">{formatPrice(pedido.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Evento</span>
            <span>{new Date(pedido.data_evento + "T00:00:00").toLocaleDateString("pt-BR")} às {pedido.horario_evento.slice(0, 5)}</span>
          </div>
        </div>
        <Link
          href={`/pedido/${pedido.id}`}
          className="block w-full bg-brand-yellow text-brand-black font-bold py-3 rounded-lg hover:brightness-110 transition text-center"
        >
          Acompanhar Pedido
        </Link>
        <Link href="/" className="block mt-4 text-sm text-gray-400 hover:text-brand-yellow transition">
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}

export default ConfirmacaoPage
