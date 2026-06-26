import { describe, it, expect } from "vitest"
import {
  agenteAtivo,
  formatCardapio,
  buildSystemPrompt,
  threadToMessages,
  MEDIA_PLACEHOLDER,
  DEFAULT_AGENTE_FAQ,
  type CardapioItem,
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

describe("buildSystemPrompt", () => {
  it("contém os guardrails, o cardápio e a FAQ", () => {
    const sys = buildSystemPrompt({ cardapio: "CARDAPIO_AQUI", faq: "FAQ_AQUI" })
    expect(sys).toContain("NUNCA invente")
    expect(sys).toContain("apenas sobre o ALFA Chopp")
    expect(sys).toContain("CARDAPIO_AQUI")
    expect(sys).toContain("FAQ_AQUI")
  })
  it("instrui a NÃO repetir o link a cada mensagem", () => {
    const sys = buildSystemPrompt({ cardapio: "c", faq: "f" })
    expect(sys.toLowerCase()).toMatch(/n[ãa]o repita|sem repetir|j[áa] enviou/)
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

describe("threadToMessages (turnos reais p/ o Bedrock)", () => {
  it("mapeia entrada->user e saida->assistant em ordem", () => {
    expect(
      threadToMessages([
        { direcao: "entrada", corpo: "oi" },
        { direcao: "saida", corpo: "olá!" },
        { direcao: "entrada", corpo: "qual o horário?" },
      ]),
    ).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá!" },
      { role: "user", content: "qual o horário?" },
    ])
  })

  it("descarta turnos 'assistant' iniciais (o primeiro tem que ser user)", () => {
    expect(
      threadToMessages([
        { direcao: "saida", corpo: "olá, seja bem-vindo!" },
        { direcao: "entrada", corpo: "quero chopp" },
      ]),
    ).toEqual([{ role: "user", content: "quero chopp" }])
  })

  it("funde turnos consecutivos do mesmo papel (junta com \\n)", () => {
    expect(
      threadToMessages([
        { direcao: "entrada", corpo: "oi" },
        { direcao: "entrada", corpo: "tudo bem?" },
        { direcao: "saida", corpo: "tudo!" },
        { direcao: "saida", corpo: "como ajudo?" },
        { direcao: "entrada", corpo: "preço do pilsen" },
      ]),
    ).toEqual([
      { role: "user", content: "oi\ntudo bem?" },
      { role: "assistant", content: "tudo!\ncomo ajudo?" },
      { role: "user", content: "preço do pilsen" },
    ])
  })

  it("thread só com saida -> [] (não deixa assistant solto)", () => {
    expect(threadToMessages([{ direcao: "saida", corpo: "oi" }])).toEqual([])
  })

  it("thread vazia -> []", () => {
    expect(threadToMessages([])).toEqual([])
  })

  it("garante primeiro=user e alternância após fundir+descartar", () => {
    const msgs = threadToMessages([
      { direcao: "saida", corpo: "bem-vindo" },
      { direcao: "entrada", corpo: "a" },
      { direcao: "entrada", corpo: "b" },
      { direcao: "saida", corpo: "c" },
      { direcao: "entrada", corpo: "d" },
    ])
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"])
    expect(msgs[0].content).toBe("a\nb")
  })
})

describe("MEDIA_PLACEHOLDER", () => {
  it("é o literal exato que o EC2 grava para mídia (sincronizado com whatsapp-api/src/inbound.ts)", () => {
    expect(MEDIA_PLACEHOLDER).toBe("[mídia recebida — ver no celular]")
  })
})
