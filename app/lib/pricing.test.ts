import { describe, it, expect } from "vitest"
import { calculateLine, getBasePrice, calculateOrderTotals } from "./pricing"

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
