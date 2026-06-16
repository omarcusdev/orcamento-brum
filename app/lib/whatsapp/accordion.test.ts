// app/lib/whatsapp/accordion.test.ts
import { describe, it, expect } from "vitest"
import { toggleSection } from "./accordion"

describe("toggleSection", () => {
  it("abre uma seção a partir de nada", () => {
    expect(toggleSection(null, "bot")).toBe("bot")
  })
  it("abrir outra fecha a anterior (1 aberta por vez)", () => {
    expect(toggleSection("recursos", "bot")).toBe("bot")
  })
  it("clicar na seção já aberta fecha (toggle)", () => {
    expect(toggleSection("bot", "bot")).toBe(null)
  })
})
