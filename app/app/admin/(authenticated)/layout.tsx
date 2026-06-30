import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminNav from "@/components/admin/admin-nav"
import { ConfirmProvider } from "@/components/admin/confirm-provider"

const AuthenticatedAdminLayout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/admin")

  return (
    <ConfirmProvider>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </div>
    </ConfirmProvider>
  )
}

export default AuthenticatedAdminLayout
