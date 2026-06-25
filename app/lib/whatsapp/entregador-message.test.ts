import { describe, it, expect } from "vitest"
import { buildDispatchText } from "./entregador-message"

const base = {
  pedidoId: "3b3a7901-aaaa-bbbb-cccc-dddddddddddd",
  clienteNome: "Vitória Magalhães",
  clienteTelefone: "21 99999-9999",
  dataEvento: "2026-07-15",
  horarioEvento: "13:00:00",
  tipoChopeira: "gelo",
  rampasEscadas: null as string | null,
  subtotal: 1030,
  frete: 50,
  metodoPagamento: "pix",
  observacoes: null as string | null,
  endereco: "Rua Livre, 10 - Centro",
  enderecoCompleto: {
    rua: "Rua das Flores",
    numero: "123",
    complemento: "Fundos",
    bairro: "Jardim",
    cidade: "Niterói",
  } as { rua: string; numero: string; complemento?: string | null; bairro: string; cidade: string } | null,
  itens: [
    { quantidade: 2, marca: "Vila Império", volume: 50 },
    { quantidade: 1, marca: "Vila Império Vinho", volume: 30 },
  ],
}

describe("buildDispatchText", () => {
  it("começa com o código do pedido (8 primeiros dígitos)", () => {
    expect(buildDispatchText(base).startsWith("🔖 Pedido #3b3a7901")).toBe(true)
  })

  it("lista os barris, chopeira, responsável e contato", () => {
    const txt = buildDispatchText(base)
    expect(txt).toContain("◼ Quantidade de Barris: 2x Vila Império 50L, 1x Vila Império Vinho 30L")
    expect(txt).toContain("◼ Preferencia de Chopeira: gelo")
    expect(txt).toContain("◼ Responsavel: Vitória Magalhães")
    expect(txt).toContain("◼ Contato: 21 99999-9999")
  })

  it("usa o endereço completo (rua, número e complemento) + município/bairro", () => {
    const txt = buildDispatchText(base)
    expect(txt).toContain("◼ Endereco: Rua das Flores, 123 (Fundos)")
    expect(txt).toContain("◼ Municipio: Niterói")
    expect(txt).toContain("◼ Bairro: Jardim")
  })

  it("cai no endereço em texto quando não há endereço completo", () => {
    const txt = buildDispatchText({ ...base, enderecoCompleto: null })
    expect(txt).toContain("◼ Endereco: Rua Livre, 10 - Centro")
    expect(txt).toContain("◼ Municipio: —")
  })

  it("formata data, valor e frete (vírgula) e usa 'Nao' quando não há rampas/escadas", () => {
    const txt = buildDispatchText(base)
    expect(txt).toContain("📍 Data do evento: 15/07/2026 às 13:00")
    expect(txt).toContain("◼ Valor: R$ 1030,00")
    expect(txt).toContain("◼ Frete: R$ 50,00")
    expect(txt).toContain("◼ Rampas/Escadas: Nao")
  })
})
