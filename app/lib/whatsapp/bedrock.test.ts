import { describe, it, expect, vi, beforeEach } from "vitest"

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock("@anthropic-ai/bedrock-sdk", () => ({
  // o SDK exporta a classe como default; mockamos o construtor com um messages.create
  default: class {
    messages = { create: createMock }
  },
}))

import { askClaude } from "./bedrock"

beforeEach(() => {
  createMock.mockReset()
})

describe("askClaude", () => {
  it("retorna o texto concatenado dos blocos de texto", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "Olá! " }, { type: "text", text: "🍻" }] })
    await expect(askClaude("system", [{ role: "user", content: "oi" }])).resolves.toBe("Olá! 🍻")
  })
  it("retorna null quando o Bedrock lança", async () => {
    createMock.mockRejectedValue(new Error("bedrock down"))
    await expect(askClaude("s", [{ role: "user", content: "oi" }])).resolves.toBeNull()
  })
  it("retorna null quando a resposta vem vazia", async () => {
    createMock.mockResolvedValue({ content: [] })
    await expect(askClaude("s", [{ role: "user", content: "oi" }])).resolves.toBeNull()
  })
})
