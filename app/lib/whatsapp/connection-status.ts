// app/lib/whatsapp/connection-status.ts
import type { WhatsappConnection } from "./admin-actions"

export type ChipEstado = "conectado" | "reconectando" | "conectando" | "desconectado"
export type ChipTom = "verde" | "amarelo" | "cinza" | "vermelho"

export type ChipStatus = {
  estado: ChipEstado
  label: string
  tom: ChipTom
  pulsar: boolean
  acionavel: boolean
}

// Espelha os ramos do WhatsAppConnection (status connected/paired/qr/code/idle).
export const connectionStatus = (c: WhatsappConnection): ChipStatus => {
  if (c.status === "connected" && c.paired) {
    return { estado: "conectado", label: "Conectado", tom: "verde", pulsar: false, acionavel: false }
  }
  if (c.paired) {
    return { estado: "reconectando", label: "Reconectando…", tom: "amarelo", pulsar: true, acionavel: false }
  }
  if (c.qrDataUrl !== null || c.code !== null || c.status === "connecting") {
    return { estado: "conectando", label: "Conectando…", tom: "cinza", pulsar: true, acionavel: false }
  }
  return { estado: "desconectado", label: "Desconectado", tom: "vermelho", pulsar: false, acionavel: true }
}

// Movido de whatsapp-connection.tsx pra ser reusado pelo chip (DRY).
export const formatPairedNumber = (me: string): string => {
  const digits = me.replace(/\D/g, "")
  if (digits.length >= 12) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const meio = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`
    return `+55 (${ddd}) ${meio}`
  }
  return `+${digits}`
}
