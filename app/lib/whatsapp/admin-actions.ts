"use server"

import QRCode from "qrcode"
import { requireAdmin } from "@/lib/auth"
import { fetchQr, postLogout, type WhatsappConnectionStatus } from "./control"

export type WhatsappConnection = {
  status: WhatsappConnectionStatus
  qrDataUrl: string | null
  me: string | null
}

export const getWhatsappConnection = async (): Promise<WhatsappConnection> => {
  await requireAdmin()

  const { status, qr, me } = await fetchQr()

  const qrDataUrl = qr ? await QRCode.toDataURL(qr, { width: 280, margin: 2 }) : null

  return { status, qrDataUrl, me }
}

export const disconnectWhatsapp = async (): Promise<{ ok: boolean }> => {
  await requireAdmin()
  return postLogout()
}
