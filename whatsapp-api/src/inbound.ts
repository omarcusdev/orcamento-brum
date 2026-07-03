import { downloadMediaMessage, normalizeMessageContent } from "@whiskeysockets/baileys"
import { postSigned } from "./webhook.js"

type Direcao = "entrada" | "saida"

// Canonical inbound media kinds. MUST stay in sync with the app payload (app/lib/whatsapp/inbound.ts
// MIDIA_TIPOS) and the midia_tipo CHECK constraint in supabase/migrations/030_whatsapp_midia.sql.
const MIDIA_TIPOS = ["image", "audio", "video", "document", "sticker"] as const
type MidiaTipo = (typeof MIDIA_TIPOS)[number]

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: Direcao
  corpo: string
  ocorridaEm: string
  // Inbound media (Task B3). midiaTipo is set for the five storable media kinds; midiaBase64 +
  // mimeType are only present when the bytes were downloaded AND fit under the inline size cap
  // (image/audio only). Everything else keeps just the labeled placeholder corpo. Pre-media
  // consumers ignore these optional fields, so the payload stays backward-compatible.
  midiaTipo?: MidiaTipo
  mimeType?: string
  midiaBase64?: string
}

// Only the live socket's updateMediaMessage is needed here — narrow it so callers can pass a full
// WASocket without coupling this module to the whole socket surface.
type MediaReuploadSocket = { updateMediaMessage: (msg: any) => Promise<any> }

// downloadMediaMessage's context requires an ILogger; we do our own error logging, so feed it a
// silent one. Structurally identical to Baileys' ILogger (not re-exported from the package root).
type MinimalLogger = {
  level: string
  child: (obj: Record<string, unknown>) => MinimalLogger
  trace: (obj: unknown, msg?: string) => void
  debug: (obj: unknown, msg?: string) => void
  info: (obj: unknown, msg?: string) => void
  warn: (obj: unknown, msg?: string) => void
  error: (obj: unknown, msg?: string) => void
}
const silentLogger: MinimalLogger = {
  level: "silent",
  child: () => silentLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const MEDIA_KEY_TO_TIPO: Record<string, MidiaTipo> = {
  imageMessage: "image",
  audioMessage: "audio",
  videoMessage: "video",
  documentMessage: "document",
  stickerMessage: "sticker",
}
const MEDIA_KEYS = Object.keys(MEDIA_KEY_TO_TIPO)

// Only image + audio are inlined as base64 (they are small and the inbox renders them). Video/doc
// are never inlined; sticker gets a type + placeholder but no bytes.
const INLINE_TIPOS: ReadonlySet<MidiaTipo> = new Set<MidiaTipo>(["image", "audio"])

// base64 inflates ~33%, so keep the raw cap well under Vercel's ~4.5 MB request-body limit.
// Overridable via env for tuning without a redeploy.
const DEFAULT_MAX_INLINE_BYTES = 3 * 1024 * 1024
const getMaxInlineBytes = (): number => {
  const fromEnv = Number(process.env.MEDIA_INLINE_MAX_BYTES)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_INLINE_BYTES
}

const DEFAULT_MIME: Record<MidiaTipo, string> = {
  image: "image/jpeg",
  audio: "audio/ogg",
  video: "video/mp4",
  document: "application/octet-stream",
  sticker: "image/webp",
}

const textOf = (m: any): string | null =>
  m?.conversation ??
  m?.extendedTextMessage?.text ??
  m?.imageMessage?.caption ??
  m?.videoMessage?.caption ??
  m?.documentMessage?.caption ??
  null

const digitsFromJid = (j?: string | null): string =>
  j ? j.split("@")[0].split(":")[0].replace(/\D/g, "") : ""

// fileLength arrives as number | Long | string depending on the message; coerce defensively.
const toFiniteNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (v && typeof v === "object" && typeof (v as any).toNumber === "function") {
    const n = (v as any).toNumber()
    return typeof n === "number" && Number.isFinite(n) ? n : null
  }
  return null
}

const mediaPlaceholder = (tipo: MidiaTipo, isPtt: boolean): string => {
  switch (tipo) {
    case "image":
      return "🖼️ Imagem recebida"
    case "audio":
      return isPtt ? "🎤 Áudio recebido" : "🎵 Áudio recebido"
    case "video":
      return "🎥 Vídeo recebido"
    case "document":
      return "📄 Documento recebido"
    case "sticker":
      return "💟 Figurinha recebida"
  }
}

// location/contact/poll are not storable media, but they must NOT vanish from the inbox — surface a
// labeled placeholder so the operator sees that something arrived.
const otherContentPlaceholder = (content: any): string | null => {
  if (content?.locationMessage || content?.liveLocationMessage) return "📍 Localização recebida"
  if (content?.contactMessage || content?.contactsArrayMessage) return "👤 Contato recebido"
  if (content?.pollCreationMessage || content?.pollCreationMessageV2 || content?.pollCreationMessageV3)
    return "📊 Enquete recebida"
  return null
}

