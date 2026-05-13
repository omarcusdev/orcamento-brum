import { describe, it, expect } from "vitest"
import { canRevertToStatus, STATUS_FLOW_ORDER } from "./admin-actions"

describe("canRevertToStatus", () => {
  it("permite cancelado a partir de qualquer status nao terminal", () => {
    expect(canRevertToStatus("confirmado", "cancelado")).toBe(true)
    expect(canRevertToStatus("enviar_para_entregador", "cancelado")).toBe(true)
    expect(canRevertToStatus("em_rota", "cancelado")).toBe(true)
    expect(canRevertToStatus("entregue", "cancelado")).toBe(true)
    expect(canRevertToStatus("pago", "cancelado")).toBe(true)
  })

  it("rejeita cancelado quando recolhido ou ja cancelado", () => {
    expect(canRevertToStatus("recolhido", "cancelado")).toBe(false)
    expect(canRevertToStatus("cancelado", "cancelado")).toBe(false)
  })

  it("permite voltar para status anterior", () => {
    expect(canRevertToStatus("em_rota", "confirmado")).toBe(true)
    expect(canRevertToStatus("em_rota", "enviar_para_entregador")).toBe(true)
    expect(canRevertToStatus("pago", "entregue")).toBe(true)
    expect(canRevertToStatus("recolhido", "pago")).toBe(true)
  })

  it("rejeita avancos pra frente", () => {
    expect(canRevertToStatus("confirmado", "em_rota")).toBe(false)
    expect(canRevertToStatus("entregue", "pago")).toBe(false)
    expect(canRevertToStatus("confirmado", "enviar_para_entregador")).toBe(false)
  })

  it("rejeita mesmo status", () => {
    expect(canRevertToStatus("confirmado", "confirmado")).toBe(false)
    expect(canRevertToStatus("em_rota", "em_rota")).toBe(false)
  })

  it("rejeita status invalido", () => {
    expect(canRevertToStatus("foo", "confirmado")).toBe(false)
    expect(canRevertToStatus("confirmado", "bar")).toBe(false)
  })

  it("STATUS_FLOW_ORDER contains 6 main statuses in order", () => {
    expect(STATUS_FLOW_ORDER).toEqual([
      "confirmado",
      "enviar_para_entregador",
      "em_rota",
      "entregue",
      "pago",
      "recolhido",
    ])
  })
})
