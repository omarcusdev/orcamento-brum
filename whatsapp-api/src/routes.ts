import { FastifyInstance } from "fastify"
import { sendMessage, getStatus } from "./baileys.js"

const API_KEY = process.env.WHATSAPP_API_KEY || "dev-api-key"

const authMiddleware = async (request: any, reply: any) => {
  const apiKey = request.headers["x-api-key"]
  if (apiKey !== API_KEY) {
    reply.code(401).send({ error: "Unauthorized" })
  }
}

const registerRoutes = (app: FastifyInstance) => {
  app.get("/status", async () => ({
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
    } catch (error: any) {
      return reply.code(500).send({ error: error.message })
    }
  })
}

export { registerRoutes }
