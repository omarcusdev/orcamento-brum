import { describe, it, expect } from "vitest"
import { recomputeOrdens } from "./admin-ordem"

describe("recomputeOrdens", () => {
  it("retorna ordens sequenciais com gap de 10 baseado na ordem do array", () => {
    const result = recomputeOrdens(["a", "b", "c"])
    expect(result).toEqual([
      { id: "a", ordem: 10 },
      { id: "b", ordem: 20 },
      { id: "c", ordem: 30 },
    ])
  })

  it("retorna array vazio quando recebe array vazio", () => {
    expect(recomputeOrdens([])).toEqual([])
  })

  it("preserva a ordem do array de entrada", () => {
    const result = recomputeOrdens(["x", "y", "z", "w"])
    expect(result.map((r) => r.id)).toEqual(["x", "y", "z", "w"])
  })
})
