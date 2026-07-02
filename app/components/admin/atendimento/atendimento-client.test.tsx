// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/lib/supabase/client", () => {
  const chain = { on: () => chain, subscribe: () => chain }
  return { createClient: () => ({ channel: () => chain, removeChannel: () => {} }) }
})

vi.mock("@/lib/whatsapp/chat-actions", () => ({
  getConversas: vi.fn(async () => []),
  getConversaMensagens: vi.fn(async () => []),
  markConversaRead: vi.fn(async () => {}),
  enviarRespostaChat: vi.fn(async () => ({ ok: true })),
  buscarClientes: vi.fn(async () => []),
  getPedidosDoCliente: vi.fn(async () => []),
  vincularConversaCliente: vi.fn(async () => ({ ok: true })),
}))

import {
  getConversas,
  getConversaMensagens,
  type ConversaResumo,
  type MensagemChat,
} from "@/lib/whatsapp/chat-actions"
import AtendimentoClient from "./atendimento-client"

afterEach(cleanup)
beforeEach(() => {
  vi.mocked(getConversas).mockReset()
  vi.mocked(getConversaMensagens).mockReset()
})

const conversaCliente: ConversaResumo = {
  id: "conv-cliente",
  telefone: "5521999999999",
  nome: "Cliente Teste",
  preview: "última mensagem",
  naoLidas: 0,
  ultimaEm: "2026-07-01T12:00:00.000Z",
  clienteId: null,
  sistema: false,
}

const conversaSistema: ConversaResumo = {
  id: "conv-sistema",
  telefone: "5521888888888",
  nome: null,
  preview: "🔔 *AVISO DE TRANSBORDO*",
  naoLidas: 0,
  ultimaEm: "2026-07-01T11:00:00.000Z",
  clienteId: null,
  sistema: true,
}

const transbordoCorpo = [
  "🔔 *AVISO DE TRANSBORDO*",
  "",
  "Anotei aqui os dados do cliente para o atendimento humano:",
  "Nome: Cliente Teste",
].join("\n")

const normalCorpo = "Boa tarde! Seu pedido já saiu para entrega."

const mensagemSaida = (corpo: string): MensagemChat => ({
  id: "m1",
  direcao: "saida",
  corpo,
  ocorridaEm: "2026-07-01T12:00:00.000Z",
})

describe("AtendimentoClient — cartão de aviso do sistema vs balão do cliente", () => {
  it("uma mensagem 'saida' de transbordo renderiza o cartão neutro de sistema, não o balão amarelo", async () => {
    vi.mocked(getConversas).mockResolvedValue([conversaCliente])
    vi.mocked(getConversaMensagens).mockResolvedValue([mensagemSaida(transbordoCorpo)])

    render(<AtendimentoClient initial={[conversaCliente]} />)

    const label = await screen.findByText("Aviso do sistema")
    const card = label.parentElement as HTMLElement
    expect(card).not.toHaveClass("bg-brand-yellow")
    expect(card).not.toHaveClass("self-end")

    // o corpo do aviso aparece dentro do mesmo cartão (textContent bruto — o
    // corpo tem quebras de linha internas, então evitamos o matcher de texto
    // normalizado do RTL e comparamos o textContent diretamente).
    expect(card.textContent).toContain("AVISO DE TRANSBORDO")
    expect(card.textContent).toContain("Anotei aqui os dados do cliente")
  })

  it("uma mensagem 'saida' normal continua renderizando o balão amarelo de cliente", async () => {
    vi.mocked(getConversas).mockResolvedValue([conversaCliente])
    vi.mocked(getConversaMensagens).mockResolvedValue([mensagemSaida(normalCorpo)])

    render(<AtendimentoClient initial={[conversaCliente]} />)

    const bubble = await screen.findByText(normalCorpo)
    expect(bubble).toHaveClass("bg-brand-yellow")
    expect(bubble).toHaveClass("self-end")
    expect(screen.queryByText("Aviso do sistema")).not.toBeInTheDocument()
  })
})

describe("AtendimentoClient — seção Sistema/Avisos na lista", () => {
  it("mantém as conversas de sistema fora da lista padrão de clientes, sob uma seção separada", async () => {
    vi.mocked(getConversas).mockResolvedValue([conversaCliente, conversaSistema])
    vi.mocked(getConversaMensagens).mockResolvedValue([])

    render(<AtendimentoClient initial={[conversaCliente, conversaSistema]} />)

    // A lista (itens são <button>) é a fonte da verdade aqui — "Cliente Teste"
    // também aparece no cabeçalho da thread selecionada (ThreadContexto), então
    // escopamos por role="button" para consultar só os itens da lista.
    expect(screen.getByRole("button", { name: /Cliente Teste/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /5521888888888/ })).not.toBeInTheDocument()

    // alterna para a aba "Sistema"
    const abaSistema = screen.getByRole("radio", { name: /sistema/i })
    abaSistema.click()

    expect(await screen.findByRole("button", { name: /5521888888888/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cliente Teste/ })).not.toBeInTheDocument()
  })
})

describe("AtendimentoClient — thread de sistema não permite resposta nem vínculo", () => {
  it("esconde a caixa de resposta e o CTA de vincular cliente para uma conversa de sistema", async () => {
    vi.mocked(getConversas).mockResolvedValue([conversaSistema])
    vi.mocked(getConversaMensagens).mockResolvedValue([mensagemSaida(transbordoCorpo)])

    render(<AtendimentoClient initial={[conversaSistema]} />)

    await screen.findByText("Aviso do sistema")

    expect(screen.queryByPlaceholderText("Responder…")).not.toBeInTheDocument()
    expect(screen.queryByText("Vincular a um cliente")).not.toBeInTheDocument()
  })
})
