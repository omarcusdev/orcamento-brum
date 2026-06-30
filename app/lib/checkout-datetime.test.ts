import { describe, it, expect } from "vitest"
import { MESES, DAY_OPTIONS, HORAS, MINUTOS, getDaysInMonth, buildYearOptions } from "./checkout-datetime"

describe("checkout-datetime", () => {
  it("has 12 months, 31 day options, hours 8..22, quarter-hour minutes", () => {
    expect(MESES).toHaveLength(12)
    expect(DAY_OPTIONS).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    expect(HORAS[0]).toBe(8)
    expect(HORAS[HORAS.length - 1]).toBe(22)
    expect(MINUTOS).toEqual([0, 15, 30, 45])
  })
  it("getDaysInMonth handles February", () => {
    expect(getDaysInMonth(2, 2026)).toBe(28)
    expect(getDaysInMonth(2, 2028)).toBe(29)
  })
  it("buildYearOptions returns the current year and the next", () => {
    expect(buildYearOptions(2026)).toEqual([2026, 2027])
  })
})
