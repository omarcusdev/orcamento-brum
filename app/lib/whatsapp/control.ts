import { logWaError, errInfo } from "./wa-log"

const REQUEST_TIMEOUT_MS = 10_000

export type WhatsappConnectionStatus = "disconnected" | "connecting" | "connected"

export type ConnectionResponse = {
  status: WhatsappConnectionStatus
  paired: boolean
  qr: string | null
  code: string | null
  me: string | null
}

export type PairingMethod = "qr" | "code"

export type ConnectResponse = {
  ok: boolean
}

export type LogoutResponse = {
  ok: boolean
}

const disconnectedFallback: ConnectionResponse = {
  status: "disconnected",
  paired: false,
  qr: null,
  code: null,
  me: null,
}

const isStatus = (value: unknown): value is WhatsappConnectionStatus =>
  value === "disconnected" || value === "connecting" || value === "connected"

export const parseConnectionResponse = (raw: unknown): ConnectionResponse => {
  if (!raw || typeof raw !== "object") return disconnectedFallback
  const candidate = raw as Record<string, unknown>
  return {
    status: isStatus(candidate.status) ? candidate.status : "disconnected",
    paired: candidate.paired === true,
    qr: typeof candidate.qr === "string" ? candidate.qr : null,
    code: typeof candidate.code === "string" ? candidate.code : null,
    me: typeof candidate.me === "string" ? candidate.me : null,
  }
}

const controlUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/$/, "")}${path}`

export const fetchConnection = async (): Promise<ConnectionResponse> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    logWaError("control:config-ausente", { op: "connection" })
    return disconnectedFallback
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(controlUrl(baseUrl, "/connection"), {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      logWaError("control:connection-falhou", { httpStatus: response.status })
      return disconnectedFallback
    }

    return parseConnectionResponse(await response.json())
  } catch (err) {
    logWaError("control:connection-erro", errInfo(err))
    return disconnectedFallback
  } finally {
    clearTimeout(timeout)
  }
}

export const startPairing = async (method: PairingMethod, phone?: string): Promise<ConnectResponse> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    logWaError("control:config-ausente", { op: "connect" })
    return { ok: false }
  }

  const body = method === "code" ? { method, phone } : { method }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(controlUrl(baseUrl, "/connect"), {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      logWaError("control:connect-falhou", { httpStatus: response.status })
      return { ok: false }
    }

    return { ok: true }
  } catch (err) {
    logWaError("control:connect-erro", errInfo(err))
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}

export const postLogout = async (): Promise<LogoutResponse> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    logWaError("control:config-ausente", { op: "logout" })
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
      logWaError("control:logout-falhou", { httpStatus: response.status })
      return { ok: false }
    }

    return { ok: true }
  } catch (err) {
    logWaError("control:logout-erro", errInfo(err))
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}
