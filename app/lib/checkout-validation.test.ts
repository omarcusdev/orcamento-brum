import { describe, it, expect } from "vitest"
import { validateCheckout } from "./checkout-validation"

const base = {
  address: { numero: "10" },
  addressInArea: true as boolean | null,
  dataEvento: "2026-07-15",
  tipoChopeira: "gelo" as const,
  temRampas: "nao" as const,
  now: new Date("2026-07-01T12:00:00"),
}

describe("validateCheckout", () => {
  it("returns null when everything is valid", () => {
    expect(validateCheckout(base)).toBeNull()
  })
  it("rejects a missing address first", () => {
    expect(validateCheckout({ ...base, address: null })).toBe("Selecione um endereco valido")
  })
  it("rejects an out-of-area address", () => {
    expect(validateCheckout({ ...base, addressInArea: false })).toBe("Infelizmente nao atendemos essa regiao")
  })
  it("rejects a past event date", () => {
    expect(validateCheckout({ ...base, dataEvento: "2026-06-30" })).toBe("A data do evento nao pode ser no passado")
  })
  it("rejects a missing chopeira", () => {
    expect(validateCheckout({ ...base, tipoChopeira: "" })).toBe("Selecione o tipo de chopeira")
  })
  it("rejects missing rampas info when an address is set", () => {
    expect(validateCheckout({ ...base, temRampas: "" })).toBe("Informe se o local possui rampas ou escadas")
  })
})
