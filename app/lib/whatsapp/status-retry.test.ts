import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("./notificacoes", () => ({ sendCustomerWhatsAppStatusUpdate: vi.fn() }))

import { createServiceClient } from "@/lib/supabase/service"
import { sendCustomerWhatsAppStatusUpdate } from "./notificacoes"
import { runStatusRetry } from "./status-retry"

const clientMock = vi.mocked(createServiceClient)
const sendMock = vi.mocked(sendCustomerWhatsAppStatusUpdate)

// Fake service client: .from("pedidos").select().in() -> pedidosRows;
// .from("mensagens_whatsapp").select().eq().in() -> enviadasRows.
const fakeClient = (
  pedidosRows: { id: string; status: string }[],
  enviadasRows: { pedido_id: string; tipo: string }[],
) => ({
  from: (table: string) => {
    if (table === "pedidos") {
      return { select: () => ({ in: () => Promise.resolve({ data: pedidosRows, error: null }) }) }
    }
    if (table === "mensagens_whatsapp") {
      return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: enviadasRows, error: null }) }) }) }
    }
    throw new Error(`unexpected table ${table}`)
  },
})

beforeEach(() => {
  clientMock.mockReset()
  sendMock.mockReset()
})

describe("runStatusRetry", () => {
  it("retries pedidos whose current status still lacks a sent notification", async () => {
    const client = fakeClient(
      [
        { id: "p1", status: "em_rota" },
        { id: "p2", status: "entregue" },
      ],
      [],
    )
    clientMock.mockReturnValue(client as never)

    const r = await runStatusRetry()

    expect(r).toEqual({ total: 2 })
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock).toHaveBeenCalledWith("p1", "em_rota")
    expect(sendMock).toHaveBeenCalledWith("p2", "entregue")
  })

  it("skips pedidos that already have a sent notification for the current status", async () => {
    const client = fakeClient(
      [
        { id: "p1", status: "em_rota" },
        { id: "p2", status: "entregue" },
      ],
      [{ pedido_id: "p1", tipo: "status_em_rota" }],
    )
    clientMock.mockReturnValue(client as never)

    const r = await runStatusRetry()

    expect(r).toEqual({ total: 1 })
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith("p2", "entregue")
  })

  it("only ever retries the pedido's CURRENT status, never a stale one it already moved past", async () => {
    // p1 failed at em_rota earlier and has since advanced to entregue; only a fresh
    // "entregue" attempt is valid, never a resend of the old em_rota message.
    const client = fakeClient([{ id: "p1", status: "entregue" }], [])
    clientMock.mockReturnValue(client as never)

    await runStatusRetry()

    expect(sendMock).toHaveBeenCalledWith("p1", "entregue")
    expect(sendMock).not.toHaveBeenCalledWith("p1", "em_rota")
  })

  it("returns total 0 and sends nothing when there are no candidate pedidos", async () => {
    const client = fakeClient([], [])
    clientMock.mockReturnValue(client as never)

    const r = await runStatusRetry()

    expect(r).toEqual({ total: 0 })
    expect(sendMock).not.toHaveBeenCalled()
  })
})
