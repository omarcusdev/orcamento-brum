import { describe, it, expect } from "vitest"
import {
  pedidoRefCurto,
  formatDataEvento,
  formatTotalBR,
  sanitizeTermoBusca,
  termoBuscaValido,
} from "./pedido-contexto"

describe("pedidoRefCurto", () => {
  it("prefixa # e corta em 8 chars", () => {
    expect(pedidoRefCurto("1a2b3c4d-aaaa-bbbb")).toBe("#1a2b3c4d")
  })
})

describe("formatDataEvento", () => {
  it("YYYY-MM-DD -> DD/MM", () => {
    expect(formatDataEvento("2026-06-10")).toBe("10/06")
    expect(formatDataEvento("2026-12-01")).toBe("01/12")
  })
})

describe("formatTotalBR", () => {
  it("formata em BRL pt-BR (espaço pode ser NBSP)", () => {
    expect(formatTotalBR(880)).toMatch(/^R\$\s?880,00$/)
    expect(formatTotalBR(550.5)).toMatch(/^R\$\s?550,50$/)
  })
})

describe("sanitizeTermoBusca", () => {
  it("apara e remove chars com significado no .or() do PostgREST", () => {
    expect(sanitizeTermoBusca("  João  ")).toBe("João")
    expect(sanitizeTermoBusca("a,b(c)%*\\d")).toBe("abcd")
  })
})

describe("termoBuscaValido", () => {
  it("exige >= 2 chars após sanitizar", () => {
    expect(termoBuscaValido(" a ")).toBe(false)
    expect(termoBuscaValido("an")).toBe(true)
    expect(termoBuscaValido("%,(")).toBe(false)
  })
})
