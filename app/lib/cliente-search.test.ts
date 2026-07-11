import { describe, it, expect } from "vitest"
import { buildClienteSearchOr } from "./cliente-search"

describe("buildClienteSearchOr", () => {
  it("retorna null para query com menos de 2 chars", () => {
    expect(buildClienteSearchOr("a")).toBeNull()
    expect(buildClienteSearchOr("  ")).toBeNull()
  })

  it("busca por nome quando a query tem letras", () => {
    expect(buildClienteSearchOr("maria")).toBe("nome.ilike.%maria%")
  })

  it("telefone mascarado NAO injeta ( ) no .or() e busca pelos digitos (bug do Jean)", () => {
    const or = buildClienteSearchOr("(21) 99999-8888")
    expect(or).not.toBeNull()
    expect(or).not.toMatch(/[()]/) // nenhum parentese sobrevive pro parser do .or()
    expect(or).toContain("telefone_digits.ilike.%21999998888%")
    expect(or).not.toContain("nome.ilike") // query sem letras => sem filtro de nome
  })

  it("telefone com digitos puros busca por telefone_digits e cpf", () => {
    expect(buildClienteSearchOr("21999998888")).toBe(
      "telefone_digits.ilike.%21999998888%,cpf.ilike.%21999998888%",
    )
  })

  it("CPF mascarado busca pelos digitos, sem quebrar por . ou -", () => {
    expect(buildClienteSearchOr("123.456.789-00")).toBe(
      "telefone_digits.ilike.%12345678900%,cpf.ilike.%12345678900%",
    )
  })

  it("query mista (nome + parenteses) remove os metacaracteres do termo de nome", () => {
    const or = buildClienteSearchOr("Maria (21)")
    expect(or).not.toBeNull()
    expect(or).not.toMatch(/[()]/)
    expect(or).toContain("nome.ilike.")
    expect(or).toContain("telefone_digits.ilike.%21%")
  })
})
