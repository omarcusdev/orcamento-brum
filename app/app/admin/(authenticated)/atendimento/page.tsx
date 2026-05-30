import { getConversas } from "@/lib/whatsapp/chat-actions"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"

export const dynamic = "force-dynamic"

const AtendimentoPage = async () => {
  const conversas = await getConversas()
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl text-brand-yellow mb-1">Atendimento</h1>
      <p className="text-sm text-brand-warm-gray mb-4">
        As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
      </p>
      <AtendimentoClient initial={conversas} />
    </div>
  )
}

export default AtendimentoPage
