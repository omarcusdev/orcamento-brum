"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

const NAV_LINKS = [
  { label: "INÍCIO", href: "#home" },
  { label: "NOSSOS CHOPPS", href: "#catalogo" },
  { label: "CALCULADORA", href: "#calculadora" },
  { label: "MEUS PEDIDOS", href: "/meus-pedidos" },
] as const

const HeaderLanding = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
          scrolled ? "bg-brand-dark border-b border-brand-yellow/20" : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <span className="inline-block w-7 h-7 rounded-full bg-brand-yellow/20 border border-brand-yellow flex items-center justify-center text-brand-yellow text-xs">🍺</span>
            <span className="leading-none">
              <span className="block font-display font-bold text-brand-yellow text-lg tracking-wide">ALFA</span>
              <span className="block font-display text-brand-yellow text-[10px] tracking-[0.2em]">CHOPP</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-white text-xs font-semibold tracking-widest hover:text-brand-yellow transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
            <motion.a
              href="#catalogo"
              whileHover={{ opacity: 0.85, scale: 0.98 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-yellow text-brand-black font-bold px-5 py-2 rounded-full text-xs tracking-widest uppercase flex items-center gap-2"
            >
              <span>🛒</span>
              <span>Pedir Agora</span>
            </motion.a>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="md:hidden text-brand-yellow p-2 cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-brand-dark md:hidden flex flex-col"
          >
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="text-brand-yellow p-2 cursor-pointer"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-white text-lg font-semibold tracking-widest"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="#catalogo"
                onClick={() => setMobileOpen(false)}
                className="bg-brand-yellow text-brand-black font-bold px-8 py-3 rounded-full text-sm tracking-widest uppercase"
              >
                🛒 Pedir Agora
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default HeaderLanding
