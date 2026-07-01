import { describe, it, expect } from "vitest"
import { PEDIDO_LIST_SELECT, normalizeOrders } from "./admin-pedidos"

describe("normalizeOrders", () => {
  it("desembrulha clientes quando vem como array (relação supabase)", () => {
    const [order] = normalizeOrders([
      { id: "1", clientes: [{ nome: "Ana", telefone: "51999" }] },
    ])
    expect(order.clientes).toEqual({ nome: "Ana", telefone: "51999" })
  })

  it("mantém clientes quando já vem como objeto", () => {
    const [order] = normalizeOrders([
      { id: "1", clientes: { nome: "Ana", telefone: "51999" } },
    ])
    expect(order.clientes).toEqual({ nome: "Ana", telefone: "51999" })
  })

  it("preserva os demais campos da linha", () => {
    const [order] = normalizeOrders([
      { id: "abc", status: "confirmado", total: 1350, clientes: [{ nome: "X", telefone: "1" }] },
    ])
    expect(order.id).toBe("abc")
    expect(order.status).toBe("confirmado")
    expect(order.total).toBe(1350)
  })

  it("retorna lista vazia pra entrada vazia", () => {
    expect(normalizeOrders([])).toEqual([])
  })
})

describe("PEDIDO_LIST_SELECT", () => {
  it("inclui as colunas que a esteira e os cards consomem", () => {
    for (const col of ["status", "documento_status", "total", "data_evento", "metodo_pagamento", "arquivado_em", "clientes(nome, telefone)"]) {
      expect(PEDIDO_LIST_SELECT).toContain(col)
    }
  })
})
