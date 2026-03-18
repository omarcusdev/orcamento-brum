"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/schemas"

const statusOrder = [
  "novo",
  "aguardando_pagamento",
  "confirmado",
  "em_rota",
  "entregue",
  "recolhido",
  "finalizado",
] as const

export const advanceOrderStatus = async (pedidoId: string, currentStatus: string) => {
  const { supabase } = await requireAdmin()
  const currentIndex = statusOrder.indexOf(currentStatus as typeof statusOrder[number])

  if (currentIndex === -1 || currentIndex >= statusOrder.length - 1) {
    throw new Error("Status invalido para avanco")
  }

  const nextStatus = statusOrder[currentIndex + 1]

  const { error } = await supabase
    .from("pedidos")
    .update({ status: nextStatus })
    .eq("id", pedidoId)

  if (error) throw error

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

export const markAsPaid = async (pedidoId: string) => {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("pedidos")
    .update({ pago: true })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
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

export const verifyDocument = async (clienteId: string) => {
  const { supabase, user } = await requireAdmin()
  const { error } = await supabase
    .from("clientes")
    .update({
      documento_verificado: true,
      documento_verificado_em: new Date().toISOString(),
      documento_verificado_por: user.id,
    })
    .eq("id", clienteId)
  if (error) throw error
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

export const getDocumentSignedUrl = async (clienteId: string) => {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(`${clienteId}/documento`, 60)
  if (error) throw error
  return data.signedUrl
}
