import { describe, it, expect } from "vitest"
import { toBrazilE164, last8, matchClienteByPhone } from "./phone"

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

describe("last8", () => {
  it("pega os últimos 8 dígitos ignorando não-dígitos", () => {
    expect(last8("+55 (21) 99812-3344")).toBe("98123344")
  })
})

describe("matchClienteByPhone", () => {
  const clientes = [
    { id: "c1", nome: "João Silva", telefone: "21998123344" },   // com 9
    { id: "c2", nome: "Maria Souza", telefone: "5521912345678" }, // E.164 com 9
  ]

  it("casa por E.164 exato", () => {
    expect(matchClienteByPhone("5521998123344", clientes)).toEqual({ id: "c1", nome: "João Silva" })
  })

  it("casa pelo fallback dos últimos 8 dígitos quando o 9 difere", () => {
    // JID veio sem o 9: 552198123344 → últimos 8 = 98123344 → c1
    expect(matchClienteByPhone("552198123344", clientes)).toEqual({ id: "c1", nome: "João Silva" })
  })

  it("retorna null quando não há cliente", () => {
    expect(matchClienteByPhone("5511000000000", clientes)).toBeNull()
  })
})
