import { describe, it, expect } from "vitest"
import { createOrderSchema, manualOrderInputSchema } from "./schemas"
import { REQUIRE_FIRME_MESSAGE } from "./pricing"

// CPF válido pelo algoritmo (validado em lib/cpf.ts).
const validPayload = {
  nome: "Fulano de Tal",
  telefone: "(21) 99999-9999",
  cpf: "529.982.247-25",
  data_evento: "2099-01-01",
  horario_evento: "12:00",
  endereco_bairro: "Centro",
  endereco_cidade: "Rio de Janeiro",
  endereco_estado: "RJ",
  endereco_lat: -22.9,
  endereco_lng: -43.2,
  tipo_chopeira: "gelo" as const,
  metodo_pagamento: "pix" as const,
  items: [{ produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1 }],
}

describe("createOrderSchema — 24h min lead time", () => {
  it("aceita evento bem no futuro", () => {
    expect(createOrderSchema.safeParse(validPayload).success).toBe(true)
  })
  it("reprova evento com menos de 24h (aqui: no passado) com issue em horario_evento", () => {
    const result = createOrderSchema.safeParse({ ...validPayload, data_evento: "2020-01-01" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("horario_evento"))).toBe(true)
    }
  })
})

const validManualOrder = {
  cliente: { kind: "existing" as const, id: "00000000-0000-0000-0000-000000000000" },
  endereco: "Rua X, 123",
  endereco_completo: null,
  data_evento: "2099-01-01",
  horario_evento: "12:00",
  tipo_chopeira: "gelo" as const,
  rampas_escadas: null,
  observacoes: null,
  items: [{ produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: false }],
  metodo_pagamento: "pix" as const,
  pago: false,
  frete: 20,
  desconto: 0,
}

describe("manualOrderInputSchema — trava >=1 firme", () => {
  it("aceita pedido com ao menos um item firme", () => {
    expect(manualOrderInputSchema.safeParse(validManualOrder).success).toBe(true)
  })
  it("aceita misto (firme + consignado)", () => {
    const input = { ...validManualOrder, items: [
      { produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: false },
      { produto_id: "11111111-1111-4111-8111-111111111111", quantidade: 1, is_consignado: true },
    ] }
    expect(manualOrderInputSchema.safeParse(input).success).toBe(true)
  })
  it("rejeita pedido 100% consignado com issue em items", () => {
    const input = { ...validManualOrder, items: [
      { produto_id: "00000000-0000-0000-0000-000000000000", quantidade: 1, is_consignado: true },
      { produto_id: "11111111-1111-4111-8111-111111111111", quantidade: 2, is_consignado: true },
    ] }
    const result = manualOrderInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("items") && i.message === REQUIRE_FIRME_MESSAGE)).toBe(true)
    }
  })
})

describe("manualOrderInputSchema — desconto", () => {
  it("aceita desconto valido e o preserva", () => {
    const result = manualOrderInputSchema.safeParse({ ...validManualOrder, desconto: 50 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.desconto).toBe(50)
  })
  it("rejeita desconto negativo", () => {
    expect(manualOrderInputSchema.safeParse({ ...validManualOrder, desconto: -10 }).success).toBe(false)
  })
})
