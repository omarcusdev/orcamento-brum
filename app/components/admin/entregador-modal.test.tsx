// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({
  createEntregador: vi.fn(),
  updateEntregador: vi.fn(),
}))

import EntregadorModal from "./entregador-modal"

afterEach(cleanup)

describe("EntregadorModal", () => {
  it("renders the create title and fields inside a dialog", () => {
    render(<EntregadorModal entregador={null} onClose={() => {}} />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByText("NOVO ENTREGADOR")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Nome do entregador")).toBeInTheDocument()
  })

  it("calls onClose on Escape", () => {
    const onClose = vi.fn()
    render(<EntregadorModal entregador={null} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
