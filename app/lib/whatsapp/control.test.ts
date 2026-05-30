import { describe, it, expect } from "vitest"
import { parseConnectionResponse } from "./control"

describe("parseConnectionResponse", () => {
  it("preserva uma resposta conectada bem formada", () => {
    expect(
      parseConnectionResponse({ status: "connected", paired: true, qr: null, code: null, me: "5521999999999" }),
    ).toEqual({
      status: "connected",
      paired: true,
      qr: null,
      code: null,
      me: "5521999999999",
    })
  })

  it("preserva o QR cru durante o pareamento por QR", () => {
    expect(
      parseConnectionResponse({ status: "connecting", paired: false, qr: "2@abc", code: null, me: null }),
    ).toEqual({
      status: "connecting",
      paired: false,
      qr: "2@abc",
      code: null,
      me: null,
    })
  })

  it("preserva o código durante o pareamento por código", () => {
    expect(
      parseConnectionResponse({ status: "connecting", paired: false, qr: null, code: "ABCD1234", me: null }),
    ).toEqual({
      status: "connecting",
      paired: false,
      qr: null,
      code: "ABCD1234",
      me: null,
    })
  })

  it("cai pra disconnected quando o status é desconhecido", () => {
    expect(
      parseConnectionResponse({ status: "banido", paired: false, qr: null, code: null, me: null }),
    ).toEqual({
      status: "disconnected",
      paired: false,
      qr: null,
      code: null,
      me: null,
    })
  })

  it("normaliza campos de tipos errados para o fallback seguro", () => {
    expect(
      parseConnectionResponse({ status: "connecting", paired: "sim", qr: 42, code: {}, me: { id: 1 } }),
    ).toEqual({
      status: "connecting",
      paired: false,
      qr: null,
      code: null,
      me: null,
    })
  })

  it("retorna um shape seguro para entradas não-objeto", () => {
    const safe = { status: "disconnected", paired: false, qr: null, code: null, me: null }
    expect(parseConnectionResponse(null)).toEqual(safe)
    expect(parseConnectionResponse(undefined)).toEqual(safe)
    expect(parseConnectionResponse("erro")).toEqual(safe)
    expect(parseConnectionResponse(123)).toEqual(safe)
  })
})
