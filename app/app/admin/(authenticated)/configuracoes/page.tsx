import { getConfig } from "@/lib/queries"
import ConfigForm from "@/components/admin/config-form"

const ConfiguracoesPage = async () => {
  const whatsappNumero = await getConfig("whatsapp_numero") ?? ""

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">Configurações</h1>
      <ConfigForm whatsappNumero={whatsappNumero} />
    </div>
  )
}

export default ConfiguracoesPage
