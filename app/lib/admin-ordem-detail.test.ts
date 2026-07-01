import { describe, it, expect } from "vitest"
import { orderDisplayTotals, toDispatchItens } from "./admin-ordem-detail"

const item = (subtotal: number, is_consignado = false, consignado_status: string | null = null) => ({
  subtotal,
  is_consignado,
  consignado_status,
})

describe("orderDisplayTotals", () => {
  it("sem consignado: total único (min == max), desconto e frete aplicados", () => {
    const t = orderDisplayTotals([item(500), item(500)], 100, 50)
    expect(t.hasPendente).toBe(false)
    expect(t.totalMin).toBe(950)
    expect(t.totalMax).toBe(950)
  })

  it("consignado pendente: faixa min/max (devolvido vs usado)", () => {
    const t = orderDisplayTotals([item(500), item(400, true, "pendente")], 0, 0)
    expect(t.hasPendente).toBe(true)
    expect(t.totalMin).toBe(500)
    expect(t.totalMax).toBe(900)
  })

  it("aplica frete e desconto na faixa", () => {
    const t = orderDisplayTotals([item(1000, true, "pendente")], 50, 30)
    expect(t.totalMin).toBe(-20) // 0 - 50 + 30
    expect(t.totalMax).toBe(980) // 1000 - 50 + 30
  })
})

describe("toDispatchItens", () => {
  it("produtos como objeto", () => {
    expect(toDispatchItens([{ quantidade: 2, produtos: { marca: "Brahma", volume_litros: 50 } }])).toEqual([
      { quantidade: 2, marca: "Brahma", volume: 50 },
    ])
  })

  it("produtos como array (join supabase)", () => {
    expect(toDispatchItens([{ quantidade: 1, produtos: [{ marca: "Heineken", volume_litros: 30 }] }])).toEqual([
      { quantidade: 1, marca: "Heineken", volume: 30 },
    ])
  })

  it("produtos nulo: marca vazia, volume 0", () => {
    expect(toDispatchItens([{ quantidade: 1, produtos: null }])).toEqual([{ quantidade: 1, marca: "", volume: 0 }])
  })
})
