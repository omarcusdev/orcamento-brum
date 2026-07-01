import { describe, it, expect } from "vitest"
import { addressDataToEnderecoCompleto } from "./address"
import type { AddressData } from "@/components/address-autocomplete"

const addr: AddressData = {
  rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Rio", estado: "RJ",
  cep: "20000-000", lat: -22.9, lng: -43.2, formatted: "Rua A, 10",
}

describe("addressDataToEnderecoCompleto", () => {
  it("maps every AddressData field and defaults complemento to empty", () => {
    expect(addressDataToEnderecoCompleto(addr)).toEqual({
      rua: "Rua A", numero: "10", bairro: "Centro", cidade: "Rio", estado: "RJ",
      cep: "20000-000", complemento: "", lat: -22.9, lng: -43.2,
    })
  })

  it("preserves a provided complemento", () => {
    expect(addressDataToEnderecoCompleto(addr, "Apto 101").complemento).toBe("Apto 101")
  })
})
