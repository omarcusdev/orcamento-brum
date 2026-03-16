import Fastify from "fastify"
import rateLimit from "@fastify/rate-limit"
import { connectToWhatsApp } from "./baileys.js"
import { registerRoutes } from "./routes.js"

const PORT = Number(process.env.PORT) || 3001

const start = async () => {
  const app = Fastify({ logger: true })

  await app.register(rateLimit, {
    max: 30,
    timeWindow: "1 minute",
  })

  registerRoutes(app)

  await connectToWhatsApp()

  await app.listen({ port: PORT, host: "0.0.0.0" })
}

start()
