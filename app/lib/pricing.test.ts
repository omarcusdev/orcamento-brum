import { describe, it, expect } from "vitest"
import { calculateLine, getBasePrice, calculateOrderTotals, calculateStoredTotals, priceManualOrderLines, consignadoSplit } from "./pricing"
import { barrelUnitPrices } from "./pricing"

const baseProduct = {
  preco_avista: 500,
  preco_cartao: null,
  preco_segundo_barril: null,
}

describe("getBasePrice", () => {
  it("retorna preco_avista quando metodo nao e cartao", () => {
    expect(getBasePrice({ preco_avista: 100, preco_cartao: 110 }, "pix")).toBe(100)
    expect(getBasePrice({ preco_avista: 100, preco_cartao: 110 }, "dinheiro")).toBe(100)
  })

  it("retorna preco_cartao quando metodo e cartao e o produto tem preco_cartao", () => {
    expect(getBasePrice({ preco_avista: 100, preco_cartao: 110 }, "cartao")).toBe(110)
  })

  it("cai pra preco_avista quando metodo e cartao mas preco_cartao e null", () => {
    expect(getBasePrice({ preco_avista: 100, preco_cartao: null }, "cartao")).toBe(100)
  })
})

describe("calculateLine", () => {
  it("retorna zero quando quantidade e 0", () => {
    const line = calculateLine(baseProduct, 0)
    expect(line.total).toBe(0)
    expect(line.savings).toBe(0)
    expect(line.hasPromo).toBe(false)
  })

  it("calcula 1 unidade pelo preco a vista quando nao ha promo", () => {
    const line = calculateLine(baseProduct, 1)
    expect(line.total).toBe(500)
    expect(line.firstUnitPrice).toBe(500)
    expect(line.extraUnitPrice).toBe(500)
    expect(line.hasPromo).toBe(false)
  })

  it("nao aplica promo quando ha apenas 1 barril, mesmo com preco_segundo_barril setado", () => {
    const line = calculateLine({ ...baseProduct, preco_segundo_barril: 385 }, 1)
    expect(line.total).toBe(500)
    expect(line.hasPromo).toBe(false)
    expect(line.savings).toBe(0)
  })

  it("aplica preco_segundo_barril a partir da segunda unidade", () => {
    const line = calculateLine({ ...baseProduct, preco_segundo_barril: 385 }, 2)
    expect(line.total).toBe(885)
    expect(line.firstUnitPrice).toBe(500)
    expect(line.extraUnitPrice).toBe(385)
    expect(line.hasPromo).toBe(true)
    expect(line.savings).toBe(115)
  })

  it("aplica preco_segundo_barril em todas as unidades extras (3, 4, 5...)", () => {
    const line = calculateLine({ ...baseProduct, preco_segundo_barril: 385 }, 3)
    expect(line.total).toBe(500 + 385 * 2)
    expect(line.savings).toBe(115 * 2)
  })

  it("ignora preco_segundo_barril se for >= preco_avista", () => {
    const line = calculateLine({ ...baseProduct, preco_segundo_barril: 600 }, 2)
    expect(line.total).toBe(1000)
    expect(line.hasPromo).toBe(false)
    expect(line.savings).toBe(0)
  })

  it("usa preco_cartao como base quando metodo e cartao", () => {
    const line = calculateLine(
      { preco_avista: 500, preco_cartao: 530, preco_segundo_barril: 385 },
      2,
      "cartao",
    )
    expect(line.firstUnitPrice).toBe(530)
    expect(line.extraUnitPrice).toBe(385)
    expect(line.total).toBe(530 + 385)
  })

  it("normaliza quantidade negativa para zero", () => {
    const line = calculateLine(baseProduct, -3)
    expect(line.total).toBe(0)
  })

  it("trunca quantidade fracionaria", () => {
    const line = calculateLine({ ...baseProduct, preco_segundo_barril: 385 }, 2.9)
    expect(line.total).toBe(885)
  })
})

