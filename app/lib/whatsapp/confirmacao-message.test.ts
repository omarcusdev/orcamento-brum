import { describe, it, expect } from "vitest"
import { buildConfirmationMessage } from "./confirmacao-message"

const base = {
  clienteNome: "Vitória Magalhães",
  pedidoId: "3b3a7901-aaaa-bbbb-cccc-dddddddddddd",
  itens: [
    { quantidade: 2, marca: "Vila Império", volume: 50 },
    { quantidade: 1, marca: "Vila Império Vinho", volume: 30 },
  ],
  dataEvento: "2026-07-15",
  horarioEvento: "13:00:00",
  total: 550.5,
  metodoPagamento: "pix",
}

describe("buildConfirmationMessage", () => {
  it("saúda só com o primeiro nome + 🍻", () => {
    const msg = buildConfirmationMessage(base)
    expect(msg.startsWith("Olá, Vitória! 🍻 Recebemos seu pedido!")).toBe(true)
    expect(msg).not.toContain("Magalhães")
  })

  it("mostra o código do pedido (8 primeiros dígitos) em negrito", () => {
    expect(buildConfirmationMessage(base)).toContain("*Pedido #3b3a7901*")
  })

  it("lista cada item em sua própria linha com •", () => {
    const msg = buildConfirmationMessage(base)
    expect(msg).toContain("• 2x Vila Império 50L\n• 1x Vila Império Vinho 30L")
  })

  it("mostra data (dd/mm/aaaa) e horário (HH:MM) na linha do evento", () => {
    expect(buildConfirmationMessage(base)).toContain("📅 *Evento:* 15/07/2026 às 13:00")
  })

  it("fecha com a despedida amigável e a assinatura da ALFA", () => {
    const msg = buildConfirmationMessage(base)
    expect(msg).toContain("Já já confirmamos tudo com você por aqui 😊")
    expect(msg.trimEnd().endsWith("— ALFA Chopp Delivery")).toBe(true)
  })

  it("um único item também vira lista", () => {
    const msg = buildConfirmationMessage({ ...base, itens: [{ quantidade: 3, marca: "Brahma", volume: 30 }] })
    expect(msg).toContain("• 3x Brahma 30L")
  })

  it("mostra o valor total formatado em R$", () => {
    expect(buildConfirmationMessage(base)).toContain("*Valor total:* R$ 550,50")
  })

  it("mostra a forma de pagamento com label amigável", () => {
    expect(buildConfirmationMessage(base)).toContain("*Pagamento:* Pix")
  })

  it("mostra — quando a forma de pagamento ainda não foi definida", () => {
    const msg = buildConfirmationMessage({ ...base, metodoPagamento: null })
    expect(msg).toContain("*Pagamento:* —")
  })
})
