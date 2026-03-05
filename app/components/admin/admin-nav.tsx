"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/catalogo", label: "Catalogo" },
  { href: "/admin/configuracoes", label: "Config" },
]

const AdminNav = () => {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin")
    router.refresh()
  }

  return (
    <header className="bg-brand-dark border-b border-brand-yellow/20">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                pathname.startsWith(item.href)
                  ? "bg-brand-yellow text-brand-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="text-gray-400 hover:text-white text-sm cursor-pointer"
        >
          Sair
        </button>
      </nav>
    </header>
  )
}

export default AdminNav
