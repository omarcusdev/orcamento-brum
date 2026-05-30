import { getWhatsappConnection } from "@/lib/whatsapp/admin-actions"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"

const WhatsappPage = async () => {
  const initial = await getWhatsappConnection()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">WhatsApp</h1>
      <WhatsAppConnection initial={initial} />
    </div>
  )
}

export default WhatsappPage
