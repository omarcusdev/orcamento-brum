"use server"

import { requireAdmin } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { productSchema, manualOrderInputSchema, updatePedidoSchema, updatePedidoItemSchema, type ManualOrderInput, type UpdatePedidoInput, type UpdatePedidoItemInput } from "@/lib/schemas"
import { calculateOrderTotals, priceManualOrderLines } from "@/lib/pricing"
import { STATUS_FLOW_ORDER, canRevertToStatus, LOCKED_EDIT_STATUSES, isAutoArchiveStatus } from "@/lib/admin-status"
import type { OrdemUpdate } from "@/lib/admin-ordem"
import { after } from "next/server"
import { sendCustomerWhatsAppStatusUpdate } from "@/lib/whatsapp/notificacoes"

const statusOrder = STATUS_FLOW_ORDER

export const advanceOrderStatus = async (pedidoId: string, currentStatus: string) => {
  const { supabase } = await requireAdmin()
  const currentIndex = statusOrder.indexOf(currentStatus as typeof statusOrder[number])

  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    throw new Error("Status invalido para avanco")
  }

  const nextStatus = statusOrder[currentIndex + 1]

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("documento_status, status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")

  if (pedido.status !== currentStatus) {
    throw new Error("Status do pedido foi alterado por outro usuario")
  }

  if (currentStatus === "confirmado") {
    throw new Error("Use despacho para entregador para avancar pedidos confirmados")
  }

  // Ao chegar em "recolhido" (status final), arquiva junto pra sair da esteira na hora.
  const statusUpdate = isAutoArchiveStatus(nextStatus)
    ? { status: nextStatus, arquivado_em: new Date().toISOString() }
    : { status: nextStatus }

  const { error, count } = await supabase
    .from("pedidos")
    .update(statusUpdate)
    .eq("id", pedidoId)
    .eq("status", currentStatus)

  if (error) throw error
  if (count === 0) throw new Error("Status do pedido foi alterado por outro usuario")

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")

  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, nextStatus))

  return { status: nextStatus }
}

export const cancelOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")

  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, "cancelado"))
}

export const archiveOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .is("arquivado_em", null)

  if (error) throw new Error(`Falha ao arquivar pedido: ${error.message}`)

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const unarchiveOrder = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: null })
    .eq("id", pedidoId)

  if (error) throw new Error(`Falha ao desarquivar pedido: ${error.message}`)

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

// Rede de seguranca: arquiva qualquer pedido "recolhido" que ainda esteja na esteira
// (ex.: pedidos antigos, anteriores ao arquivamento automatico em advanceOrderStatus).
// Roda a cada carga de /admin/pedidos; idempotente (so toca linhas nao-arquivadas).
export const archiveRecolhidoOrders = async () => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ arquivado_em: new Date().toISOString() })
    .is("arquivado_em", null)
    .eq("status", "recolhido")

  if (error) {
    console.error("archiveRecolhidoOrders failed", error)
  }
}

export const updateFrete = async (pedidoId: string, frete: number) => {
  const { supabase } = await requireAdmin()

  if (frete < 0) throw new Error("Frete nao pode ser negativo")

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("subtotal, desconto, status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")

  const lockedStatuses = ["enviar_para_entregador", "em_rota", "entregue", "pago", "recolhido", "cancelado"]
  if (lockedStatuses.includes(pedido.status)) {
    throw new Error("Frete nao pode ser alterado apos despacho")
  }

  const total = pedido.subtotal - pedido.desconto + frete

  const { error } = await supabase
    .from("pedidos")
    .update({ frete, total })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

const parseProductForm = (formData: FormData) =>
  productSchema.safeParse({
    marca: formData.get("marca"),
    descricao: formData.get("descricao") || undefined,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    preco_segundo_barril: formData.get("preco_segundo_barril") ? Number(formData.get("preco_segundo_barril")) : null,
    tipo: formData.get("tipo"),
  })

export const createProduct = async (formData: FormData) => {
  const { supabase } = await requireAdmin()
  const parsed = parseProductForm(formData)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }

  const { data, error } = await supabase.from("produtos").insert({
    ...parsed.data,
    descricao: parsed.data.descricao || null,
  }).select("id").single()
  if (error) throw error
  revalidatePath("/admin/catalogo")
  revalidatePath("/admin/promocoes")
  revalidatePath("/")
  return data
}

