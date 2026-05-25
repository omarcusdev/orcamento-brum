import type { WhatsAppResult } from "."

const REQUEST_TIMEOUT_MS = 10_000

export const sendViaBaileys = async (telefone: string, mensagem: string): Promise<WhatsAppResult> => {
  const baseUrl = process.env.WHATSAPP_API_URL
  const apiKey = process.env.WHATSAPP_API_KEY

  if (!baseUrl || !apiKey) {
    console.error("[whatsapp] WHATSAPP_API_URL/KEY ausente — envio ignorado")
    return { ok: false, error: "not configured" }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/send-message`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ telefone, mensagem }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error("[whatsapp] envio falhou — status", response.status)
      return { ok: false, error: `http ${response.status}` }
    }

    return { ok: true }
  } catch (err) {
    console.error("[whatsapp] erro no envio:", err)
    return { ok: false, error: err instanceof Error ? err.message : "unknown" }
  } finally {
    clearTimeout(timeout)
  }
}
