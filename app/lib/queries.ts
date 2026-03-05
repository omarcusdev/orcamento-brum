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
