export type InboundDirecao = "entrada" | "saida"

export type InboundPayload = {
  telefone: string
  waMessageId: string
  direcao: InboundDirecao
  corpo: string
  ocorridaEm: string
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0

export const parseInboundPayload = (raw: unknown): InboundPayload | null => {
  if (!raw || typeof raw !== "object") return null
  const c = raw as Record<string, unknown>
  if (!isNonEmptyString(c.telefone)) return null
  if (!isNonEmptyString(c.waMessageId)) return null
  if (c.direcao !== "entrada" && c.direcao !== "saida") return null
  if (!isNonEmptyString(c.corpo)) return null
  if (!isNonEmptyString(c.ocorridaEm)) return null
  if (Number.isNaN(Date.parse(c.ocorridaEm))) return null
  return {
    telefone: c.telefone,
    waMessageId: c.waMessageId,
    direcao: c.direcao,
    corpo: c.corpo,
    ocorridaEm: c.ocorridaEm,
  }
}
