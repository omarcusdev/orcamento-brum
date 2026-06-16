import {
  getWhatsappAlertEmail,
  getWhatsappAgenteConfig,
  getWhatsappBotSaudacaoConfig,
  getWhatsappConnection,
  getWhatsappFeatures,
  getWhatsappLembreteConfig,
  getWhatsappStatusEntregaConfig,
} from "@/lib/whatsapp/admin-actions"
import { getConversas } from "@/lib/whatsapp/chat-actions"
import WhatsappAdminShell from "@/components/admin/whatsapp/whatsapp-admin-shell"

export const dynamic = "force-dynamic"

const WhatsappPage = async () => {
  const [connection, features, statusEntrega, lembrete, botSaudacao, agente, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappStatusEntregaConfig(),
    getWhatsappLembreteConfig(),
    getWhatsappBotSaudacaoConfig(),
    getWhatsappAgenteConfig(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])

  return (
    <WhatsappAdminShell
      initialConnection={connection}
      features={features}
      statusEntrega={statusEntrega}
      lembrete={lembrete}
      botSaudacao={botSaudacao}
      agente={agente}
      alertEmail={alertEmail}
      conversas={conversas}
    />
  )
}

export default WhatsappPage
