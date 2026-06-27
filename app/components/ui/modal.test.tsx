// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Modal } from "./modal"

afterEach(cleanup)

describe("Modal", () => {
  it("renders title and children", () => {
    render(<Modal onClose={() => {}} title="HELLO"><p>body</p></Modal>)
    expect(screen.getByText("HELLO")).toBeInTheDocument()
    expect(screen.getByText("body")).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
  })

  it("calls onClose on Escape", () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose}><p>x</p></Modal>)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose on Escape when closeDisabled", () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} closeDisabled><p>x</p></Modal>)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("locks body scroll while mounted and restores on unmount", () => {
    const { unmount } = render(<Modal onClose={() => {}}><p>x</p></Modal>)
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
  })
})