describe("calculateOrderTotals", () => {
  const item = (subtotal: number, is_consignado = false, consignado_status: string | null = null) => ({
    subtotal,
    is_consignado,
    consignado_status,
  })

  it("retorna total unico quando nao tem consignado", () => {
    const totals = calculateOrderTotals([item(500), item(500)])
    expect(totals.subtotalMin).toBe(1000)
    expect(totals.subtotalMax).toBe(1000)
    expect(totals.hasPendente).toBe(false)
  })

  it("expõe min/max quando consignado esta pendente", () => {
    const totals = calculateOrderTotals([item(500), item(400, true, "pendente")])
    expect(totals.subtotalMin).toBe(500)
    expect(totals.subtotalMax).toBe(900)
    expect(totals.hasPendente).toBe(true)
  })

  it("inclui consignado no min quando usado", () => {
    const totals = calculateOrderTotals([item(500), item(400, true, "usado")])
    expect(totals.subtotalMin).toBe(900)
    expect(totals.subtotalMax).toBe(900)
    expect(totals.hasPendente).toBe(false)
  })

  it("exclui consignado do max e do min quando devolvido", () => {
    const totals = calculateOrderTotals([item(500), item(400, true, "devolvido")])
    expect(totals.subtotalMin).toBe(500)
    expect(totals.subtotalMax).toBe(500)
    expect(totals.hasPendente).toBe(false)
  })

  it("zera pra lista vazia", () => {
    const totals = calculateOrderTotals([])
    expect(totals.subtotalMin).toBe(0)
    expect(totals.subtotalMax).toBe(0)
    expect(totals.hasPendente).toBe(false)
  })
})

describe("calculateStoredTotals (valor cheio: consignado conta como usado até ser devolvido)", () => {
  const item = (subtotal: number, is_consignado = false, consignado_status: string | null = null) => ({
    subtotal,
    is_consignado,
    consignado_status,
  })

  it("soma itens firmes e aplica desconto e frete", () => {
    const r = calculateStoredTotals([item(500), item(500)], 50, 100)
    expect(r.subtotal).toBe(1000)
    expect(r.total).toBe(950) // 1000 - 100 desconto + 50 frete
  })

  it("consignado PENDENTE entra pelo valor cheio (não zera) — corrige o bug do Jean", () => {
    const r = calculateStoredTotals(
      [item(550), item(400, true, "pendente"), item(400, true, "pendente")],
      0,
      0,
    )
    expect(r.subtotal).toBe(1350)
    expect(r.total).toBe(1350)
  })

  it("consignado USADO continua somando", () => {
    const r = calculateStoredTotals([item(550), item(400, true, "usado")], 0, 0)
    expect(r.subtotal).toBe(950)
  })

  it("consignado DEVOLVIDO é abatido no acerto", () => {
    const r = calculateStoredTotals([item(550), item(400, true, "devolvido")], 0, 0)
    expect(r.subtotal).toBe(550)
  })

  it("arredonda em 2 casas", () => {
    expect(calculateStoredTotals([item(33.333)], 0, 0).subtotal).toBe(33.33)
  })
})

