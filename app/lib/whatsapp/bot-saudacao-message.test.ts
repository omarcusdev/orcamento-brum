import { describe, it, expect } from "vitest"
import {
  parseJanelaHoras,
  isSessaoNova,
  botSaudacaoAtivo,
  DEFAULT_BOT_SAUDACAO_JANELA_HORAS,
} from "./bot-saudacao-message"

describe("parseJanelaHoras", () => {
  it("usa o default para nulo/vazio/inválido/fora do range", () => {
    for (const v of [null, undefined, "", "   ", "abc", "0", "169", "12.5", "-3"]) {
      expect(parseJanelaHoras(v)).toBe(DEFAULT_BOT_SAUDACAO_JANELA_HORAS)
    }
  })
  it("aceita inteiros de 1 a 168", () => {
    expect(parseJanelaHoras("1")).toBe(1)
    expect(parseJanelaHoras("6")).toBe(6)
    expect(parseJanelaHoras("24")).toBe(24)
    expect(parseJanelaHoras("48")).toBe(48)
    expect(parseJanelaHoras("168")).toBe(168)
    expect(parseJanelaHoras("24.0")).toBe(24) // "24.0" é inteiro após Number()
  })
})

describe("botSaudacaoAtivo (fail-closed: só 'true' liga)", () => {
  it("liga apenas com 'true' (trim/case-insensitive)", () => {
    expect(botSaudacaoAtivo("true")).toBe(true)
    expect(botSaudacaoAtivo(" TRUE ")).toBe(true)
    expect(botSaudacaoAtivo("True")).toBe(true)
  })
  it("desliga para tudo o mais", () => {
    for (const v of [null, undefined, "", "false", "1", "yes", "sim"]) {
      expect(botSaudacaoAtivo(v)).toBe(false)
    }
  })
})

describe("isSessaoNova", () => {
  const agora = new Date("2026-06-10T12:00:00Z")
  it("sem mensagem anterior = sessão nova", () => {
    expect(isSessaoNova(null, agora, 24)).toBe(true)
  })
  it("anteriorIso undefined = sessão nova", () => {
    expect(isSessaoNova(undefined, agora, 24)).toBe(true)
  })
  it("anterior dentro da janela = sessão ativa", () => {
    expect(isSessaoNova("2026-06-10T11:00:00Z", agora, 24)).toBe(false) // 1h < 24h
  })
  it("anterior além da janela = sessão nova", () => {
    expect(isSessaoNova("2026-06-09T11:00:00Z", agora, 24)).toBe(true) // 25h > 24h
  })
  it("exatamente na janela = sessão ativa (boundary)", () => {
    expect(isSessaoNova("2026-06-09T12:00:00Z", agora, 24)).toBe(false) // 24h, não é > 24h
  })
  it("timestamp inválido = sessão ativa (fail-closed)", () => {
    expect(isSessaoNova("nao-e-data", agora, 24)).toBe(false)
  })
  it("anterior no futuro = sessão ativa (fail-closed)", () => {
    expect(isSessaoNova("2026-06-10T13:00:00Z", agora, 24)).toBe(false)
  })
})
