import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { sendMessage, getStatus, getConnectionInfo, startPairing, logout } from "./baileys.js"

const API_KEY = process.env.WHATSAPP_API_KEY

if (!API_KEY) {
  throw new Error("WHATSAPP_API_KEY environment variable is required")
}

const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers["x-api-key"]
  if (apiKey !== API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" })
  }
}

const registerRoutes = (app: FastifyInstance) => {
  app.get("/health", async (_request, reply) => {
    const connected = getStatus() === "connected"
    return reply.code(connected ? 200 : 503).send({ connected })
  })

  app.get("/status", { preHandler: authMiddleware }, async () => ({
    status: getStatus(),
    timestamp: new Date().toISOString(),
  }))

  app.get("/connection", { preHandler: authMiddleware }, async () => getConnectionInfo())

  app.post<{
    Body: { method: "qr" } | { method: "code"; phone: string }
  }>("/connect", { preHandler: authMiddleware }, async (request, reply) => {
    const { method } = request.body

    if (method !== "qr" && method !== "code") {
      return reply.code(400).send({ error: "method must be 'qr' or 'code'" })
    }

    if (method === "code" && !request.body.phone) {
      return reply.code(400).send({ error: "phone is required for code pairing" })
    }

    try {
      await startPairing(method, method === "code" ? request.body.phone : undefined)
    } catch {
      return reply.code(502).send({ error: "Failed to start pairing" })
    }
    return { ok: true }
  })

  app.post("/logout", { preHandler: authMiddleware }, async () => {
    await logout()
    return { ok: true }
  })

  app.post<{
    Body: { telefone: string; mensagem: string }
  }>("/send-message", {
    preHandler: authMiddleware,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { telefone, mensagem } = request.body

    if (!telefone || !mensagem) {
      return reply.code(400).send({ error: "telefone and mensagem are required" })
    }

    try {
      await sendMessage(telefone, mensagem)
      return { success: true, telefone }
    } catch (err) {
      request.log.error({ err }, "send-message failed")
      return reply.code(500).send({ error: "Failed to send message" })
    }
  })
}

export { registerRoutes }
