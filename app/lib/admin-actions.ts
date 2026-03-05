"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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
  const supabase = await createClient()
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
  const supabase = await createClient()

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
  revalidatePath("/admin/pedidos")
}

export const markAsPaid = async (pedidoId: string) => {
  const supabase = await createClient()

  const { error } = await supabase
    .from("pedidos")
    .update({ pago: true })
    .eq("id", pedidoId)

  if (error) throw error

  revalidatePath(`/admin/pedidos/${pedidoId}`)
}

export const createProduct = async (formData: FormData) => {
  const supabase = await createClient()

  const { error } = await supabase.from("produtos").insert({
    marca: formData.get("marca") as string,
    descricao: (formData.get("descricao") as string) || null,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo") as string,
  })

  if (error) throw error
  revalidatePath("/admin/catalogo")
}

export const updateProduct = async (id: string, formData: FormData) => {
  const supabase = await createClient()

  const { error } = await supabase.from("produtos").update({
    marca: formData.get("marca") as string,
    descricao: (formData.get("descricao") as string) || null,
    volume_litros: Number(formData.get("volume_litros")),
    preco_avista: Number(formData.get("preco_avista")),
    preco_cartao: formData.get("preco_cartao") ? Number(formData.get("preco_cartao")) : null,
    tipo: formData.get("tipo") as string,
  }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
}

export const toggleProductActive = async (id: string, ativo: boolean) => {
  const supabase = await createClient()

  const { error } = await supabase.from("produtos").update({ ativo }).eq("id", id)

  if (error) throw error
  revalidatePath("/admin/catalogo")
}
