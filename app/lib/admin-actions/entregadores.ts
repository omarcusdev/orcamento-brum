"use server"

import { requireAdmin } from "@/lib/auth"
import { revalidatePath } from "next/cache"

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