export const updateProduct = async (id: string, formData: FormData) => {
  const { supabase } = await requireAdmin()
  const parsed = parseProductForm(formData)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }

  const { error } = await supabase.from("produtos").update({
    ...parsed.data,
    descricao: parsed.data.descricao || null,
  }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
  revalidatePath("/admin/promocoes")
  revalidatePath("/")
}

export const updateProductSecondBarrelPrice = async (id: string, preco: number | null) => {
  const { supabase } = await requireAdmin()

  if (preco !== null) {
    if (!Number.isFinite(preco) || preco <= 0 || preco > 99999) {
      throw new Error("Preco invalido")
    }

    const { data: produto } = await supabase
      .from("produtos")
      .select("preco_avista")
      .eq("id", id)
      .single()
    if (!produto) throw new Error("Produto nao encontrado")
    if (preco >= Number(produto.preco_avista)) {
      throw new Error("Preco do 2º barril deve ser menor que o preco a vista")
    }
  }

  const { error } = await supabase
    .from("produtos")
    .update({ preco_segundo_barril: preco })
    .eq("id", id)

  if (error) throw error

  revalidatePath("/admin/catalogo")
  revalidatePath("/admin/promocoes")
  revalidatePath("/")
}

export const toggleProductActive = async (id: string, ativo: boolean) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
}

export const updateConfig = async (chave: string, valor: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("configuracoes")
    .update({ valor, updated_at: new Date().toISOString() })
    .eq("chave", chave)

  if (error) throw error
  revalidatePath("/")
  revalidatePath("/admin/configuracoes")
}

export const saveDeliveryArea = async (raioKm: number, centroLat: number, centroLng: number) => {
  const { supabase } = await requireAdmin()
  const updates = [
    { chave: "raio_km", valor: String(raioKm) },
    { chave: "centro_lat", valor: String(centroLat) },
    { chave: "centro_lng", valor: String(centroLng) },
  ]
  for (const { chave, valor } of updates) {
    const { error } = await supabase
      .from("configuracoes")
      .update({ valor, updated_at: new Date().toISOString() })
      .eq("chave", chave)
    if (error) throw error
  }
  revalidatePath("/")
  revalidatePath("/checkout")
  revalidatePath("/admin/area-entrega")
}

export const createExclusionZone = async (nome: string, poligono: { lat: number; lng: number }[]) => {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase
    .from("zonas_exclusao")
    .insert({ nome: nome || null, poligono })
    .select("id")
    .single()
  if (error) throw error
  revalidatePath("/admin/area-entrega")
  revalidatePath("/checkout")
  return data
}

export const deleteExclusionZone = async (id: string) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from("zonas_exclusao").delete().eq("id", id)
  if (error) throw error
  revalidatePath("/admin/area-entrega")
  revalidatePath("/checkout")
}

export const renameExclusionZone = async (id: string, nome: string) => {
  const { supabase } = await requireAdmin()
  const trimmed = nome.trim()
  const { error } = await supabase
    .from("zonas_exclusao")
    .update({ nome: trimmed.length > 0 ? trimmed : null })
    .eq("id", id)
  if (error) throw error
  revalidatePath("/admin/area-entrega")
}

export const verifyDocument = async (clienteId: string, pedidoId: string) => {
  const { supabase, user } = await requireAdmin()

  const { error: clienteError } = await supabase
    .from("clientes")
    .update({
      documento_verificado: true,
      documento_verificado_em: new Date().toISOString(),
      documento_verificado_por: user.id,
    })
    .eq("id", clienteId)
  if (clienteError) throw clienteError

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update({ documento_status: "verificado" })
    .eq("id", pedidoId)
  if (pedidoError) throw pedidoError

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const saveConteudo = async (secao: string, dados: Record<string, unknown>) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from("conteudo_pagina")
    .upsert({ secao, dados })
  if (error) throw error
  revalidatePath("/")
  revalidatePath("/admin/conteudo")
}

