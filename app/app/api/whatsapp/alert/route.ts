import { NextResponse } from "next/server"
import { sendWhatsAppDownAlert } from "@/lib/email"
import { isWhatsappFeatureEnabled } from "@/lib/whatsapp/features"

const isReason = (value: unknown): value is "logged_out" | "offline" =>
  value === "logged_out" || value === "offline"

export const POST = async (request: Request) => {
  const secret = process.env.ALERT_WEBHOOK_SECRET

  if (!secret || request.headers.get("x-alert-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  if (!(await isWhatsappFeatureEnabled("whatsapp_alerta_ativo"))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
    const body = await request.json().catch(() => null)
    const reason = body && typeof body === "object" ? (body as Record<string, unknown>).reason : null

    if (isReason(reason)) {
      await sendWhatsAppDownAlert(reason)
    } else {
      console.error("[whatsapp-alert-route] reason inválido:", reason)
    }
  } catch (err) {
    console.error("[whatsapp-alert-route] erro inesperado:", err)
  }

  return NextResponse.json({ ok: true })
}
