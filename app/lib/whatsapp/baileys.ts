import type { WhatsAppResult } from "."
import { toBrazilE164 } from "./phone"
import { logWa, logWaError, errInfo } from "./wa-log"

const REQUEST_TIMEOUT_MS = 10_000

export const sendViaBaileys = async (telefone: string, mensagem: string): Promise<WhatsAppResult> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    logWaError("envio:config-ausente", {})
    return { ok: false, error: "not configured" }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const t0 = Date.now()

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/send-message`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ telefone: toBrazilE164(telefone), mensagem }),
      signal: controller.signal,
    })

    if (!response.ok) {
      logWaError("envio:falhou", { tel4: toBrazilE164(telefone).slice(-4), httpStatus: response.status, sendMs: Date.now() - t0 })
      return { ok: false, error: `http ${response.status}` }
    }

    logWa("envio:baileys", {
      tel4: toBrazilE164(telefone).slice(-4),
      ok: true,
      httpStatus: response.status,
      sendMs: Date.now() - t0,
      mensagemLen: mensagem.length,
    })
    return { ok: true }
  } catch (err) {
    logWaError("envio:erro", { tel4: toBrazilE164(telefone).slice(-4), ...errInfo(err) })
    return { ok: false, error: err instanceof Error ? err.message : "unknown" }
  } finally {
    clearTimeout(timeout)
  }
}
