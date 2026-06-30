// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("@/lib/admin-actions", () => ({ saveConteudo: vi.fn() }))

import ContentEditor from "./content-editor"

afterEach(cleanup)

describe("ContentEditor", () => {
  it("renders the Hero tab with primitive inputs", () => {
    render(<ContentEditor hero={null} features={null} faq={null} footer={null} />)
    expect(screen.getByText("Salvar Hero")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Chopp gelado no seu evento")).toBeInTheDocument()
  })
})
