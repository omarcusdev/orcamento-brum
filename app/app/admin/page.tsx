import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import LoginForm from "@/components/admin/login-form"

const AdminLoginPage = async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect("/admin/pedidos")

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <LoginForm />
      </div>
    </div>
  )
}

export default AdminLoginPage
