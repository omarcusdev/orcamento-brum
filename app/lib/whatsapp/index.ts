import { sendViaBaileys } from "./baileys"

export type WhatsAppResult = { ok: boolean; error?: string }

type WhatsAppProvider = "baileys" | "cloud"

type WhatsAppAdapter = (telefone: string, mensagem: string) => Promise<WhatsAppResult>

const adapters: Record<WhatsAppProvider, WhatsAppAdapter> = {
  baileys: sendViaBaileys,
  cloud: async () => ({ ok: false, error: "cloud provider not implemented" }),
}

const resolveProvider = (): WhatsAppProvider =>
  process.env.WHATSAPP_PROVIDER === "cloud" ? "cloud" : "baileys"

export const sendWhatsAppMessage = (telefone: string, mensagem: string): Promise<WhatsAppResult> =>
  adapters[resolveProvider()](telefone, mensagem)
