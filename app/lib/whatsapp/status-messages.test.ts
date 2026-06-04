import { describe, it, expect } from "vitest"
import {
  STATUS_NOTIFY_STATUSES,
  STATUS_LABELS,
  DEFAULT_STATUS_MESSAGES,
  isNotifyStatus,
  statusFlagKey,
  statusMsgKey,
  renderStatusTemplate,
  resolveStatusMessage,
} from "./status-messages"

describe("isNotifyStatus", () => {
  it("aceita os 4 status notificaveis", () => {
    expect(STATUS_NOTIFY_STATUSES).toEqual(["em_rota", "entregue", "cancelado", "recolhido"])
    for (const s of STATUS_NOTIFY_STATUSES) expect(isNotifyStatus(s)).toBe(true)
  })
  it("rejeita status fora do escopo", () => {
    expect(isNotifyStatus("confirmado")).toBe(false)
    expect(isNotifyStatus("enviar_para_entregador")).toBe(false)
    expect(isNotifyStatus("pago")).toBe(false)
    expect(isNotifyStatus("qualquer_coisa")).toBe(false)
  })
})

describe("statusFlagKey / statusMsgKey", () => {
  it("derivam as chaves de configuracoes", () => {
    expect(statusFlagKey("em_rota")).toBe("whatsapp_status_em_rota_ativo")
    expect(statusMsgKey("recolhido")).toBe("whatsapp_status_recolhido_msg")
  })
})

describe("DEFAULT_STATUS_MESSAGES / STATUS_LABELS", () => {
  it("tem os 4 status com label e ao menos um token", () => {
    for (const s of STATUS_NOTIFY_STATUSES) {
      expect(typeof STATUS_LABELS[s]).toBe("string")
      expect(STATUS_LABELS[s].length).toBeGreaterThan(0)
      const msg = DEFAULT_STATUS_MESSAGES[s]
      expect(msg.length).toBeGreaterThan(0)
      expect(msg.includes("{nome}") || msg.includes("{pedido}")).toBe(true)
    }
  })
  it("em_rota usa {nome} e {pedido}; recolhido nao referencia numero de pedido", () => {
    expect(DEFAULT_STATUS_MESSAGES.em_rota).toContain("{nome}")
    expect(DEFAULT_STATUS_MESSAGES.em_rota).toContain("{pedido}")
    expect(DEFAULT_STATUS_MESSAGES.recolhido).toContain("{nome}")
    expect(DEFAULT_STATUS_MESSAGES.recolhido).not.toContain("{pedido}")
  })
})

describe("renderStatusTemplate", () => {
  it("substitui {nome} e {pedido}, inclusive multiplas ocorrencias", () => {
    expect(renderStatusTemplate("Oi {nome}, pedido #{pedido}", { nome: "Joao", pedido: "1a2b3c4d" }))
      .toBe("Oi Joao, pedido #1a2b3c4d")
    expect(renderStatusTemplate("{nome} {nome}", { nome: "Ana", pedido: "x" })).toBe("Ana Ana")
  })
  it("deixa intacto texto sem token", () => {
    expect(renderStatusTemplate("sem token", { nome: "X", pedido: "y" })).toBe("sem token")
  })
})

describe("resolveStatusMessage", () => {
  const vars = { nome: "Joao", pedido: "1a2b3c4d" }

  it("pula status nao notificavel", () => {
    expect(resolveStatusMessage("pago", { statusOn: true, template: null, ...vars }))
      .toEqual({ skip: true })
  })
  it("pula quando o status esta desligado", () => {
    expect(resolveStatusMessage("em_rota", { statusOn: false, template: null, ...vars }))
      .toEqual({ skip: true })
  })
  it("usa o default quando o template e nulo", () => {
    const r = resolveStatusMessage("em_rota", { statusOn: true, template: null, ...vars })
    expect(r.skip).toBe(false)
    if (!r.skip) expect(r.mensagem).toBe(renderStatusTemplate(DEFAULT_STATUS_MESSAGES.em_rota, vars))
  })
  it("usa o default quando o template e vazio/espaco", () => {
    const r = resolveStatusMessage("entregue", { statusOn: true, template: "   ", ...vars })
    if (!r.skip) expect(r.mensagem).toContain("entregue")
    else throw new Error("nao deveria pular")
  })
  it("usa o template custom e renderiza tokens", () => {
    const r = resolveStatusMessage("cancelado", { statusOn: true, template: "Ei {nome}! #{pedido}", ...vars })
    expect(r).toEqual({ skip: false, mensagem: "Ei Joao! #1a2b3c4d" })
  })
})
