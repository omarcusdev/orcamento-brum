// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({
  updatePedido: vi.fn(), addPedidoItem: vi.fn(), removePedidoItem: vi.fn(), updatePedidoItem: vi.fn(),
}))

import EditOrderDrawer from "./edit-order-drawer"

const basePedido = {
  id: "p1", data_evento: "2026-07-15", horario_evento: "18:00:00", endereco: "Rua A, 1",
  endereco_completo: null, observacoes: null, rampas_escadas: null, tipo_chopeira: "gelo" as const,
  frete: 50, desconto: 0, metodo_pagamento: "pix" as const, pago: false,
}
const produtos = [{ id: "prod1", marca: "Heineken", volume_litros: 50 }] as never[]

afterEach(cleanup)

describe("EditOrderDrawer frete lock", () => {
  it("frete input is editable in confirmado", () => {
    render(<EditOrderDrawer open onClose={() => {}} pedido={{ ...basePedido, status: "confirmado" }} items={[]} produtos={produtos} />)
    expect(screen.getByLabelText("Frete")).not.toBeDisabled()
  })
  it("frete input is disabled once dispatched (enviar_para_entregador)", () => {
    render(<EditOrderDrawer open onClose={() => {}} pedido={{ ...basePedido, status: "enviar_para_entregador" }} items={[]} produtos={produtos} />)
    expect(screen.getByLabelText("Frete")).toBeDisabled()
  })
})
