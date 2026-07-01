// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useOptimisticFlag } from "./use-optimistic-flag"

describe("useOptimisticFlag", () => {
  it("optimistically flips and keeps the value when persist succeeds", async () => {
    const persist = vi.fn().mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useOptimisticFlag(false, persist))
    act(() => result.current.toggle(true))
    expect(result.current.on).toBe(true)
    await waitFor(() => expect(persist).toHaveBeenCalledWith(true))
    expect(result.current.error).toBeNull()
    expect(result.current.on).toBe(true)
  })

  it("rolls back and sets an error when persist fails", async () => {
    const persist = vi.fn().mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useOptimisticFlag(false, persist))
    act(() => result.current.toggle(true))
    expect(result.current.on).toBe(true)
    await waitFor(() => expect(result.current.on).toBe(false))
    expect(result.current.error).toBe("Não consegui salvar. Tente de novo.")
  })
})
