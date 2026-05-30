import { getWhatsappAlertEmail, getWhatsappConnection } from "@/lib/whatsapp/admin-actions"
import { getConversas } from "@/lib/whatsapp/chat-actions"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"

export const dynamic = "force-dynamic"

const WhatsappPage = async () => {
  const [connection, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">WhatsApp</h1>

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">CONEXAO</h2>
          <WhatsAppConnection initial={connection} />
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ALERTA POR EMAIL</h2>
          <WhatsappAlertEmail initialEmail={alertEmail} />
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-1">CONVERSAS</h2>
          <p className="text-sm text-brand-warm-gray mb-4">
            As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
          </p>
          <AtendimentoClient initial={conversas} />
        </section>
      </div>
    </div>
  )
}

export default WhatsappPage
