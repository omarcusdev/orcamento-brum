import { describe, it, expect } from "vitest"
import { isFreteLocked, canRevertToStatus, isAutoArchiveStatus } from "./admin-status"

describe("isFreteLocked", () => {
  it("libera frete só em confirmado", () => {
    expect(isFreteLocked("confirmado")).toBe(false)
  })

  it("trava do despacho em diante", () => {
    for (const s of ["enviar_para_entregador", "em_rota", "entregue", "pago", "recolhido", "cancelado"]) {
      expect(isFreteLocked(s)).toBe(true)
    }
  })
})

describe("canRevertToStatus (regressão)", () => {
  it("permite voltar para um status anterior do fluxo", () => {
    expect(canRevertToStatus("em_rota", "enviar_para_entregador")).toBe(true)
  })
  it("não deixa cancelar um pedido recolhido", () => {
    expect(canRevertToStatus("recolhido", "cancelado")).toBe(false)
  })
})

describe("isAutoArchiveStatus (regressão)", () => {
  it("só recolhido auto-arquiva", () => {
    expect(isAutoArchiveStatus("recolhido")).toBe(true)
    expect(isAutoArchiveStatus("entregue")).toBe(false)
  })
})
