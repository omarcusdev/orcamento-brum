import { describe, it, expect } from "vitest"
import { calcularLitros, resolverCombo } from "./calculator-utils"

describe("calcularLitros", () => {
  it("multiplies people × hours × consumption factor and rounds up to nearest 5", () => {
    expect(calcularLitros(20, 4, "padrao")).toBe(40)
    expect(calcularLitros(10, 3, "moderado")).toBe(15)
    expect(calcularLitros(15, 5, "alto")).toBe(55)
  })

  it("rounds 38 up to 40", () => {
    expect(calcularLitros(19, 4, "padrao")).toBe(40)
  })

  it("returns 0 when any input is 0 or negative", () => {
    expect(calcularLitros(0, 4, "padrao")).toBe(0)
    expect(calcularLitros(20, 0, "padrao")).toBe(0)
    expect(calcularLitros(-5, 4, "padrao")).toBe(0)
  })
})

describe("resolverCombo", () => {
  it("40L → 1× 50L (10L spare beats 30+30=60 with 20L spare? no, 30L only with -10L is invalid. So 50L wins)", () => {
    expect(resolverCombo(40)).toMatchObject({ b50: 1, b30: 0, total: 50, sobra: 10 })
  })

  it("60L → 2× 30L (zero spare beats 50+30 with 20L spare)", () => {
    expect(resolverCombo(60)).toMatchObject({ b50: 0, b30: 2, total: 60, sobra: 0 })
  })

  it("80L → 1× 50L + 1× 30L (zero spare)", () => {
    expect(resolverCombo(80)).toMatchObject({ b50: 1, b30: 1, total: 80, sobra: 0 })
  })

  it("100L → 2× 50L (zero spare, fewest items wins tiebreak vs 50+30+30)", () => {
    expect(resolverCombo(100)).toMatchObject({ b50: 2, b30: 0, total: 100, sobra: 0 })
  })

  it("120L → 4× 30L (zero spare wins over 2×50+1×30 with 10L spare)", () => {
    expect(resolverCombo(120)).toMatchObject({ b50: 0, b30: 4, total: 120, sobra: 0 })
  })

  it("0L returns empty combo", () => {
    expect(resolverCombo(0)).toMatchObject({ b50: 0, b30: 0, total: 0, sobra: 0 })
  })
})
