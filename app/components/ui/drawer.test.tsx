// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Drawer } from "./drawer"

afterEach(cleanup)

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(<Drawer open={false} onClose={() => {}} title="T"><p>body</p></Drawer>)
    expect(screen.queryByText("body")).not.toBeInTheDocument()
  })

  it("renders title, body and footer when open", () => {
    render(<Drawer open onClose={() => {}} title="EDITAR" footer={<button>Salvar</button>}><p>body</p></Drawer>)
    expect(screen.getByText("EDITAR")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
    expect(screen.getByText("Salvar")).toBeInTheDocument()
  })

  it("calls onClose on the X button and on Escape", () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} title="T"><p>x</p></Drawer>)
    fireEvent.click(screen.getByLabelText("Fechar"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("blocks close affordances when closeDisabled", () => {
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} closeDisabled title="T"><p>x</p></Drawer>)
    fireEvent.click(screen.getByLabelText("Fechar"))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })
})
