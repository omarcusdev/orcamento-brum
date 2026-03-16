import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const requireAdmin = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin")
  }

  const { data: isAdmin } = await supabase.rpc("is_admin")

  if (!isAdmin) {
    throw new Error("Acesso negado")
  }

  return { user, supabase }
}
