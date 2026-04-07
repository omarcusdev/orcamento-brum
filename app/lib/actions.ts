"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createOrderSchema } from "@/lib/schemas"
import { isAddressInDeliveryArea } from "@/lib/geo"

export const createOrder = async (input: unknown): Promise<{ pedidoId: string; clienteId: string; error?: never } | { error: string; pedidoId?: never; clienteId?: never }> => {
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos" }
  }

  const data = parsed.data
  const supabase = await createClient()

  const productIds = data.items.map((item) => item.produto_id)
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, preco_avista, preco_cartao, ativo")
    .in("id", productIds)

  if (productsError || !products) return { error: "Erro ao buscar produtos" }

  const priceMap = new Map(products.map((p) => [p.id, p]))
  for (const item of data.items) {
    const product = priceMap.get(item.produto_id)
    if (!product) return { error: "Produto nao encontrado" }
    if (!product.ativo) return { error: "Produto indisponivel" }
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

  if (!inArea) return { error: "Infelizmente nao atendemos essa regiao" }

  const cpfDigits = data.cpf.replace(/\D/g, "")
  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id, documento_verificado")
    .eq("cpf", cpfDigits)
    .single()

  let clienteId: string
  const docsAlreadyVerified = existingClient?.documento_verificado === true
  if (existingClient) {
    clienteId = existingClient.id
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from("clientes")
      .insert({ nome: data.nome, telefone: data.telefone, email: data.email || null, cpf: cpfDigits })
      .select("id")
      .single()
    if (clientError || !newClient) return { error: "Erro ao criar cliente" }
    clienteId = newClient.id
  }

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
    rua: data.endereco_rua ?? "",
    numero: data.endereco_numero ?? "",
    bairro: data.endereco_bairro,
    cidade: data.endereco_cidade,
    estado: data.endereco_estado,
    cep: data.endereco_cep ?? "",
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
      rampas_escadas: data.rampas_escadas || null,
      metodo_pagamento: data.metodo_pagamento,
      subtotal,
      total: subtotal,
      ...(docsAlreadyVerified && {
        documento_status: "verificado",
        status: "confirmado",
      }),
    })
    .select("id")
    .single()

  if (pedidoError || !pedido) return { error: "Erro ao criar pedido" }

  const itemsToInsert = itemsWithServerPrice.map((item) => ({
    ...item,
    pedido_id: pedido.id,
  }))

  const { error: itensError } = await supabase.from("pedido_itens").insert(itemsToInsert)
  if (itensError) return { error: "Erro ao criar itens do pedido" }

  return { pedidoId: pedido.id, clienteId }
}

export const getOrdersByCpf = async (rawCpf: string) => {
  const digits = rawCpf.replace(/\D/g, "")
  if (digits.length !== 11) return { error: "CPF invalido" as const, pedidos: [] }

  const supabase = await createClient()

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id")
    .eq("cpf", digits)
    .single()

  if (!cliente) return { error: null, pedidos: [] }

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, status, documento_status, data_evento, horario_evento, total, created_at, pedido_itens(quantidade, produtos(marca, volume_litros))")
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false })

  const mapped = (pedidos ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    documento_status: p.documento_status,
    data_evento: p.data_evento,
    horario_evento: p.horario_evento,
    total: p.total,
    created_at: p.created_at,
    itens: ((p.pedido_itens as unknown[]) ?? []).map((item: any) => {
      const produto = Array.isArray(item.produtos) ? item.produtos[0] : item.produtos
      return { quantidade: item.quantidade, marca: produto?.marca, volume: produto?.volume_litros }
    }),
  }))

  return { error: null, pedidos: mapped }
}

export const uploadDocuments = async (pedidoId: string, formData: FormData): Promise<{ error: string | null }> => {
  const pessoal = formData.get("documento_pessoal") as File
  const residencia = formData.get("comprovante_residencia") as File
  if (!pessoal || !residencia) return { error: "Ambos os documentos sao obrigatorios" }

  const supabase = createServiceClient()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("cliente_id, documento_status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) return { error: "Pedido nao encontrado" }
  if (pedido.documento_status !== "pendente") return { error: "Documentos ja enviados" }

  const clienteId = pedido.cliente_id

  const { error: err1 } = await supabase.storage
    .from("documentos")
    .upload(`${clienteId}/pessoal`, pessoal, { upsert: true, contentType: pessoal.type })
  if (err1) return { error: "Erro ao enviar documento pessoal" }

  const { error: err2 } = await supabase.storage
    .from("documentos")
    .upload(`${clienteId}/residencia`, residencia, { upsert: true, contentType: residencia.type })
  if (err2) return { error: "Erro ao enviar comprovante de residencia" }

  await supabase
    .from("clientes")
    .update({
      documento_pessoal_url: `${clienteId}/pessoal`,
      comprovante_residencia_url: `${clienteId}/residencia`,
    })
    .eq("id", clienteId)

  await supabase
    .from("pedidos")
    .update({ documento_status: "enviado" })
    .eq("id", pedidoId)

  return { error: null }
}
