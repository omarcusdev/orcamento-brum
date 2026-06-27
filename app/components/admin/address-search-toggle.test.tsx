// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { AddressSearchToggle } from "./address-search-toggle"

afterEach(cleanup)

describe("AddressSearchToggle", () => {
  it("shows the trigger label and reveals the search input on click", () => {
    render(<AddressSearchToggle onSelect={() => {}} openLabel="Buscar via Google" />)
    const trigger = screen.getByText("Buscar via Google")
    expect(trigger).toBeInTheDocument()
    fireEvent.click(trigger)
    // AddressAutocomplete falls back to a plain input when Maps is not loaded (jsdom)
    expect(screen.getByPlaceholderText("Digite o endereco do evento...")).toBeInTheDocument()
    expect(screen.getByText("Cancelar busca")).toBeInTheDocument()
  })
})
