import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock do SDK do CloudWatch: captura construção do client e envios, sem rede.
const hoisted = vi.hoisted(() => {
  const sendMock = vi.fn()
  return {
    sendMock,
    ClientMock: vi.fn(() => ({ send: sendMock })),
    PutMock: vi.fn((input: unknown) => ({ kind: "put", input })),
    CreateMock: vi.fn((input: unknown) => ({ kind: "create", input })),
  }
})

vi.mock("@aws-sdk/client-cloudwatch-logs", () => ({
  CloudWatchLogsClient: hoisted.ClientMock,
  PutLogEventsCommand: hoisted.PutMock,
  CreateLogStreamCommand: hoisted.CreateMock,
}))

const ORIGINAL_KEY = process.env.AWS_ACCESS_KEY_ID

beforeEach(() => {
  vi.resetModules() // zera o cache de client/stream do módulo entre os testes
  hoisted.sendMock.mockReset()
  hoisted.sendMock.mockResolvedValue({})
  hoisted.ClientMock.mockClear()
  hoisted.PutMock.mockClear()
  hoisted.CreateMock.mockClear()
})

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.AWS_ACCESS_KEY_ID
  else process.env.AWS_ACCESS_KEY_ID = ORIGINAL_KEY
  vi.restoreAllMocks()
})

describe("logWa / logWaError", () => {
  it("sempre escreve no console com prefixo [whatsapp] e o JSON dos campos", async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const { logWa } = await import("./wa-log")

    logWa("agente:resultado", { tel4: "1234", replyLen: 7 })

    expect(info).toHaveBeenCalledWith("[whatsapp] agente:resultado", JSON.stringify({ tel4: "1234", replyLen: 7 }))
  })

  it("logWaError escreve no console.error", async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const { logWaError } = await import("./wa-log")

    logWaError("agente:erro-config", { erro: "boom" })

    expect(err).toHaveBeenCalledWith("[whatsapp] agente:erro-config", JSON.stringify({ erro: "boom" }))
  })

  it("SEM credenciais AWS não constrói client nem envia pro CloudWatch (e não lança)", async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { logWa } = await import("./wa-log")

    expect(() => logWa("agente:ativacao", { a: 1 })).not.toThrow()
    await Promise.resolve()
    expect(hoisted.ClientMock).not.toHaveBeenCalled()
    expect(hoisted.sendMock).not.toHaveBeenCalled()
  })

  it("COM credenciais AWS cria o stream uma vez e envia PutLogEvents (best-effort)", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIA-test"
    vi.spyOn(console, "info").mockImplementation(() => {})
    const { logWa } = await import("./wa-log")

    logWa("agente:envio", { sendOk: true })
    logWa("agente:resultado", { decisao: "respondeu" })

    await vi.waitFor(() => expect(hoisted.sendMock).toHaveBeenCalledTimes(3)) // 1 create-stream + 2 put
    expect(hoisted.CreateMock).toHaveBeenCalledTimes(1) // stream criado uma única vez
    expect(hoisted.PutMock).toHaveBeenCalledTimes(2)
  })

  it("NUNCA lança mesmo se o envio pro CloudWatch falhar", async () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIA-test"
    vi.spyOn(console, "info").mockImplementation(() => {})
    hoisted.sendMock.mockRejectedValue(new Error("cloudwatch down"))
    const { logWa } = await import("./wa-log")

    expect(() => logWa("agente:resultado", {})).not.toThrow()
    await Promise.resolve()
  })
})

describe("errInfo", () => {
  it("normaliza Error -> { erro, erroNome }", async () => {
    const { errInfo } = await import("./wa-log")
    expect(errInfo(new TypeError("xpto"))).toEqual({ erro: "xpto", erroNome: "TypeError" })
  })

  it("normaliza erro do Supabase ({ message }) -> { erro }", async () => {
    const { errInfo } = await import("./wa-log")
    expect(errInfo({ message: "RLS denied" })).toEqual({ erro: "RLS denied" })
  })

  it("normaliza valor solto -> { erro: String(valor) }", async () => {
    const { errInfo } = await import("./wa-log")
    expect(errInfo("texto cru")).toEqual({ erro: "texto cru" })
  })
})
