"use server"

import { revalidatePath } from "next/cache"
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

// Down-alert recipient: same configuracoes key sendWhatsAppDownAlert reads in lib/email.ts.
const ALERT_EMAIL_KEY = "email_notificacao_destinatario"

export const getWhatsappAlertEmail = async (): Promise<string> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", ALERT_EMAIL_KEY)
    .single()

  return data?.valor?.trim() ?? ""
}

export const setWhatsappAlertEmail = async (email: string): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("configuracoes")
    .update({ valor: email.trim(), updated_at: new Date().toISOString() })
    .eq("chave", ALERT_EMAIL_KEY)

  if (error) return { ok: false }

  revalidatePath("/admin/whatsapp")
  revalidatePath("/admin/configuracoes")
  return { ok: true }
}