export const uploadProductImage = async (productId: string, formData: FormData) => {
  await requireAdmin()
  const file = formData.get("foto") as File | null
  if (!file) throw new Error("Nenhuma imagem enviada")
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from("produtos")
    .upload(productId, file, { upsert: true, contentType: file.type })
  if (uploadError) throw new Error(`Falha ao subir imagem: ${uploadError.message}`)
  const { data: urlData } = serviceClient.storage.from("produtos").getPublicUrl(productId)
  const cacheBustedUrl = `${urlData.publicUrl}?v=${Date.now()}`
  const { error: updateError } = await serviceClient
    .from("produtos")
    .update({ foto_url: cacheBustedUrl })
    .eq("id", productId)
  if (updateError) throw new Error(`Falha ao salvar URL da imagem: ${updateError.message}`)
  revalidatePath("/admin/catalogo")
  revalidatePath("/admin/promocoes")
  revalidatePath("/")
}

export const createEntregador = async (nome: string, telefone: string) => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("entregadores")
    .insert({ nome, telefone })
    .select("id")
    .single()

  if (error) throw error
  revalidatePath("/admin/entregadores")
  return data
}

export const updateEntregador = async (id: string, nome: string, telefone: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("entregadores")
    .update({ nome, telefone })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/admin/entregadores")
}

export const toggleEntregadorAtivo = async (id: string, ativo: boolean) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("entregadores")
    .update({ ativo })
    .eq("id", id)

  if (error) throw error
  revalidatePath("/admin/entregadores")
}

export const dispatchToEntregador = async (pedidoId: string, entregadorId: string) => {
  const { supabase } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (pedido.status !== "confirmado") throw new Error("Pedido precisa estar confirmado para despachar")

  const { data: entregador } = await supabase
    .from("entregadores")
    .select("id, ativo")
    .eq("id", entregadorId)
    .single()

  if (!entregador || !entregador.ativo) throw new Error("Entregador invalido ou inativo")

  const { error } = await supabase
    .from("pedidos")
    .update({ entregador_id: entregadorId, status: "enviar_para_entregador" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const fetchActiveEntregadores = async () => {
  const { supabase } = await requireAdmin()

  const { data, error } = await supabase
    .from("entregadores")
    .select("id, nome, telefone")
    .eq("ativo", true)
    .order("nome")

  if (error) throw error
  return data ?? []
}

export const getDocumentSignedUrl = async (clienteId: string, tipo: "pessoal" | "residencia") => {
  await requireAdmin()
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from("documentos")
    .createSignedUrl(`${clienteId}/${tipo}`, 300)
  if (error) throw error
  return data.signedUrl
}

export const getDocumentSignedUrlByPath = async (storagePath: string) => {
  await requireAdmin()
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage
    .from("documentos")
    .createSignedUrl(storagePath, 300)
  if (error) throw error
  return data.signedUrl
}

export const revertDocumentoVerificacao = async (clienteId: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("documento_status", "verificado")

  const { error: clienteError } = await supabase
    .from("clientes")
    .update({
      documento_verificado: false,
      documento_verificado_em: null,
      documento_verificado_por: null,
    })
    .eq("id", clienteId)
  if (clienteError) throw clienteError

  if (pedidos && pedidos.length > 0) {
    const pedidoIds = pedidos.map((p) => p.id)
    await supabase
      .from("pedidos")
      .update({ documento_status: "enviado" })
      .in("id", pedidoIds)

    await supabase.from("pedido_edit_log").insert(
      pedidoIds.map((pedido_id) => ({
        pedido_id,
        field: "documento_status",
        old_value: "verificado",
        new_value: "enviado",
        changed_by: user.id,
      })),
    )

    for (const pedidoId of pedidoIds) {
      revalidatePath(`/admin/pedidos/${pedidoId}`)
    }
  }

  revalidatePath("/admin")
}

export const deleteProduct = async (id: string) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from("produtos").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      throw new Error("Este produto tem pedidos vinculados. Desative ele em vez de excluir.")
    }
    throw error
  }
  const serviceClient = createServiceClient()
  await serviceClient.storage.from("produtos").remove([id])
  revalidatePath("/admin/catalogo")
  revalidatePath("/admin/promocoes")
  revalidatePath("/")
}

