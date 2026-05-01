import { getConfig } from "@/lib/queries"
import ConfigForm from "@/components/admin/config-form"

const ConfiguracoesPage = async () => {
  const [whatsappNumero, emailDestinatario, emailAtivoRaw] = await Promise.all([
    getConfig("whatsapp_numero"),
    getConfig("email_notificacao_destinatario"),
    getConfig("email_notificacao_ativo"),
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">Configurações</h1>
      <ConfigForm
        whatsappNumero={whatsappNumero ?? ""}
        emailDestinatario={emailDestinatario ?? ""}
        emailAtivo={emailAtivoRaw === "true"}
      />
    </div>
  )
}

export default ConfiguracoesPage
