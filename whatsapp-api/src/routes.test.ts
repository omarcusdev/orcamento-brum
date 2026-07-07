import { describe, it, expect, vi, beforeEach } from "vitest"
import { Writable } from "node:stream"
import Fastify, { type FastifyBaseLogger } from "fastify"
import pino from "pino"

vi.mock("./baileys.js", () => ({
  sendMessage: vi.fn(),
  getStatus: vi.fn(() => "connected"),
  getConnectionInfo: vi.fn(() => ({})),
  startPairing: vi.fn(),
  logout: vi.fn(),
}))

import { sendMessage } from "./baileys.js"
import { registerRoutes } from "./routes.js"

const sendMock = vi.mocked(sendMessage)

// Real pino instance writing ndjson lines into memory, so the test asserts on
// genuine pino error serialization instead of a hand-rolled logger shape.
const buildApp = () => {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString())
      cb()
    },
  })
  const app = Fastify({ loggerInstance: pino(stream) as unknown as FastifyBaseLogger })
  registerRoutes(app)
  const loggedErrors = () =>
    lines
      .map((l) => JSON.parse(l))
      .filter((entry) => entry.level >= 50) // pino error level
  return { app, loggedErrors }
}

describe("POST /send-message", () => {
  beforeEach(() => sendMock.mockReset())

  it("logs the underlying error before responding 500 when sendMessage throws", async () => {
    sendMock.mockRejectedValueOnce(new Error("WhatsApp not connected"))
    const { app, loggedErrors } = buildApp()

    const res = await app.inject({
      method: "POST",
      url: "/send-message",
      headers: { "x-api-key": "test-key" },
      payload: { telefone: "5521999999999", mensagem: "oi" },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: "Failed to send message" })

    const loggedTheRealError = loggedErrors().some(
      (entry) => entry.msg === "send-message failed" && entry.err?.message === "WhatsApp not connected",
    )
    expect(loggedTheRealError).toBe(true)
  })

  it("responds success when sendMessage resolves", async () => {
    sendMock.mockResolvedValue(true)
    const { app } = buildApp()

    const res = await app.inject({
      method: "POST",
      url: "/send-message",
      headers: { "x-api-key": "test-key" },
      payload: { telefone: "5521999999999", mensagem: "oi" },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ success: true, telefone: "5521999999999" })
  })
})
