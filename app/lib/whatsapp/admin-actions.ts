"use server"

import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"
import {
  fetchConnection,
  postLogout,
  startPairing,
  type PairingMethod,
  type WhatsappConnectionStatus,
} from "./control"

export type WhatsappConnection = {
  status: WhatsappConnectionStatus
  paired: boolean
  qrDataUrl: string | null
  code: string | null
  me: string | null
}

export const getWhatsappConnection = async (): Promise<WhatsappConnection> => {
  await requireAdmin()

  const { status, paired, qr, code, me } = await fetchConnection()

  const qrDataUrl = qr ? await QRCode.toDataURL(qr, { width: 280, margin: 2 }) : null

  return { status, paired, qrDataUrl, code, me }
}

export const connectWhatsapp = async (
  method: PairingMethod,
  phone?: string,
): Promise<{ ok: boolean }> => {
  await requireAdmin()

  if (method === "code" && !phone?.trim()) {
    return { ok: false }
  }

  return startPairing(method, phone?.trim())
}

export const disconnectWhatsapp = async (): Promise<{ ok: boolean }> => {
  await requireAdmin()
  return postLogout()
}
