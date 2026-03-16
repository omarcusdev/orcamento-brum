import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { sendMessage, getStatus } from "./baileys.js"

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
  app.get("/status", { preHandler: authMiddleware }, async () => ({
    status: getStatus(),
    timestamp: new Date().toISOString(),
  }))

  app.post<{
    Body: { telefone: string; mensagem: string }
  }>("/send-message", { preHandler: authMiddleware }, async (request, reply) => {
    const { telefone, mensagem } = request.body

    if (!telefone || !mensagem) {
      return reply.code(400).send({ error: "telefone and mensagem are required" })
    }

    try {
      await sendMessage(telefone, mensagem)
      return { success: true, telefone }
    } catch {
      return reply.code(500).send({ error: "Failed to send message" })
    }
  })
}

export { registerRoutes }
