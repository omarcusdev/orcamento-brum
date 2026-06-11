import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))
vi.mock("./bedrock", () => ({ askClaude: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { askClaude } from "./bedrock"
import { maybeReplyWithAgent } from "./bot-agente"

const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)
const askMock = vi.mocked(askClaude)

// Fake do service client por tabela. mensagens_conversa_whatsapp serve select (thread) E insert (gravar).
const fakeClient = (opts: {
  cfgRows?: { chave: string; valor: string }[]
  cfgErr?: unknown
  conversa?: { id: string; nome_exibicao: string | null } | null
  thread?: { direcao: "entrada" | "saida"; corpo: string }[]
  produtos?: unknown[]
  insertErr?: unknown
}) => {
  const insertSpy = vi.fn(() => Promise.resolve({ error: opts.insertErr ?? null }))
  const cfg = { select: () => ({ in: () => Promise.resolve({ data: opts.cfgRows ?? [], error: opts.cfgErr ?? null }) }) }
  const conv = { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: opts.conversa ?? null, error: null }) }) }) }
  const msgs = {
    select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: opts.thread ?? [], error: null }) }) }) }),
    insert: insertSpy,
  }
  const prod = { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: opts.produtos ?? [], error: null }) }) }) }
  const from = vi.fn((t: string) =>
    t === "configuracoes" ? cfg : t === "conversas_whatsapp" ? conv : t === "produtos" ? prod : msgs,
  )
  return { client: { from }, from, insertSpy }
}

const ON = { chave: "whatsapp_bot_agente_ativo", valor: "true" }

beforeEach(() => {
  clientMock.mockReset()
  sendMock.mockReset()
  askMock.mockReset()
  sendMock.mockResolvedValue({ ok: true })
})

describe("maybeReplyWithAgent", () => {
  it("flag off -> handled:false e NÃO chama o Bedrock", async () => {
    const { client } = fakeClient({ cfgRows: [{ chave: "whatsapp_bot_agente_ativo", valor: "false" }] })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: false })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("erro ao ler config -> handled:false (deixa a saudação assumir)", async () => {
    const { client } = fakeClient({ cfgErr: { message: "boom" } })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: false })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("flag on mas conversa não encontrada -> handled:true sem chamar Bedrock", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: null })
    clientMock.mockReturnValue(client as never)
    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")
    expect(r).toEqual({ handled: true })
    expect(askMock).not.toHaveBeenCalled()
  })

  it("flag on -> monta prompt, chama Bedrock, envia e grava o saida", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_agente_faq", valor: "Horário: 10h-22h." }],
      conversa: { id: "conv-1", nome_exibicao: "Marcus" },
      thread: [{ direcao: "entrada", corpo: "qual o horário?" }],
      produtos: [{ nome: "Chopp Pilsen", volume_litros: 30, descricao: null, preco_avista: 380, preco_segundo_barril: null }],
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue("Funcionamos das 10h às 22h! 🍻")

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "qual o horário?")

    expect(r).toEqual({ handled: true })
    const [systemArg, messagesArg] = askMock.mock.calls[0]
    expect(systemArg).toContain("NUNCA invente")
    expect(systemArg).toContain("Chopp Pilsen")
    expect(systemArg).toContain("Horário: 10h-22h.")
    expect(messagesArg[0]).toMatchObject({ role: "user" })
    expect(messagesArg[0].content).toContain("qual o horário?")
    expect(sendMock).toHaveBeenCalledWith("5521999990000", "Funcionamos das 10h às 22h! 🍻")
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ conversa_id: "conv-1", direcao: "saida", corpo: "Funcionamos das 10h às 22h! 🍻" }),
    )
  })

  it("Bedrock retorna null -> não envia nem grava, não lança, handled:true", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1", nome_exibicao: null },
      thread: [{ direcao: "entrada", corpo: "oi" }],
      produtos: [],
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue(null)

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")

    expect(r).toEqual({ handled: true })
    expect(sendMock).not.toHaveBeenCalled()
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("envio falha -> não grava saida, não lança, handled:true", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1", nome_exibicao: null },
      thread: [{ direcao: "entrada", corpo: "oi" }],
      produtos: [],
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue("Olá! 🍻")
    sendMock.mockResolvedValue({ ok: false, error: "down" })

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")

    expect(r).toEqual({ handled: true })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("erro ao gravar a saida -> não lança, handled:true", async () => {
    const { client, insertSpy } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1", nome_exibicao: null },
      thread: [{ direcao: "entrada", corpo: "oi" }],
      produtos: [],
      insertErr: { message: "insert boom" },
    })
    clientMock.mockReturnValue(client as never)
    askMock.mockResolvedValue("Olá! 🍻")

    const r = await maybeReplyWithAgent("5521999990000", "wamid-1", "oi")

    expect(r).toEqual({ handled: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
  })
})
