// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { useState } from "react"
import { ConfirmProvider, useConfirm } from "./confirm-provider"

afterEach(cleanup)

const Harness = () => {
  const { confirm, alert } = useConfirm()
  const [out, setOut] = useState("")
  return (
    <>
      <button onClick={async () => setOut(String(await confirm({ title: "Excluir?", message: "Tem certeza?", confirmLabel: "Excluir" })))}>ask</button>
      <button onClick={async () => { await alert({ title: "Erro", message: "Falhou" }); setOut("alerted") }}>warn</button>
      <span data-testid="out">{out}</span>
    </>
  )
}

const renderHarness = () => render(<ConfirmProvider><Harness /></ConfirmProvider>)

describe("ConfirmProvider / useConfirm", () => {
  it("resolves true when the confirm button is clicked", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    expect(screen.getByText("Tem certeza?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("true"))
  })

  it("resolves false when cancelled", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("false"))
  })

  it("resolves false on Escape", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("ask"))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("false"))
  })

  it("alert shows a single OK and resolves", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("warn"))
    expect(screen.getByText("Falhou")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "OK" }))
    await waitFor(() => expect(screen.getByTestId("out")).toHaveTextContent("alerted"))
  })
})
