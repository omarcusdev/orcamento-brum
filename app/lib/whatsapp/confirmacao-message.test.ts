import { describe, it, expect } from "vitest"
import { buildConfirmationMessage, summarizeConfirmationItens } from "./confirmacao-message"
import { formatBRL } from "@/lib/format"

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

describe("summarizeConfirmationItens", () => {
  const row = (
    produto_id: string,
    quantidade: number,
    subtotal: number,
    is_consignado: boolean,
    marca: string,
    volume: number,
  ) => ({ produto_id, quantidade, subtotal, is_consignado, marca, volume })

  it("agrupa barris consignados do mesmo produto em uma linha e soma o valor", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 1, 550, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
    ])
    expect(itens).toEqual([{ quantidade: 3, marca: "Donzela", volume: 50, is_consignado: true }])
    expect(consignadoTotal).toBe(1350)
  })

  it("mantem firme e consignado do mesmo produto em linhas separadas, na ordem de entrada", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 1, 550, false, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
      row("p1", 1, 400, true, "Donzela", 50),
    ])
    expect(itens).toEqual([
      { quantidade: 1, marca: "Donzela", volume: 50, is_consignado: false },
      { quantidade: 2, marca: "Donzela", volume: 50, is_consignado: true },
    ])
    expect(consignadoTotal).toBe(800)
  })

  it("consignadoTotal e 0 quando nao ha consignado", () => {
    const { itens, consignadoTotal } = summarizeConfirmationItens([
      row("p1", 2, 1000, false, "Vila Imperio", 50),
    ])
    expect(itens).toEqual([{ quantidade: 2, marca: "Vila Imperio", volume: 50, is_consignado: false }])
    expect(consignadoTotal).toBe(0)
  })
})

describe("buildConfirmationMessage — consignado", () => {
  const base = {
    clienteNome: "Joao Silva",
    pedidoId: "3b3a7901-aaaa-bbbb-cccc-dddddddddddd",
    dataEvento: "2026-07-25",
    horarioEvento: "17:00:00",
    metodoPagamento: "pix",
  }

  it("quebra A pagar + Consignado, anota o item consignado e mostra o rodape", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [
        { quantidade: 1, marca: "Donzela", volume: 50, is_consignado: false },
        { quantidade: 2, marca: "Donzela", volume: 50, is_consignado: true },
      ],
      total: 1380,
      consignadoTotal: 800,
    })
    expect(msg).toContain("• 1x Donzela 50L\n• 2x Donzela 50L (consignado)")
    expect(msg).toContain(`💰 *A pagar:* ${formatBRL(580)}`)
    expect(msg).toContain(`📦 *Consignado (paga só se usar):* ${formatBRL(800)}`)
    expect(msg).toContain(`_Total se usar tudo: ${formatBRL(1380)}_`)
    expect(msg).not.toContain("*Valor total:*")
  })

  it("sem consignadoTotal: formato antigo (Valor total, sem rodape nem 'A pagar')", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [{ quantidade: 2, marca: "Vila Imperio", volume: 50, is_consignado: false }],
      total: 1000,
    })
    expect(msg).toContain(`💰 *Valor total:* ${formatBRL(1000)}`)
    expect(msg).not.toContain("A pagar")
    expect(msg).not.toContain("Total se usar tudo")
  })

  it("todo consignado: a pagar mostra so o frete embutido no total", () => {
    const msg = buildConfirmationMessage({
      ...base,
      itens: [{ quantidade: 3, marca: "Donzela", volume: 50, is_consignado: true }],
      total: 1380,
      consignadoTotal: 1350,
    })
    expect(msg).toContain(`💰 *A pagar:* ${formatBRL(30)}`)
    expect(msg).toContain(`📦 *Consignado (paga só se usar):* ${formatBRL(1350)}`)
  })
})
