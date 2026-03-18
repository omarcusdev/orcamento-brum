import { createClient } from "@/lib/supabase/server"

export const getActiveProducts = async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("preco_avista", { ascending: true })

  if (error) throw error
  return data
}

export const getConfig = async (chave: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", chave)
    .single()

  return data?.valor ?? null
}

export const getConteudo = async (secao: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conteudo_pagina")
    .select("dados")
    .eq("secao", secao)
    .single()

  return data?.dados ?? null
}

export const getDeliveryConfig = async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", ["raio_km", "centro_lat", "centro_lng"])

  const config: Record<string, string> = {}
  for (const row of data ?? []) {
    config[row.chave] = row.valor
  }

  return {
    raioKm: parseFloat(config.raio_km ?? "50"),
    centroLat: parseFloat(config.centro_lat ?? "-22.9068"),
    centroLng: parseFloat(config.centro_lng ?? "-43.1729"),
  }
}

export const getExclusionZones = async () => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("zonas_exclusao")
    .select("*")
    .order("created_at")

  return data ?? []
}
