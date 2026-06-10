import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { maybeSendBotSaudacao } from "./bot-saudacao"
import { DEFAULT_BOT_SAUDACAO_MSG } from "./bot-saudacao-message"

const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)

// Fake do service client. Dispara builders diferentes por tabela:
//   configuracoes → .select().in() => {data: cfgRows, error: cfgErr}
//   conversas_whatsapp → .select().eq().maybeSingle() => {data: conversa, error: convErr}
//   mensagens_conversa_whatsapp → .select().eq().neq().order().limit().maybeSingle() => {data: anterior}
const fakeClient = (opts: {
  cfgRows?: { chave: string; valor: string }[]
  cfgErr?: unknown
  conversa?: { id: string } | null
  convErr?: unknown
  anterior?: { ocorrida_em: string } | null
  antErr?: unknown
}) => {
  const cfgBuilder = {
    select: () => ({ in: () => Promise.resolve({ data: opts.cfgRows ?? [], error: opts.cfgErr ?? null }) }),
  }

  const convEq = vi.fn(() => ({
    maybeSingle: () => Promise.resolve({ data: opts.conversa ?? null, error: opts.convErr ?? null }),
  }))
  const convBuilder = { select: () => ({ eq: convEq }) }

  const msgNeq = vi.fn(() => ({
    order: () => ({
      limit: () => ({ maybeSingle: () => Promise.resolve({ data: opts.anterior ?? null, error: opts.antErr ?? null }) }),
    }),
  }))
  const msgEq = vi.fn(() => ({ neq: msgNeq }))
  const msgBuilder = { select: () => ({ eq: msgEq }) }

  const from = vi.fn((table: string) =>
    table === "configuracoes" ? cfgBuilder : table === "conversas_whatsapp" ? convBuilder : msgBuilder,
  )
  return { client: { from }, from, convEq, msgEq, msgNeq }
}

const ON = { chave: "whatsapp_bot_saudacao_ativo", valor: "true" }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
  clientMock.mockReset()
  sendMock.mockReset()
  sendMock.mockResolvedValue({ ok: true })
})
afterEach(() => vi.useRealTimers())

describe("maybeSendBotSaudacao", () => {
  it("não envia quando a flag está desligada (fail-closed)", async () => {
    const { client } = fakeClient({ cfgRows: [{ chave: "whatsapp_bot_saudacao_ativo", valor: "false" }] })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a config ausente (flag default OFF)", async () => {
    const { client } = fakeClient({ cfgRows: [] })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a leitura da config falha (fail-closed)", async () => {
    const { client } = fakeClient({ cfgErr: { message: "boom" } })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a sessão está ativa (mensagem anterior recente)", async () => {
    const { client } = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1" },
      anterior: { ocorrida_em: "2026-06-10T11:00:00Z" }, // 1h atrás, janela default 24h
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("envia a mensagem padrão quando é sessão nova (sem anterior)", async () => {
    const fc = fakeClient({ cfgRows: [ON], conversa: { id: "conv-1" }, anterior: null })
    clientMock.mockReturnValue(fc.client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith("5521999990000", DEFAULT_BOT_SAUDACAO_MSG)
    // pino do anti-loop: busca a conversa certa e EXCLUI a mensagem que acabou de chegar
    expect(fc.convEq).toHaveBeenCalledWith("telefone", "5521999990000")
    expect(fc.msgEq).toHaveBeenCalledWith("conversa_id", "conv-1")
    expect(fc.msgNeq).toHaveBeenCalledWith("wa_message_id", "wamid-1")
  })

  it("envia a mensagem editada da config quando presente", async () => {
    const { client } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_saudacao_msg", valor: "Olá! Fala comigo aqui." }],
      conversa: { id: "conv-1" },
      anterior: null,
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledWith("5521999990000", "Olá! Fala comigo aqui.")
  })

  it("respeita a janela configurada (anterior além dela = sessão nova)", async () => {
    const { client } = fakeClient({
      cfgRows: [ON, { chave: "whatsapp_bot_saudacao_janela_horas", valor: "6" }],
      conversa: { id: "conv-1" },
      anterior: { ocorrida_em: "2026-06-10T05:00:00Z" }, // 7h atrás > janela 6h
    })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it("não envia quando a conversa não é encontrada", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: null })
    clientMock.mockReturnValue(client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia quando a leitura da sessão falha (fail-closed)", async () => {
    const fc = fakeClient({ cfgRows: [ON], conversa: { id: "conv-1" }, antErr: { message: "boom" } })
    clientMock.mockReturnValue(fc.client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-1")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não envia logo após outra mensagem (eco/2ª msg mantém a sessão ativa)", async () => {
    // o eco 'saida' da saudação — ou uma 2ª mensagem rápida — chega segundos depois → sessão ativa
    const fc = fakeClient({
      cfgRows: [ON],
      conversa: { id: "conv-1" },
      anterior: { ocorrida_em: "2026-06-10T11:59:55Z" }, // 5s antes do "agora" fake
    })
    clientMock.mockReturnValue(fc.client as never)
    await maybeSendBotSaudacao("5521999990000", "wamid-2")
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("não lança quando o envio falha", async () => {
    const { client } = fakeClient({ cfgRows: [ON], conversa: { id: "conv-1" }, anterior: null })
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: false, error: "down" })
    await expect(maybeSendBotSaudacao("5521999990000", "wamid-1")).resolves.toBeUndefined()
  })
})