export const reorderProducts = async (updates: OrdemUpdate[]) => {
  const { supabase } = await requireAdmin()
  if (updates.length === 0) return
  for (const { id, ordem } of updates) {
    if (!Number.isInteger(ordem) || ordem < 0) throw new Error("Ordem invalida")
    const { error } = await supabase.from("produtos").update({ ordem }).eq("id", id)
    if (error) throw error
  }
  revalidatePath("/admin/catalogo")
  revalidatePath("/")
}

export const revertOrderStatus = async (pedidoId: string, newStatus: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status")
    .eq("id", pedidoId)
    .single()

  if (!pedido) throw new Error("Pedido nao encontrado")
  if (!canRevertToStatus(pedido.status, newStatus)) {
    throw new Error(`Nao pode voltar de ${pedido.status} para ${newStatus}`)
  }

  // Voltar status a partir de "recolhido" traz o pedido de volta pra esteira
  // (desfaz o arquivamento automatico); senao ficaria escondido nos Arquivados.
  const revertUpdate = isAutoArchiveStatus(pedido.status)
    ? { status: newStatus, updated_at: new Date().toISOString(), arquivado_em: null }
    : { status: newStatus, updated_at: new Date().toISOString() }

  const { error: updateError } = await supabase
    .from("pedidos")
    .update(revertUpdate)
    .eq("id", pedidoId)

  if (updateError) throw updateError

  await supabase.from("pedido_status_log").insert({
    pedido_id: pedidoId,
    status_anterior: pedido.status,
    status_novo: newStatus,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin")
}

export const searchClientes = async (query: string) => {
  const { supabase } = await requireAdmin()
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const sanitized = trimmed.replace(/\D/g, "")
  const filters: string[] = [`nome.ilike.%${trimmed}%`]
  if (sanitized.length >= 2) {
    filters.push(`telefone.ilike.%${sanitized}%`)
    filters.push(`cpf.ilike.%${sanitized}%`)
  }
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, cpf, email, documento_verificado")
    .or(filters.join(","))
    .limit(8)
  if (error) throw error
  return data ?? []
}

export const createManualOrder = async (input: ManualOrderInput) => {
  const parsed = manualOrderInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }
  const data = parsed.data
  const { supabase, user } = await requireAdmin()

  let clienteId: string
  if (data.cliente.kind === "existing") {
    clienteId = data.cliente.id
  } else {
    const cpfDigits = data.cliente.cpf?.replace(/\D/g, "") ?? null
    const { data: newCliente, error: cliErr } = await supabase
      .from("clientes")
      .insert({
        nome: data.cliente.nome,
        telefone: data.cliente.telefone,
        cpf: cpfDigits,
        email: data.cliente.email ?? null,
      })
      .select("id")
      .single()
    if (cliErr || !newCliente) {
      throw new Error(`Erro ao criar cliente: ${cliErr?.message ?? "desconhecido"}`)
    }
    clienteId = newCliente.id
  }

  const productIds = data.items.map((i) => i.produto_id)
  const { data: produtos, error: produtosErr } = await supabase
    .from("produtos")
    .select("id, preco_avista, preco_cartao, preco_segundo_barril, ativo")
    .in("id", productIds)
  if (produtosErr || !produtos) throw new Error("Erro ao buscar produtos")

  type ItemRow = {
    produto_id: string
    quantidade: number
    preco_unitario: number
    subtotal: number
    is_consignado: boolean
    consignado_status: "pendente" | null
  }
  for (const inputItem of data.items) {
    const produto = produtos.find((p) => p.id === inputItem.produto_id)
    if (!produto) throw new Error(`Produto nao encontrado: ${inputItem.produto_id}`)
    if (!produto.ativo) throw new Error("Produto indisponivel")
  }

  const itemRows: ItemRow[] = priceManualOrderLines(data.items, produtos, data.metodo_pagamento).flatMap((line): ItemRow[] =>
    line.is_consignado
      ? line.barrelPrices.map((price) => ({
          produto_id: line.produto_id,
          quantidade: 1,
          preco_unitario: price,
          subtotal: price,
          is_consignado: true,
          consignado_status: "pendente" as const,
        }))
      : [{
          produto_id: line.produto_id,
          quantidade: line.quantidade,
          preco_unitario: line.precoUnitario,
          subtotal: line.subtotal,
          is_consignado: false,
          consignado_status: null,
        }],
  )

  const totals = calculateOrderTotals(
    itemRows.map((r) => ({
      subtotal: r.subtotal,
      is_consignado: r.is_consignado,
      consignado_status: r.consignado_status,
    })),
  )
  const subtotal = Number(totals.subtotalMin.toFixed(2))
  const total = Number((subtotal + data.frete).toFixed(2))

  const { data: pedido, error: pedErr } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      status: "confirmado",
      documento_status: "pendente",
      endereco: data.endereco,
      endereco_completo: data.endereco_completo,
      data_evento: data.data_evento,
      horario_evento: data.horario_evento,
      tipo_chopeira: data.tipo_chopeira,
      rampas_escadas: data.rampas_escadas,
      observacoes: data.observacoes,
      subtotal,
      desconto: 0,
      frete: data.frete,
      total,
      metodo_pagamento: data.metodo_pagamento,
      pago: data.pago,
    })
    .select("id")
    .single()
  if (pedErr || !pedido) throw new Error(`Erro ao criar pedido: ${pedErr?.message ?? "desconhecido"}`)

  const { error: itemsErr } = await supabase
    .from("pedido_itens")
    .insert(itemRows.map((r) => ({ ...r, pedido_id: pedido.id })))
  if (itemsErr) {
    await supabase.from("pedidos").delete().eq("id", pedido.id)
    throw new Error(`Erro ao inserir itens: ${itemsErr.message}`)
  }

  await supabase.from("pedido_status_log").insert({
    pedido_id: pedido.id,
    status_anterior: null,
    status_novo: "confirmado",
    changed_by: user.id,
  })

  revalidatePath("/admin")
  revalidatePath("/admin/pedidos")
  return { pedidoId: pedido.id }
}