describe("priceManualOrderLines", () => {
  const brahma = { id: "brahma", preco_avista: 880, preco_cartao: 920, preco_segundo_barril: 730 }
  const heineken = { id: "heineken", preco_avista: 950, preco_cartao: null, preco_segundo_barril: 750 }
  const semPromo = { id: "vinho", preco_avista: 650, preco_cartao: null, preco_segundo_barril: null }

  it("aplica o preco do 2o barril ao consignado quando ha um barril firme do mesmo produto", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
        { produto_id: "brahma", quantidade: 1, is_consignado: true },
      ],
      [brahma],
    )
    expect(priced[0].subtotal).toBe(880)
    expect(priced[1].subtotal).toBe(730)
    expect(priced[1].barrelPrices).toEqual([730])
  })

  it("aplica o preco do 2o barril na segunda linha firme do mesmo produto", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
      ],
      [brahma],
    )
    expect(priced[0].subtotal).toBe(880)
    expect(priced[1].subtotal).toBe(730)
  })

  it("trata firme antes do consignado mesmo se o consignado vier primeiro na lista", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "brahma", quantidade: 1, is_consignado: true },
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
      ],
      [brahma],
    )
    const firme = priced.find((l) => !l.is_consignado)!
    const consignado = priced.find((l) => l.is_consignado)!
    expect(firme.subtotal).toBe(880)
    expect(consignado.subtotal).toBe(730)
  })

  it("aplica promo nas unidades extras dentro de uma unica linha firme", () => {
    const priced = priceManualOrderLines([{ produto_id: "brahma", quantidade: 2, is_consignado: false }], [brahma])
    expect(priced[0].barrelPrices).toEqual([880, 730])
    expect(priced[0].subtotal).toBe(1610)
    expect(priced[0].precoUnitario).toBe(805)
  })

  it("mantem o primeiro consignado no preco cheio quando nao ha barril firme", () => {
    const priced = priceManualOrderLines([{ produto_id: "brahma", quantidade: 2, is_consignado: true }], [brahma])
    expect(priced[0].barrelPrices).toEqual([880, 730])
  })

  it("conta barris de forma independente por produto", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
        { produto_id: "heineken", quantidade: 1, is_consignado: false },
      ],
      [brahma, heineken],
    )
    expect(priced[0].subtotal).toBe(880)
    expect(priced[1].subtotal).toBe(950)
  })

  it("usa preco_cartao como base do primeiro barril quando metodo e cartao", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "brahma", quantidade: 1, is_consignado: false },
        { produto_id: "brahma", quantidade: 1, is_consignado: true },
      ],
      [brahma],
      "cartao",
    )
    expect(priced[0].subtotal).toBe(920)
    expect(priced[1].subtotal).toBe(730)
  })

  it("cobra preco cheio em todas as linhas quando nao ha preco_segundo_barril", () => {
    const priced = priceManualOrderLines(
      [
        { produto_id: "vinho", quantidade: 1, is_consignado: false },
        { produto_id: "vinho", quantidade: 1, is_consignado: true },
      ],
      [semPromo],
    )
    expect(priced[0].subtotal).toBe(650)
    expect(priced[1].subtotal).toBe(650)
  })
})

describe("barrelUnitPrices (guarded 2º barril)", () => {
  it("aplica o 2º barril só quando é mais barato que à vista", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: null, preco_segundo_barril: 385 })).toEqual({ firstUnitPrice: 500, secondUnitPrice: 385 })
  })
  it("ignora 2º barril >= à vista (trava): segundo cai pro preço cheio", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: null, preco_segundo_barril: 600 })).toEqual({ firstUnitPrice: 500, secondUnitPrice: 500 })
  })
  it("usa preco_cartao como base no cartão", () => {
    expect(barrelUnitPrices({ id: "x", preco_avista: 500, preco_cartao: 530, preco_segundo_barril: 385 }, "cartao")).toEqual({ firstUnitPrice: 530, secondUnitPrice: 385 })
  })
})

describe("consignadoSplit", () => {
  const item = (subtotal: number, is_consignado = false, consignado_status: string | null = null) => ({
    subtotal,
    is_consignado,
    consignado_status,
  })

  it("sem consignado: firmes = subtotal, consignado = 0, hasConsignado false", () => {
    const r = consignadoSplit([item(500), item(500)], 50, 0)
    expect(r).toEqual({ firmes: 1000, consignado: 0, aPagar: 1050, totalCheio: 1050, hasConsignado: false })
  })

  it("misto (1 firme + 2 consignado): separa a pagar do consignado", () => {
    const r = consignadoSplit([item(550), item(400, true, "pendente"), item(400, true, "pendente")], 30, 0)
    expect(r).toEqual({ firmes: 550, consignado: 800, aPagar: 580, totalCheio: 1380, hasConsignado: true })
  })

  it("todo consignado: a pagar = so o frete", () => {
    const r = consignadoSplit(
      [item(550, true, "pendente"), item(400, true, "pendente"), item(400, true, "pendente")],
      30,
      0,
    )
    expect(r).toEqual({ firmes: 0, consignado: 1350, aPagar: 30, totalCheio: 1380, hasConsignado: true })
  })

  it("desconto abate do a pagar (firme), nao do consignado", () => {
    const r = consignadoSplit([item(550), item(400, true, "pendente")], 0, 50)
    expect(r).toEqual({ firmes: 550, consignado: 400, aPagar: 500, totalCheio: 900, hasConsignado: true })
  })

  it("consignado devolvido nao conta como consignado nem como a pagar", () => {
    const r = consignadoSplit([item(550), item(400, true, "devolvido")], 0, 0)
    expect(r).toEqual({ firmes: 550, consignado: 0, aPagar: 550, totalCheio: 550, hasConsignado: false })
  })
})
