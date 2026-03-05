import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Painel — ALFA Chopp Delivery",
}

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-50">
    {children}
  </div>
)

export default AdminLayout