export const settleConsignado = async (pedidoItemId: string, status: "usado" | "devolvido") => {
  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, is_consignado, consignado_status")
    .eq("id", pedidoItemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  if (!item.is_consignado) throw new Error("Item nao eh consignado")
  if (item.consignado_status !== "pendente") throw new Error("Consignado ja foi settled")

  const { error: updateErr } = await supabase
    .from("pedido_itens")
    .update({ consignado_status: status })
    .eq("id", pedidoItemId)
  if (updateErr) throw updateErr

  const { data: allItems } = await supabase
    .from("pedido_itens")
    .select("subtotal, is_consignado, consignado_status")
    .eq("pedido_id", item.pedido_id)

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("frete, desconto")
    .eq("id", item.pedido_id)
    .single()

  const totals = calculateOrderTotals((allItems ?? []).map((i) => ({
    subtotal: Number(i.subtotal),
    is_consignado: i.is_consignado,
    consignado_status: i.consignado_status,
  })))
  const newSubtotal = Number(totals.subtotalMin.toFixed(2))
  const newTotal = Number((newSubtotal - Number(pedido?.desconto ?? 0) + Number(pedido?.frete ?? 0)).toFixed(2))

  await supabase
    .from("pedidos")
    .update({ subtotal: newSubtotal, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "consignado_status",
    old_value: "pendente",
    new_value: status,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
  revalidatePath("/admin/pedidos")
}

export const updatePedido = async (pedidoId: string, input: UpdatePedidoInput) => {
  const parsed = updatePedidoSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }
  const changes = parsed.data
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_EDIT_STATUSES.includes(pedido.status)) {
    throw new Error(`Pedido em status ${pedido.status} nao pode ser editado`)
  }

  const diffs: { field: string; old_value: unknown; new_value: unknown }[] = []
  const updates: Record<string, unknown> = {}

  for (const [key, newValue] of Object.entries(changes)) {
    if (newValue === undefined) continue
    const oldValue = (pedido as Record<string, unknown>)[key]
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue
    updates[key] = newValue
    diffs.push({ field: key, old_value: oldValue, new_value: newValue })
  }

  if (Object.keys(updates).length === 0) return

  if ("frete" in updates || "desconto" in updates) {
    const subtotal = Number(pedido.subtotal ?? 0)
    const nextFrete = "frete" in updates ? Number(updates.frete) : Number(pedido.frete ?? 0)
    const nextDesconto = "desconto" in updates ? Number(updates.desconto) : Number(pedido.desconto ?? 0)
    updates.total = Number((subtotal - nextDesconto + nextFrete).toFixed(2))
  }

  updates.updated_at = new Date().toISOString()

  const { error: updateErr } = await supabase
    .from("pedidos")
    .update(updates)
    .eq("id", pedidoId)
  if (updateErr) throw updateErr

  await supabase.from("pedido_edit_log").insert(
    diffs.map((d) => ({ ...d, pedido_id: pedidoId, changed_by: user.id })),
  )

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

const recalcPedidoTotals = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()
  const { data: items } = await supabase
    .from("pedido_itens")
    .select("subtotal, is_consignado, consignado_status")
    .eq("pedido_id", pedidoId)
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("frete, desconto")
    .eq("id", pedidoId)
    .single()
  const totals = calculateOrderTotals((items ?? []).map((i) => ({
    subtotal: Number(i.subtotal),
    is_consignado: i.is_consignado,
    consignado_status: i.consignado_status,
  })))
  const newSubtotal = Number(totals.subtotalMin.toFixed(2))
  const newTotal = Number((newSubtotal - Number(pedido?.desconto ?? 0) + Number(pedido?.frete ?? 0)).toFixed(2))
  await supabase
    .from("pedidos")
    .update({ subtotal: newSubtotal, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", pedidoId)
}

export const addPedidoItem = async (
  pedidoId: string,
  produtoId: string,
  quantidade: number,
  isConsignado: boolean,
) => {
  const { supabase, user } = await requireAdmin()

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("status, metodo_pagamento")
    .eq("id", pedidoId)
    .single()
  if (!pedido) throw new Error("Pedido nao encontrado")
  if (LOCKED_EDIT_STATUSES.includes(pedido.status)) throw new Error("Pedido travado")

  const { data: produto } = await supabase
    .from("produtos")
    .select("preco_avista, preco_cartao, preco_segundo_barril")
    .eq("id", produtoId)
    .single()
  if (!produto) throw new Error("Produto nao encontrado")

  const firstUnitPrice = pedido.metodo_pagamento === "cartao" && produto.preco_cartao
    ? Number(produto.preco_cartao)
    : Number(produto.preco_avista)
  const secondUnitPrice = produto.preco_segundo_barril != null
    ? Number(produto.preco_segundo_barril)
    : firstUnitPrice

  if (isConsignado) {
    const consignadoQty = Math.max(1, Math.floor(quantidade))
    const rows = Array.from({ length: consignadoQty }, (_, i) => {
      const unitPrice = i === 0 ? firstUnitPrice : secondUnitPrice
      return {
        pedido_id: pedidoId,
        produto_id: produtoId,
        quantidade: 1,
        preco_unitario: unitPrice,
        subtotal: unitPrice,
        is_consignado: true,
        consignado_status: "pendente" as const,
      }
    })
    const { error } = await supabase.from("pedido_itens").insert(rows)
    if (error) throw error
  } else {
    const subtotal = quantidade === 1 ? firstUnitPrice : firstUnitPrice + secondUnitPrice * (quantidade - 1)
    const unitAverage = quantidade > 0 ? subtotal / quantidade : firstUnitPrice
    const { error } = await supabase.from("pedido_itens").insert({
      pedido_id: pedidoId,
      produto_id: produtoId,
      quantidade,
      preco_unitario: Number(unitAverage.toFixed(2)),
      subtotal: Number(subtotal.toFixed(2)),
      is_consignado: false,
      consignado_status: null,
    })
    if (error) throw error
  }

  await recalcPedidoTotals(pedidoId)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: pedidoId,
    field: "items.added",
    old_value: null,
    new_value: { produto_id: produtoId, quantidade, is_consignado: isConsignado },
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

export const updatePedidoItem = async (itemId: string, input: UpdatePedidoItemInput) => {
  const parsed = updatePedidoItemSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  const changes = parsed.data
  if (changes.quantidade === undefined && changes.preco_unitario === undefined) return

  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, is_consignado, consignado_status, pedidos:pedido_id(status)")
    .eq("id", itemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  const pedidoStatus = Array.isArray(item.pedidos) ? item.pedidos[0]?.status : (item.pedidos as { status?: string } | null)?.status
  if (pedidoStatus && LOCKED_EDIT_STATUSES.includes(pedidoStatus)) throw new Error("Pedido travado")
  if (item.is_consignado && changes.quantidade !== undefined && changes.quantidade !== 1) {
    throw new Error("Itens consignado tem quantidade fixa de 1 por linha")
  }

  const nextQuantidade = changes.quantidade ?? item.quantidade
  const nextPrecoUnitario = changes.preco_unitario ?? Number(item.preco_unitario)
  const nextSubtotal = Number((nextPrecoUnitario * nextQuantidade).toFixed(2))

  const updates: Record<string, unknown> = {
    quantidade: nextQuantidade,
    preco_unitario: nextPrecoUnitario,
    subtotal: nextSubtotal,
  }

  const { error: updateErr } = await supabase.from("pedido_itens").update(updates).eq("id", itemId)
  if (updateErr) throw updateErr

  await recalcPedidoTotals(item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "items.updated",
    old_value: {
      id: itemId,
      quantidade: item.quantidade,
      preco_unitario: Number(item.preco_unitario),
      subtotal: Number(item.subtotal),
    },
    new_value: { id: itemId, ...updates },
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
}

export const removePedidoItem = async (itemId: string) => {
  const { supabase, user } = await requireAdmin()

  const { data: item } = await supabase
    .from("pedido_itens")
    .select("id, pedido_id, produto_id, quantidade, is_consignado, consignado_status, pedidos:pedido_id(status)")
    .eq("id", itemId)
    .single()
  if (!item) throw new Error("Item nao encontrado")
  const pedidoStatus = Array.isArray(item.pedidos) ? item.pedidos[0]?.status : (item.pedidos as { status?: string } | null)?.status
  if (pedidoStatus && LOCKED_EDIT_STATUSES.includes(pedidoStatus)) throw new Error("Pedido travado")

  const { error: delErr } = await supabase.from("pedido_itens").delete().eq("id", itemId)
  if (delErr) throw delErr

  await recalcPedidoTotals(item.pedido_id)

  await supabase.from("pedido_edit_log").insert({
    pedido_id: item.pedido_id,
    field: "items.removed",
    old_value: {
      id: itemId,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      is_consignado: item.is_consignado,
    },
    new_value: null,
    changed_by: user.id,
  })

  revalidatePath(`/admin/pedidos/${item.pedido_id}`)
}

