import { describe, it, expect } from "vitest"
import { parseFlag } from "./features"

describe("parseFlag", () => {
  it("'true' => true", () => expect(parseFlag("true")).toBe(true))
  it("'false' => false", () => expect(parseFlag("false")).toBe(false))
  it("'FALSE' (case) => false", () => expect(parseFlag("FALSE")).toBe(false))
  it("null => true (fail-open)", () => expect(parseFlag(null)).toBe(true))
  it("undefined => true (fail-open)", () => expect(parseFlag(undefined)).toBe(true))
  it("valor inesperado => true (fail-open)", () => expect(parseFlag("xyz")).toBe(true))
})
