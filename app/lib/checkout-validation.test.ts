import { describe, it, expect } from "vitest"
import { validateCheckout, isBeforeMinLeadTime, MIN_LEAD_TIME_HOURS, minLeadTimeMessage } from "./checkout-validation"

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

describe("isBeforeMinLeadTime", () => {
  // now expresso em UTC (Z) de propósito: prova que o cálculo independe do TZ do runner.
  it("é true quando o evento está a menos de 24h", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "14:00", now)).toBe(true) // 23h em BRT
  })
  it("é false quando o evento está a exatamente 24h (fronteira permitida)", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "15:00", now)).toBe(false) // 24h em BRT
  })
  it("é false quando o evento está a mais de 24h", () => {
    const now = new Date("2026-07-13T18:00:00Z") // 15:00 BRT
    expect(isBeforeMinLeadTime("2026-07-14", "16:00", now)).toBe(false) // 25h em BRT
  })
  it("ancora o evento no horário do Brasil (-03:00), não no TZ do runtime", () => {
    // now = 12:00 BRT (15:00Z). Evento 12:00 BRT do dia seguinte = exatamente 24h.
    const now = new Date("2026-07-13T15:00:00Z")
    expect(isBeforeMinLeadTime("2026-07-14", "12:00", now)).toBe(false)
    expect(isBeforeMinLeadTime("2026-07-14", "11:00", now)).toBe(true)
  })
  it("expõe a constante e a mensagem", () => {
    expect(MIN_LEAD_TIME_HOURS).toBe(24)
    expect(minLeadTimeMessage).toBe("Pedidos exigem no minimo 24h de antecedencia")
  })
})
