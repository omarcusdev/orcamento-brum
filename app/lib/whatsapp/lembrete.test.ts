import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("./features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./features")>()),
  isWhatsappFeatureEnabled: vi.fn(),
}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock(".", () => ({ sendWhatsAppMessage: vi.fn() }))

import { isWhatsappFeatureEnabled } from "./features"
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { runLembreteVespera } from "./lembrete"

const flagMock = vi.mocked(isWhatsappFeatureEnabled)
const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendWhatsAppMessage)

// Fake do service client: .from(...).select(...).in(...) devolve cfgRows; .rpc(name) devolve
// rpcRows para get_orders_needing_reminder e {} para register_whatsapp_message.
const fakeClient = (cfgRows: { chave: string; valor: string }[], rpcRows: unknown[]) => {
  const rpc = vi.fn((name: string, _params?: unknown) =>
    name === "get_orders_needing_reminder"
      ? Promise.resolve({ data: rpcRows, error: null })
      : Promise.resolve({ data: null, error: null }),
  )
  const client = {
    from: () => ({ select: () => ({ in: () => Promise.resolve({ data: cfgRows, error: null }) }) }),
    rpc,
  }
  return { client, rpc }
}

beforeEach(() => {
  vi.useFakeTimers()
  // 12:00Z = 09:00 em Sao Paulo
  vi.setSystemTime(new Date("2026-06-10T12:00:00Z"))
  flagMock.mockReset()
  clientMock.mockReset()
  sendMock.mockReset()
})
afterEach(() => vi.useRealTimers())

describe("runLembreteVespera", () => {
  it("pula quando a feature esta desligada", async () => {
    flagMock.mockResolvedValue(false)
    const r = await runLembreteVespera()
    expect(r).toEqual({ skipped: true, reason: "feature_off" })
    expect(clientMock).not.toHaveBeenCalled()
  })

  it("pula quando ainda nao chegou a hora configurada", async () => {
    flagMock.mockResolvedValue(true)
    const { client } = fakeClient([{ chave: "whatsapp_lembrete_vespera_hora", valor: "23" }], [])
    clientMock.mockReturnValue(client as never)
    const r = await runLembreteVespera()
    expect(r).toEqual({ skipped: true, reason: "fora_da_hora" }) // SP 9 < 23
  })

  it("envia para cada pedido e registra; conta sem-telefone como falha", async () => {
    flagMock.mockResolvedValue(true)
    const rpcRows = [
      { pedido_id: "1a2b3c4d-aaaa", nome: "Joao Silva", telefone: "21999990000", data_evento: "2026-06-11", horario_evento: "14:30:00" },
      { pedido_id: "9z8y7x6w-bbbb", nome: "Sem Fone", telefone: "", data_evento: "2026-06-11", horario_evento: "10:00:00" },
    ]
    const { client, rpc } = fakeClient(
      [{ chave: "whatsapp_lembrete_vespera_hora", valor: "9" }],
      rpcRows,
    )
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: true })

    const r = await runLembreteVespera()

    expect(r).toEqual({ skipped: false, total: 2, enviados: 1, falhas: 1 })
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      "21999990000",
      expect.stringContaining("amanhã (11/06) às 14:30"),
    )
    expect(sendMock).toHaveBeenCalledWith("21999990000", expect.stringContaining("Joao"))
    expect(sendMock).toHaveBeenCalledWith("21999990000", expect.stringContaining("#1a2b3c4d"))
    const registerCalls = rpc.mock.calls.filter((c) => c[0] === "register_whatsapp_message")
    expect(registerCalls).toHaveLength(1)
    expect(registerCalls[0][1]).toMatchObject({ p_tipo: "lembrete", p_status: "enviada" })
  })

  it("usa o template editado da config quando presente", async () => {
    flagMock.mockResolvedValue(true)
    const { client } = fakeClient(
      [
        { chave: "whatsapp_lembrete_vespera_hora", valor: "9" },
        { chave: "whatsapp_lembrete_vespera_msg", valor: "Lembrete {nome}: {data}" },
      ],
      [{ pedido_id: "abcd1234-xxxx", nome: "Maria", telefone: "2198888", data_evento: "2026-06-11", horario_evento: "08:00:00" }],
    )
    clientMock.mockReturnValue(client as never)
    sendMock.mockResolvedValue({ ok: true })

    await runLembreteVespera()
    expect(sendMock).toHaveBeenCalledWith("2198888", "Lembrete Maria: 11/06")
  })
})
