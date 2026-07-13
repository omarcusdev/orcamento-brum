import { describe, it, expect } from "vitest"
import { createOrderSchema } from "./schemas"

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
