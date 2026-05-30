import { describe, it, expect } from "vitest"
import { parseInboundPayload } from "./inbound"

const valid = {
  telefone: "5521998123344",
  waMessageId: "ABC123",
  direcao: "entrada",
  corpo: "Oi, qual o horário?",
  ocorridaEm: "2026-05-30T17:32:00.000Z",
}

describe("parseInboundPayload", () => {
  it("aceita payload válido", () => {
    expect(parseInboundPayload(valid)).toEqual(valid)
  })

  it("rejeita direcao inválida", () => {
    expect(parseInboundPayload({ ...valid, direcao: "x" })).toBeNull()
  })

  it("rejeita campos faltando", () => {
    expect(parseInboundPayload({ telefone: "55", corpo: "oi" })).toBeNull()
  })

  it("rejeita não-objeto", () => {
    expect(parseInboundPayload(null)).toBeNull()
    expect(parseInboundPayload("nope")).toBeNull()
  })
})
