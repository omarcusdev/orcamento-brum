export type InboundDirecao = "entrada" | "saida"

// Canonical inbound media kinds. Must stay in sync with the midia_tipo CHECK constraint in
// supabase/migrations/030_whatsapp_midia.sql.
export const MIDIA_TIPOS = ["image", "audio", "video", "document", "sticker"] as const
export type MidiaTipo = (typeof MIDIA_TIPOS)[number]

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: InboundDirecao
  corpo: string
  ocorridaEm: string
  // Optional inbound media (Task B2). Only present once the EC2 (Task B3) sends them; a pre-media
  // payload omits all three and parses exactly as before.
  midiaTipo?: MidiaTipo
  mimeType?: string
  midiaBase64?: string
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0

const isMidiaTipo = (v: unknown): v is MidiaTipo =>
  typeof v === "string" && (MIDIA_TIPOS as readonly string[]).includes(v)

export const parseInboundPayload = (raw: unknown): InboundPayload | null => {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (!isNonEmptyString(c.telefone)) return null
  if (!isNonEmptyString(c.waMessageId)) return null
  if (c.direcao !== "entrada" && c.direcao !== "saida") return null
  if (!isNonEmptyString(c.corpo)) return null
  if (!isNonEmptyString(c.ocorridaEm)) return null
  if (Number.isNaN(Date.parse(c.ocorridaEm))) return null

  // Media fields are optional and backward-compatible: absent OR null (JSON may serialize an
  // unset field as null) → the key is simply omitted from the result, so the current pre-media
  // EC2 payload yields the same shape it always did. A present-but-malformed value rejects the
  // whole payload, mirroring the required-field guards above and keeping bad input away from the
  // midia_tipo CHECK constraint (migration 030).
  if (c.midiaTipo != null && !isMidiaTipo(c.midiaTipo)) return null
  if (c.mimeType != null && !isNonEmptyString(c.mimeType)) return null
  if (c.midiaBase64 != null && !isNonEmptyString(c.midiaBase64)) return null

  const midiaTipo = isMidiaTipo(c.midiaTipo) ? c.midiaTipo : undefined
  const mimeType = isNonEmptyString(c.mimeType) ? c.mimeType : undefined
  const midiaBase64 = isNonEmptyString(c.midiaBase64) ? c.midiaBase64 : undefined

  return {
    telefone: c.telefone,
    waMessageId: c.waMessageId,
    direcao: c.direcao,
    corpo: c.corpo,
    ocorridaEm: c.ocorridaEm,
    ...(midiaTipo !== undefined ? { midiaTipo } : {}),
    ...(mimeType !== undefined ? { mimeType } : {}),
    ...(midiaBase64 !== undefined ? { midiaBase64 } : {}),
  }
}
