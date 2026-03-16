"use server"

import { createClient } from "@/lib/supabase/server"
import { createOrderSchema } from "@/lib/schemas"

export const createOrder = async (input: unknown) => {
  const parsed = createOrderSchema.safeParse(input)

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }

  const data = parsed.data
  const supabase = await createClient()

  const productIds = data.items.map((item) => item.produto_id)
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, preco_avista, ativo")
    .in("id", productIds)

  if (productsError || !products) {
    throw new Error("Erro ao buscar produtos")
  }

  const priceMap = new Map(products.map((p) => [p.id, p]))

  for (const item of data.items) {
    const product = priceMap.get(item.produto_id)
    if (!product) throw new Error("Produto nao encontrado")
    if (!product.ativo) throw new Error("Produto indisponivel")
  }

  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefone", data.telefone)
    .single()

  const clienteId = existingClient
    ? existingClient.id
    : await (async () => {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({ nome: data.nome, telefone: data.telefone, email: data.email || null })
          .select("id")
          .single()
        if (clientError || !newClient) throw new Error("Erro ao criar cliente")
        return newClient.id
      })()

  const itemsWithServerPrice = data.items.map((item) => {
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
      endereco: data.endereco,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      observacoes: data.observacoes || null,
      tipo_chopeira: data.tipo_chopeira,
      metodo_pagamento: data.metodo_pagamento,
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
