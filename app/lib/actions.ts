"use server"

import { createClient } from "@/lib/supabase/server"

type CreateOrderInput = {
  nome: string
  telefone: string
  email?: string
  data_evento: string
  horario_evento: string
  endereco: string
  observacoes?: string
  tipo_chopeira: "gelo" | "eletrica"
  metodo_pagamento: "pix" | "cartao" | "dinheiro"
  items: { produto_id: string; quantidade: number; preco_unitario: number }[]
}

export const createOrder = async (input: CreateOrderInput) => {
  const supabase = await createClient()

  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefone", input.telefone)
    .single()

  let clienteId: string

  if (existingClient) {
    clienteId = existingClient.id
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clientes")
      .insert({ nome: input.nome, telefone: input.telefone, email: input.email || null })
      .select("id")
      .single()

    if (clientError || !newClient) throw new Error("Erro ao criar cliente")
    clienteId = newClient.id
  }

  const subtotal = input.items.reduce((sum, item) => sum + item.preco_unitario * item.quantidade, 0)

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      endereco: input.endereco,
      data_evento: input.data_evento,
      horario_evento: input.horario_evento,
      observacoes: input.observacoes || null,
      tipo_chopeira: input.tipo_chopeira,
      metodo_pagamento: input.metodo_pagamento,
      subtotal,
      total: subtotal,
    })
    .select("id")
    .single()

  if (pedidoError || !pedido) throw new Error("Erro ao criar pedido")

  const itemsToInsert = input.items.map((item) => ({
    pedido_id: pedido.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    subtotal: item.preco_unitario * item.quantidade,
  }))

  const { error: itensError } = await supabase.from("pedido_itens").insert(itemsToInsert)

  if (itensError) throw new Error("Erro ao criar itens do pedido")

  return { pedidoId: pedido.id }
}
