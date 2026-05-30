import { normalizeMessageContent } from "@whiskeysockets/baileys"

type Direcao = "entrada" | "saida"

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: Direcao
  corpo: string
  ocorridaEm: string
}

const MEDIA_KEYS = ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "stickerMessage"] as const

const textOf = (m: any): string | null =>
  m?.conversation ??
  m?.extendedTextMessage?.text ??
  m?.imageMessage?.caption ??
  m?.videoMessage?.caption ??
  m?.documentMessage?.caption ??
  null

// Pure: WAMessage -> normalized payload, or null to skip (group, protocol, empty).
export const extractInbound = (msg: any): InboundPayload | null => {
  const jid: string | undefined = msg?.key?.remoteJid
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return null // só DM (ignora grupos @g.us e status)
  const waMessageId: string | undefined = msg?.key?.id
  if (!waMessageId) return null

  const telefone = jid.split("@")[0].split(":")[0].replace(/\D/g, "")
  if (!telefone) return null

  const direcao: Direcao = msg?.key?.fromMe ? "saida" : "entrada"

  // WhatsApp embrulha o conteúdo (ephemeralMessage/viewOnce/edited); normaliza antes de ler.
  const content: any = normalizeMessageContent(msg?.message)

  let corpo = textOf(content)
  if (!corpo) {
    const hasMedia = MEDIA_KEYS.some((k) => content?.[k])
    if (!hasMedia) return null // protocolo/efêmero/vazio
    corpo = "[mídia recebida — ver no celular]"
  }

  const tsSec = Number(msg?.messageTimestamp) || Math.floor(Date.now() / 1000)
  return { telefone, waMessageId, direcao, corpo, ocorridaEm: new Date(tsSec * 1000).toISOString() }
}

let missingConfigLogged = false

export const forwardInbound = async (payload: InboundPayload): Promise<void> => {
  const url = process.env.APP_INBOUND_WEBHOOK_URL
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!url || !secret) {
    if (!missingConfigLogged) {
      console.error("Inbound webhook not configured (APP_INBOUND_WEBHOOK_URL / INBOUND_WEBHOOK_SECRET). Skipping capture.")
      missingConfigLogged = true
    }
    return
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-inbound-secret": secret, "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error("forwardInbound non-2xx:", res.status)
    }
  } catch (err) {
    console.error("forwardInbound failed:", err)
  }
}
