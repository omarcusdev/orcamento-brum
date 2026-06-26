import { describe, it, expect } from "vitest"
import { formatBRL, formatEventDate } from "./format"

describe("formatBRL", () => {
  it("formata reais no padrão pt-BR com 2 casas", () => {
    expect(formatBRL(1350)).toContain("R$")
    expect(formatBRL(1350)).toContain("1.350,00")
  })

  it("formata zero", () => {
    expect(formatBRL(0)).toContain("0,00")
  })

  it("arredonda para 2 casas (meio centavo pra cima)", () => {
    expect(formatBRL(0.005)).toContain("0,01")
  })

  // Pino o contrato: o helper deve ser byte-idêntico à expressão Intl inline que
  // estava espalhada por ~17 call sites — é o que garante que a consolidação preserva o display.
  it("é idêntico ao Intl.NumberFormat BRL usado nos call sites", () => {
    const ref = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    for (const v of [0, 1, 1.5, 1350, 1234567.89, 0.1, 999999, -50]) {
      expect(formatBRL(v)).toBe(ref(v))
    }
  })
})

describe("formatEventDate", () => {
  it("formata data-only ISO sem drift de fuso (o truque +T00:00:00)", () => {
    expect(formatEventDate("2026-07-15")).toBe("15/07/2026")
  })

  it("aceita opções de Intl (mês por extenso)", () => {
    expect(formatEventDate("2026-07-15", { day: "2-digit", month: "long", year: "numeric" })).toBe("15 de julho de 2026")
  })

  // Pino o contrato contra a expressão inline original em cada call site.
  it("é idêntico à expressão inline original", () => {
    const ref = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
      new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", opts)
    expect(formatEventDate("2026-01-05")).toBe(ref("2026-01-05"))
    expect(formatEventDate("2026-12-31", { day: "2-digit", month: "short", year: "numeric" })).toBe(
      ref("2026-12-31", { day: "2-digit", month: "short", year: "numeric" }),
    )
  })
})
