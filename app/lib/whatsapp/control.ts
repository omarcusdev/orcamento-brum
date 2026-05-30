const REQUEST_TIMEOUT_MS = 10_000

export type WhatsappConnectionStatus = "disconnected" | "connecting" | "connected"

export type QrResponse = {
  status: WhatsappConnectionStatus
  qr: string | null
  me: string | null
}

export type LogoutResponse = {
  ok: boolean
}

const disconnectedFallback: QrResponse = { status: "disconnected", qr: null, me: null }

const isStatus = (value: unknown): value is WhatsappConnectionStatus =>
  value === "disconnected" || value === "connecting" || value === "connected"

export const parseQrResponse = (raw: unknown): QrResponse => {
  if (!raw || typeof raw !== "object") return disconnectedFallback
  const candidate = raw as Record<string, unknown>
  return {
    status: isStatus(candidate.status) ? candidate.status : "disconnected",
    qr: typeof candidate.qr === "string" ? candidate.qr : null,
    me: typeof candidate.me === "string" ? candidate.me : null,
  }
}

const controlUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, "")}${path}`

export const fetchQr = async (): Promise<QrResponse> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    console.error("[whatsapp-control] WHATSAPP_API_URL/KEY ausente — status indisponível")
    return disconnectedFallback
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(controlUrl(baseUrl, "/qr"), {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error("[whatsapp-control] /qr falhou — status", response.status)
      return disconnectedFallback
    }

    return parseQrResponse(await response.json())
  } catch (err) {
    console.error("[whatsapp-control] erro ao buscar /qr:", err)
    return disconnectedFallback
  } finally {
    clearTimeout(timeout)
  }
}

export const postLogout = async (): Promise<LogoutResponse> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    console.error("[whatsapp-control] WHATSAPP_API_URL/KEY ausente — logout ignorado")
    return { ok: false }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(controlUrl(baseUrl, "/logout"), {
      method: "POST",
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error("[whatsapp-control] /logout falhou — status", response.status)
      return { ok: false }
    }

    return { ok: true }
  } catch (err) {
    console.error("[whatsapp-control] erro ao chamar /logout:", err)
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}
