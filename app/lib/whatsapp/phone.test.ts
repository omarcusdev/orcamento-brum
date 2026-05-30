import { describe, it, expect } from "vitest"
import { toBrazilE164 } from "./phone"

describe("toBrazilE164", () => {
  it("prepends 55 to an 11-digit mobile (DDD + 9 digits)", () => {
    expect(toBrazilE164("21999998888")).toBe("5521999998888")
  })

  it("prepends 55 to a masked local number", () => {
    expect(toBrazilE164("(21) 99999-8888")).toBe("5521999998888")
  })

  it("prepends 55 to a 10-digit landline (DDD + 8 digits)", () => {
    expect(toBrazilE164("2133334444")).toBe("552133334444")
  })

  it("prepends 55 to an 11-digit DDD-55 (Santa Maria) local number", () => {
    expect(toBrazilE164("55999998888")).toBe("5555999998888")
  })

  it("leaves a 13-digit number that already has the country code", () => {
    expect(toBrazilE164("5521999998888")).toBe("5521999998888")
  })

  it("leaves an already-normalized number with mask", () => {
    expect(toBrazilE164("+55 (21) 99999-8888")).toBe("5521999998888")
  })

  it("is idempotent", () => {
    expect(toBrazilE164(toBrazilE164("21999998888"))).toBe("5521999998888")
  })
})
