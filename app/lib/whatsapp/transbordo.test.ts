import { describe, it, expect } from "vitest"
import { isTransbordoNotice, TRANSBORDO_MARKERS } from "./transbordo"

describe("isTransbordoNotice", () => {
  it("detecta o aviso de transbordo na variante 🔔", () => {
    const corpo = [
      "🔔 *AVISO DE TRANSBORDO*",
      "",
      "Anotei aqui os dados do cliente para o atendimento humano:",
      "Nome: Cliente Teste",
      "Telefone: 21999999999",
    ].join("\n")
    expect(isTransbordoNotice(corpo)).toBe(true)
  })

  it("detecta o aviso de transbordo na variante 🔍", () => {
    const corpo = [
      "🔍 *AVISO DE TRANSBORDO*",
      "",
      "Anotei aqui o resumo do pedido para verificação:",
      "- Endereço: Rua Teste, 123",
    ].join("\n")
    expect(isTransbordoNotice(corpo)).toBe(true)
  })

  it("retorna false para uma mensagem normal de cliente", () => {
    expect(isTransbordoNotice("Oi, meu pedido já saiu para entrega?")).toBe(false)
  })

  it("retorna false quando só tem 'AVISO' sem o marcador completo", () => {
    expect(isTransbordoNotice("AVISO: seu pedido está atrasado, desculpe o transtorno")).toBe(false)
  })

  it("retorna false quando tem o marcador de transbordo mas falta 'Anotei aqui'", () => {
    expect(isTransbordoNotice("🔔 *AVISO DE TRANSBORDO*\n\nSem o segundo marcador aqui.")).toBe(false)
  })

  it("retorna false quando tem 'Anotei aqui' mas falta o marcador de transbordo", () => {
    expect(isTransbordoNotice("Anotei aqui, mas sem o outro marcador.")).toBe(false)
  })

  it("é case-sensitive (variantes em minúsculo não casam)", () => {
    expect(isTransbordoNotice("🔔 *aviso de transbordo*\n\nanotei aqui os dados.")).toBe(false)
  })

  it("retorna false para string vazia", () => {
    expect(isTransbordoNotice("")).toBe(false)
  })

  it("retorna false para null", () => {
    expect(isTransbordoNotice(null)).toBe(false)
  })

  it("retorna false para undefined", () => {
    expect(isTransbordoNotice(undefined)).toBe(false)
  })

  it("exporta os dois marcadores centralizados", () => {
    expect(TRANSBORDO_MARKERS).toEqual(["AVISO DE TRANSBORDO", "Anotei aqui"])
  })
})
