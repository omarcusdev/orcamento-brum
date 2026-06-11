import { describe, it, expect } from "vitest"
import {
  agenteAtivo,
  formatCardapio,
  formatHistorico,
  buildSystemPrompt,
  DEFAULT_AGENTE_FAQ,
  type CardapioItem,
  type ThreadMsg,
} from "./bot-agente-kb"

describe("agenteAtivo (fail-closed: só 'true' liga)", () => {
  it("liga apenas com 'true'", () => {
    expect(agenteAtivo("true")).toBe(true)
    expect(agenteAtivo(" TRUE ")).toBe(true)
  })
  it("desliga para tudo o mais", () => {
    for (const v of [null, undefined, "", "false", "1", "sim"]) expect(agenteAtivo(v)).toBe(false)
  })
})

describe("formatCardapio", () => {
  const itens: CardapioItem[] = [
    { nome: "Chopp Pilsen", volume_litros: 30, descricao: "Leve e refrescante", preco_avista: 380, preco_segundo_barril: 350 },
    { nome: "Chopp IPA", volume_litros: 50, descricao: null, preco_avista: 620, preco_segundo_barril: null },
  ]
  it("inclui nome, volume e preço à vista em BRL", () => {
    const txt = formatCardapio(itens)
    expect(txt).toContain("Chopp Pilsen")
    expect(txt).toContain("30L")
    expect(txt).toMatch(/R\$\s?380,00/)
  })
  it("mostra o preço do 2º barril quando houver e omite quando null", () => {
    const txt = formatCardapio(itens)
    expect(txt).toMatch(/2º barril.*R\$\s?350,00/)
    const ipaLinha = txt.split("\n").find((l) => l.includes("Chopp IPA")) ?? ""
    expect(ipaLinha).not.toContain("2º barril")
  })
  it("lista vazia -> aviso curto, não quebra", () => {
    expect(formatCardapio([])).toMatch(/sem itens|indispon/i)
  })
})

describe("formatHistorico", () => {
  it("mapeia entrada->Cliente e saida->Atendente em ordem", () => {
    const thread: ThreadMsg[] = [
      { direcao: "entrada", corpo: "oi" },
      { direcao: "saida", corpo: "Olá! 🍻" },
      { direcao: "entrada", corpo: "qual o horário?" },
    ]
    expect(formatHistorico(thread)).toBe("Cliente: oi\nAtendente: Olá! 🍻\nCliente: qual o horário?")
  })
  it("thread vazia -> string vazia", () => {
    expect(formatHistorico([])).toBe("")
  })
})

describe("buildSystemPrompt", () => {
  it("contém os guardrails, o cardápio e a FAQ", () => {
    const sys = buildSystemPrompt({ cardapio: "CARDAPIO_AQUI", faq: "FAQ_AQUI" })
    expect(sys).toContain("NUNCA invente")
    expect(sys).toContain("apenas sobre o ALFA Chopp")
    expect(sys).toContain("CARDAPIO_AQUI")
    expect(sys).toContain("FAQ_AQUI")
  })
  it("usa o primeiro nome do cliente quando passado", () => {
    const sys = buildSystemPrompt({ cardapio: "c", faq: "f", nomeCliente: "Marcus Gonçalves" })
    expect(sys).toContain("Marcus")
    expect(sys).not.toContain("Gonçalves")
  })
  it("não injeta nome quando ausente/vazio/null", () => {
    for (const nome of [undefined, null, "", "   "]) {
      const sys = buildSystemPrompt({ cardapio: "c", faq: "f", nomeCliente: nome })
      expect(sys).not.toContain("se chama")
    }
  })
})
