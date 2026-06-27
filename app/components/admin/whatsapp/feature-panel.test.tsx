// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { Bot } from "lucide-react"
import { FeaturePanel } from "./feature-panel"

afterEach(cleanup)

describe("FeaturePanel", () => {
  it("renders title, description and a checked switch", () => {
    render(
      <FeaturePanel icon={Bot} title="Saudação" description="desc" on switchId="s" onToggle={() => {}}>
        <div>body</div>
      </FeaturePanel>,
    )
    expect(screen.getByText("Saudação")).toBeInTheDocument()
    expect(screen.getByText("desc")).toBeInTheDocument()
    expect(screen.getByRole("switch")).toBeChecked()
  })

  it("calls onToggle when the switch is flipped", () => {
    const onToggle = vi.fn()
    render(<FeaturePanel icon={Bot} title="T" description="d" on={false} switchId="s" onToggle={onToggle} />)
    fireEvent.click(screen.getByRole("switch"))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it("hides the collapsible body until expanded, and shows the error line", () => {
    render(
      <FeaturePanel
        icon={Bot} title="T" description="d" on switchId="s" onToggle={() => {}}
        collapseLabel="More" error="boom"
      >
        <div>secret</div>
      </FeaturePanel>,
    )
    expect(screen.queryByText("secret")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("More"))
    expect(screen.getByText("secret")).toBeInTheDocument()
    expect(screen.getByText("boom")).toBeInTheDocument()
  })
})
