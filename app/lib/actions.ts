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
  items: { produto_id: string; quantidade: number }[]
}

export const createOrder = async (input: CreateOrderInput) => {
  const supabase = await createClient()

  if (!input.items.length) {
    throw new Error("Pedido deve ter pelo menos um item")
  }

  const productIds = input.items.map((item) => item.produto_id)
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, preco_avista, ativo")
    .in("id", productIds)

  if (productsError || !products) {
    throw new Error("Erro ao buscar produtos")
  }

  const priceMap = new Map(products.map((p) => [p.id, p]))

  for (const item of input.items) {
    const product = priceMap.get(item.produto_id)
    if (!product) throw new Error("Produto nao encontrado")
    if (!product.ativo) throw new Error("Produto indisponivel")
    if (item.quantidade < 1) throw new Error("Quantidade invalida")
  }

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

  const itemsWithServerPrice = input.items.map((item) => {
    const serverPrice = priceMap.get(item.produto_id)!.preco_avista
    return {
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: serverPrice,
      subtotal: serverPrice * item.quantidade,
    }
  })

  const subtotal = itemsWithServerPrice.reduce((sum, item) => sum + item.subtotal, 0)

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

  const itemsToInsert = itemsWithServerPrice.map((item) => ({
    ...item,
    pedido_id: pedido.id,
  }))

  const { error: itensError } = await supabase.from("pedido_itens").insert(itemsToInsert)

  if (itensError) throw new Error("Erro ao criar itens do pedido")

  return { pedidoId: pedido.id }
}
