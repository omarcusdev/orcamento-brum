import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export const requireAdmin = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/admin")
  }

  const { data: adminRecord } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .single()

  if (!adminRecord) {
    throw new Error("Acesso negado")
  }

  return { user, supabase }
}
