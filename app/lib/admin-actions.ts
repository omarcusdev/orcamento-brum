"use server"

import { requireAdmin } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/schemas"
import type { OrdemUpdate } from "@/lib/admin-ordem"

const statusOrder = [
  "confirmado",
  "enviar_para_entregador",
  "em_rota",
  "entregue",
  "pago",
  "recolhido",
] as const

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

  const { error, count } = await supabase
    .from("pedidos")
    .update({ status: nextStatus })
    .eq("id", pedidoId)
    .eq("status", currentStatus)

  if (error) throw error
  if (count === 0) throw new Error("Status do pedido foi alterado por outro usuario")

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")

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

export const createProduct = async (formData: FormData) => {
  const { supabase } = await requireAdmin()

  const parsed = productSchema.safeParse({
    marca: formData.get("marca"),
    descricao: formData.get("descricao") || undefined,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo"),
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }

  const { data, error } = await supabase.from("produtos").insert({
    ...parsed.data,
    descricao: parsed.data.descricao || null,
  }).select("id").single()
  if (error) throw error
  revalidatePath("/admin/catalogo")
  return data
}

export const updateProduct = async (id: string, formData: FormData) => {
  const { supabase } = await requireAdmin()

  const parsed = productSchema.safeParse({
    marca: formData.get("marca"),
    descricao: formData.get("descricao") || undefined,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo"),
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dados invalidos")
  }

  const { error } = await supabase.from("produtos").update({
    ...parsed.data,
    descricao: parsed.data.descricao || null,
  }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
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
  const { supabase } = await requireAdmin()
  const file = formData.get("foto") as File | null
  if (!file) throw new Error("Nenhuma imagem enviada")
  const { error: uploadError } = await supabase.storage
    .from("produtos")
    .upload(productId, file, { upsert: true, contentType: file.type })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from("produtos").getPublicUrl(productId)
  const { error: updateError } = await supabase
    .from("produtos")
    .update({ foto_url: urlData.publicUrl })
    .eq("id", productId)
  if (updateError) throw updateError
  revalidatePath("/admin/catalogo")
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

export const deleteProduct = async (id: string) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase.from("produtos").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      throw new Error("Este produto tem pedidos vinculados. Desative ele em vez de excluir.")
    }
    throw error
  }
  await supabase.storage.from("produtos").remove([id])
  revalidatePath("/admin/catalogo")
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
