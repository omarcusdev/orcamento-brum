"use server"

import { createClient } from "@/lib/supabase/server"
import { createOrderSchema } from "@/lib/schemas"
import { isAddressInDeliveryArea } from "@/lib/geo"

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
    .select("id, preco_avista, preco_cartao, ativo")
    .in("id", productIds)

  if (productsError || !products) throw new Error("Erro ao buscar produtos")

  const priceMap = new Map(products.map((p) => [p.id, p]))
  for (const item of data.items) {
    const product = priceMap.get(item.produto_id)
    if (!product) throw new Error("Produto nao encontrado")
    if (!product.ativo) throw new Error("Produto indisponivel")
  }

  const { data: configRows } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["raio_km", "centro_lat", "centro_lng"])

  const config: Record<string, string> = {}
  for (const row of configRows ?? []) config[row.chave] = row.valor

  const { data: zones } = await supabase.from("zonas_exclusao").select("poligono")

  const inArea = isAddressInDeliveryArea(
    data.endereco_lat, data.endereco_lng,
    parseFloat(config.centro_lat ?? "-22.9068"),
    parseFloat(config.centro_lng ?? "-43.1729"),
    parseFloat(config.raio_km ?? "50"),
    (zones ?? []).map((z) => z.poligono as { lat: number; lng: number }[])
  )

  if (!inArea) throw new Error("Infelizmente nao atendemos essa regiao")

  const cpfDigits = data.cpf.replace(/\D/g, "")
  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id, documento_verificado")
    .eq("cpf", cpfDigits)
    .single()

  const clienteId = existingClient
    ? existingClient.id
    : await (async () => {
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({ nome: data.nome, telefone: data.telefone, email: data.email || null, cpf: cpfDigits })
          .select("id")
          .single()
        if (clientError || !newClient) throw new Error("Erro ao criar cliente")
        return newClient.id
      })()

  const enderecoDisplay = [
    data.endereco_rua,
    data.endereco_numero,
    data.endereco_complemento,
    data.endereco_bairro,
    data.endereco_cidade,
    data.endereco_estado,
    data.endereco_cep,
  ].filter(Boolean).join(", ")

  const enderecoCompleto = {
    rua: data.endereco_rua,
    numero: data.endereco_numero,
    bairro: data.endereco_bairro,
    cidade: data.endereco_cidade,
    estado: data.endereco_estado,
    cep: data.endereco_cep,
    complemento: data.endereco_complemento ?? "",
    lat: data.endereco_lat,
    lng: data.endereco_lng,
  }

  const useCardPrice = data.metodo_pagamento === "cartao"
  const itemsWithServerPrice = data.items.map((item) => {
    const product = priceMap.get(item.produto_id)!
    const serverPrice = (useCardPrice && product.preco_cartao) ? product.preco_cartao : product.preco_avista
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
      endereco: enderecoDisplay,
      endereco_completo: enderecoCompleto,
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

  return { pedidoId: pedido.id, clienteId }
}

export const uploadDocument = async (formData: FormData) => {
  const clienteId = formData.get("clienteId") as string
  const file = formData.get("documento") as File
  if (!clienteId || !file) throw new Error("Dados invalidos")

  const supabase = await createClient()

  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(`${clienteId}/documento`, file, { upsert: true, contentType: file.type })
  if (uploadError) throw new Error("Erro ao enviar documento")

  await supabase
    .from("clientes")
    .update({ documento_url: `${clienteId}/documento` })
    .eq("id", clienteId)
}
