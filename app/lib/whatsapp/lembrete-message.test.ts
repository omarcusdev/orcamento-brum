import { describe, it, expect } from "vitest"
import {
  LEMBRETE_FLAG_KEY,
  LEMBRETE_HORA_KEY,
  LEMBRETE_MSG_KEY,
  DEFAULT_LEMBRETE_HORA,
  DEFAULT_LEMBRETE_MSG,
  renderLembreteTemplate,
  formatDataBR,
  formatHorario,
  horaEmSaoPaulo,
  deveEnviarAgora,
  parseHora,
} from "./lembrete-message"

describe("chaves e defaults", () => {
  it("chaves de configuracoes", () => {
    expect(LEMBRETE_FLAG_KEY).toBe("whatsapp_lembrete_vespera_ativo")
    expect(LEMBRETE_HORA_KEY).toBe("whatsapp_lembrete_vespera_hora")
    expect(LEMBRETE_MSG_KEY).toBe("whatsapp_lembrete_vespera_msg")
  })
  it("default tem os 4 tokens e hora padrao 9", () => {
    expect(DEFAULT_LEMBRETE_HORA).toBe(9)
    for (const t of ["{nome}", "{pedido}", "{data}", "{horario}"]) {
      expect(DEFAULT_LEMBRETE_MSG).toContain(t)
    }
  })
})

describe("renderLembreteTemplate", () => {
  const vars = { nome: "Joao", pedido: "1a2b3c4d", data: "10/06", horario: "14:30" }
  it("substitui os 4 tokens", () => {
    expect(
      renderLembreteTemplate("Oi {nome} #{pedido} {data} {horario}", vars),
    ).toBe("Oi Joao #1a2b3c4d 10/06 14:30")
  })
  it("substitui multiplas ocorrencias e ignora ausentes", () => {
    expect(renderLembreteTemplate("{nome} {nome}", vars)).toBe("Joao Joao")
    expect(renderLembreteTemplate("sem token", vars)).toBe("sem token")
  })
  it("renderiza o default sem sobrar token", () => {
    const out = renderLembreteTemplate(DEFAULT_LEMBRETE_MSG, vars)
    for (const t of ["{nome}", "{pedido}", "{data}", "{horario}"]) {
      expect(out).not.toContain(t)
    }
  })
})

describe("formatDataBR / formatHorario", () => {
  it("data YYYY-MM-DD -> DD/MM", () => {
    expect(formatDataBR("2026-06-10")).toBe("10/06")
    expect(formatDataBR("2026-12-01")).toBe("01/12")
  })
  it("horario HH:MM:SS -> HH:MM", () => {
    expect(formatHorario("14:30:00")).toBe("14:30")
    expect(formatHorario("09:05:00")).toBe("09:05")
  })
})

describe("parseHora", () => {
  it("normaliza string valida", () => {
    expect(parseHora("9")).toBe(9)
    expect(parseHora("0")).toBe(0)
    expect(parseHora("23")).toBe(23)
  })
  it("cai no default 9 para invalido/ausente", () => {
    expect(parseHora(null)).toBe(9)
    expect(parseHora(undefined)).toBe(9)
    expect(parseHora("")).toBe(9)
    expect(parseHora("25")).toBe(9)
    expect(parseHora("-1")).toBe(9)
    expect(parseHora("abc")).toBe(9)
    expect(parseHora("9.5")).toBe(9)
  })
})

describe("horaEmSaoPaulo (UTC-3, sem horario de verao)", () => {
  it("12:00Z -> 9", () => expect(horaEmSaoPaulo(new Date("2026-06-10T12:00:00Z"))).toBe(9))
  it("11:59Z -> 8", () => expect(horaEmSaoPaulo(new Date("2026-06-10T11:59:00Z"))).toBe(8))
  it("03:00Z -> 0 (meia-noite SP)", () =>
    expect(horaEmSaoPaulo(new Date("2026-06-10T03:00:00Z"))).toBe(0))
  it("02:30Z -> 23 (dia anterior SP)", () =>
    expect(horaEmSaoPaulo(new Date("2026-06-10T02:30:00Z"))).toBe(23))
})

describe("deveEnviarAgora", () => {
  it("envia quando hora SP >= configurada", () => {
    expect(deveEnviarAgora(9, new Date("2026-06-10T12:00:00Z"))).toBe(true)
    expect(deveEnviarAgora(9, new Date("2026-06-10T15:00:00Z"))).toBe(true)
  })
  it("nao envia antes da hora configurada", () => {
    expect(deveEnviarAgora(9, new Date("2026-06-10T11:00:00Z"))).toBe(false)
  })
})
