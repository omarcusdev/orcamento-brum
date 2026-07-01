"use server"

import { requireAdmin } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/service"
import { revalidatePath } from "next/cache"
import { productSchema } from "@/lib/schemas"
import type { OrdemUpdate } from "@/lib/admin-ordem"

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