type InlineMedia = { midiaBase64: string; mimeType: string }

// Best-effort download of image/audio bytes for inline transport. NEVER throws — any failure
// (network, decrypt, missing socket, oversize) resolves to null so the caller keeps the placeholder.
const tryDownloadInline = async (
  normalizedMsg: any,
  media: any,
  tipo: MidiaTipo,
  sock?: MediaReuploadSocket | null,
): Promise<InlineMedia | null> => {
  const cap = getMaxInlineBytes()

  // Short-circuit obviously-too-large media using the declared length (avoids a wasted download).
  const declaredLen = toFiniteNumber(media?.fileLength)
  if (declaredLen != null && declaredLen > cap) return null

  try {
    const buffer = await downloadMediaMessage(normalizedMsg, "buffer", {}, {
      logger: silentLogger,
      reuploadRequest: (m: any) => {
        if (!sock) throw new Error("no live socket for media reupload")
        return sock.updateMediaMessage(m)
      },
    })
    if (!buffer || buffer.length === 0 || buffer.length > cap) return null
    const declaredMime = typeof media?.mimetype === "string" && media.mimetype ? media.mimetype : null
    return { midiaBase64: buffer.toString("base64"), mimeType: declaredMime ?? DEFAULT_MIME[tipo] }
  } catch (err) {
    console.error("media download failed, keeping labeled placeholder:", err)
    return null
  }
}

// WAMessage -> normalized payload, or null to skip (group, broadcast, protocol, empty). Async because
// image/audio bytes are downloaded here; the live socket is threaded in for media re-upload requests.
export const extractInbound = async (
  msg: any,
  sock?: MediaReuploadSocket | null,
): Promise<InboundPayload | null> => {
  const jid: string | undefined = msg?.key?.remoteJid
  if (!jid) return null
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast")) return null // ignora grupos e status

  const waMessageId: string | undefined = msg?.key?.id
  if (!waMessageId) return null

  // DMs vêm como @s.whatsapp.net OU @lid (identidade oculta nova). No caso @lid o número real
  // chega num campo alternativo (remoteJidAlt/senderPn); usamos o primeiro que tiver dígitos.
  const k = msg.key
  const telefone =
    [
      jid.endsWith("@s.whatsapp.net") ? jid : null,
      k?.remoteJidAlt,
      k?.senderPn,
      k?.participantAlt,
      k?.participantPn,
    ]
      .map(digitsFromJid)
      .find((d) => d.length >= 8) || digitsFromJid(jid) // fallback: dígitos do próprio jid (lid)
  if (!telefone) return null

  const direcao: Direcao = msg?.key?.fromMe ? "saida" : "entrada"

  // WhatsApp embrulha o conteúdo (ephemeralMessage/viewOnce/edited); normaliza antes de ler.
  const content: any = normalizeMessageContent(msg?.message)

  const tsSec = Number(msg?.messageTimestamp) || Math.floor(Date.now() / 1000)
  const base = { telefone, waMessageId, direcao, ocorridaEm: new Date(tsSec * 1000).toISOString() }
  const caption = textOf(content)

  const mediaKey = MEDIA_KEYS.find((key) => content?.[key])
  if (mediaKey) {
    const tipo = MEDIA_KEY_TO_TIPO[mediaKey]
    const media = content[mediaKey]
    const isPtt = mediaKey === "audioMessage" && Boolean(media?.ptt)
    const corpo = caption || mediaPlaceholder(tipo, isPtt)
    const declaredMime = typeof media?.mimetype === "string" && media.mimetype ? media.mimetype : undefined

    const inline = INLINE_TIPOS.has(tipo)
      ? await tryDownloadInline({ ...msg, message: content }, media, tipo, sock)
      : null

    if (inline) {
      return { ...base, corpo, midiaTipo: tipo, mimeType: inline.mimeType, midiaBase64: inline.midiaBase64 }
    }
    return { ...base, corpo, midiaTipo: tipo, ...(declaredMime ? { mimeType: declaredMime } : {}) }
  }

  if (caption) {
    return { ...base, corpo: caption }
  }

  const otherPlaceholder = otherContentPlaceholder(content)
  if (otherPlaceholder) {
    return { ...base, corpo: otherPlaceholder }
  }

  return null // protocolo/efêmero/vazio
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
    const res = await postSigned(url, secret, "x-inbound-secret", payload)
    if (!res.ok) {
      console.error("forwardInbound non-2xx:", res.status)
    }
  } catch (err) {
    console.error("forwardInbound failed:", err)
  }
}
