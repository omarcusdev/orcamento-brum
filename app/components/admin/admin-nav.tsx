"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/catalogo", label: "Catalogo" },
  { href: "/admin/area-entrega", label: "Area" },
  { href: "/admin/conteudo", label: "Conteudo" },
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
        <div className="flex items-center gap-4">
          <Link href="/admin/pedidos" className="flex items-center gap-2">
            <Image src="/logo-white.png" alt="ALFA" width={28} height={28} />
            <span className="font-display text-sm tracking-wide text-brand-yellow hidden sm:inline">PAINEL</span>
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  pathname.startsWith(item.href)
                    ? "bg-brand-yellow text-brand-black"
                    : "text-brand-gray-light hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-brand-warm-gray hover:text-white text-sm cursor-pointer"
        >
          Sair
        </button>
      </nav>
    </header>
  )
}

export default AdminNav
