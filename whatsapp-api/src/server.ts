import Fastify from "fastify"
import { connectToWhatsApp } from "./baileys.js"
import { registerRoutes } from "./routes.js"

const PORT = Number(process.env.PORT) || 3001

const start = async () => {
  const app = Fastify({ logger: true })

  registerRoutes(app)

  await connectToWhatsApp()

  await app.listen({ port: PORT, host: "0.0.0.0" })
  console.log(`WhatsApp API running on port ${PORT}`)
}

start()
