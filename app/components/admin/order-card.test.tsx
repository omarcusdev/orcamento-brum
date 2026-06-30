// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import OrderCard from "./order-card"
import { ConfirmProvider } from "./confirm-provider"

vi.mock("@/lib/admin-actions", () => ({ archiveOrder: vi.fn(), unarchiveOrder: vi.fn() }))

const pedido = {
  id: "a", status: "confirmado", documento_status: "pendente", total: 500,
  data_evento: "2026-07-15", horario_evento: "18:00", endereco: "Rua X",
  metodo_pagamento: "pix", created_at: "2026-07-01T12:00:00Z", arquivado_em: null,
  clientes: { nome: "Ana", telefone: "51999" },
}

describe("OrderCard payment badge", () => {
  it("mostra o método de pagamento", () => {
    render(
      <ConfirmProvider>
        <OrderCard pedido={pedido} />
      </ConfirmProvider>,
    )
    expect(screen.getByText("Pix")).toBeInTheDocument()
  })
})
