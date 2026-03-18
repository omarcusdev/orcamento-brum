import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Painel — ALFA Chopp Delivery",
}

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-brand-dark">
    {children}
  </div>
)

export default AdminLayout
