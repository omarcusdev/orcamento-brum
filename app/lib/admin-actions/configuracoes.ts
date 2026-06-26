"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"

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

export const saveConteudo = async (secao: string, dados: Record<string, unknown>) => {
  const { supabase } = await requireAdmin()
  const { error } = await supabase
    .from("conteudo_pagina")
    .upsert({ secao, dados })
  if (error) throw error
  revalidatePath("/")
  revalidatePath("/admin/conteudo")
}
