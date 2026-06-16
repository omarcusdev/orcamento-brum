// app/lib/whatsapp/connection-status.test.ts
import { describe, it, expect } from "vitest"
import { connectionStatus, formatPairedNumber } from "./connection-status"
import type { WhatsappConnection } from "./admin-actions"

const base: WhatsappConnection = { status: "disconnected", paired: false, qrDataUrl: null, code: null, me: null }

describe("connectionStatus", () => {
  it("conectado quando connected + paired", () => {
    const r = connectionStatus({ ...base, status: "connected", paired: true, me: "5521999998888" })
    expect(r.estado).toBe("conectado")
    expect(r.tom).toBe("verde")
    expect(r.pulsar).toBe(false)
    expect(r.acionavel).toBe(false)
  })
  it("reconectando quando paired mas não connected", () => {
    const r = connectionStatus({ ...base, status: "connecting", paired: true })
    expect(r.estado).toBe("reconectando")
    expect(r.tom).toBe("amarelo")
    expect(r.pulsar).toBe(true)
  })
  it("conectando/pareando quando há QR ou code e não pareado", () => {
    const r = connectionStatus({ ...base, qrDataUrl: "data:image/png;base64,xxx" })
    expect(r.estado).toBe("conectando")
    expect(r.tom).toBe("cinza")
    expect(r.pulsar).toBe(true)
  })
  it("desconectado quando idle (não pareado, sem tentativa)", () => {
    const r = connectionStatus(base)
    expect(r.estado).toBe("desconectado")
    expect(r.tom).toBe("vermelho")
    expect(r.acionavel).toBe(true)
  })
})

describe("formatPairedNumber", () => {
  it("formata E.164 BR em +55 (DD) 9XXXX-XXXX", () => {
    expect(formatPairedNumber("5521999998888")).toBe("+55 (21) 99999-8888")
  })
  it("número curto cai no fallback +digits", () => {
    expect(formatPairedNumber("12345")).toBe("+12345")
  })
})
