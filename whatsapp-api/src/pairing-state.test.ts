import { describe, it, expect } from "vitest"
import { idlePairingState } from "./pairing-state.js"

describe("idlePairingState", () => {
  it("returns all fields at their idle values", () => {
    expect(idlePairingState()).toEqual({
      currentQr: null,
      currentCode: null,
      pairingMethod: null,
      pairingPhone: null,
      codeRequested: false,
    })
  })

  it("returns a fresh object each call (no shared mutable reference)", () => {
    const a = idlePairingState()
    const b = idlePairingState()
    expect(a).not.toBe(b)
    a.currentQr = "changed"
    expect(b.currentQr).toBeNull()
  })
})
