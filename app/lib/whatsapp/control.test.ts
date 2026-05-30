import { describe, it, expect } from "vitest"
import { parseQrResponse } from "./control"

describe("parseQrResponse", () => {
  it("preserva uma resposta conectada bem formada", () => {
    expect(parseQrResponse({ status: "connected", qr: null, me: "5521999999999" })).toEqual({
      status: "connected",
      qr: null,
      me: "5521999999999",
    })
  })

  it("preserva o QR cru quando desconectado", () => {
    expect(parseQrResponse({ status: "disconnected", qr: "2@abc", me: null })).toEqual({
      status: "disconnected",
      qr: "2@abc",
      me: null,
    })
  })

  it("cai pra disconnected quando o status é desconhecido", () => {
    expect(parseQrResponse({ status: "banido", qr: null, me: null })).toEqual({
      status: "disconnected",
      qr: null,
      me: null,
    })
  })

  it("normaliza campos de tipos errados para null", () => {
    expect(parseQrResponse({ status: "connecting", qr: 42, me: { id: 1 } })).toEqual({
      status: "connecting",
      qr: null,
      me: null,
    })
  })

  it("retorna um shape seguro para entradas não-objeto", () => {
    const safe = { status: "disconnected", qr: null, me: null }
    expect(parseQrResponse(null)).toEqual(safe)
    expect(parseQrResponse(undefined)).toEqual(safe)
    expect(parseQrResponse("erro")).toEqual(safe)
    expect(parseQrResponse(123)).toEqual(safe)
  })
})
