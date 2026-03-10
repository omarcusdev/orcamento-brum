"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

const Header = () => (
  <motion.header
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5, ease: "easeOut" }}
    className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-md border-b border-brand-yellow/20"
  >
    <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <Link href="/" className="opacity-90 hover:opacity-100 transition-opacity duration-300">
        <Image src="/logo-white.png" alt="ALFA Chopp Delivery" width={44} height={44} priority />
      </Link>
      <motion.a
        href="#catalogo"
        whileHover={{ opacity: 0.85, scale: 0.98 }}
        whileTap={{ scale: 0.95 }}
        className="bg-brand-yellow text-brand-black font-semibold px-5 py-2 rounded-md text-sm tracking-wide uppercase"
      >
        Fazer Pedido
      </motion.a>
    </nav>
  </motion.header>
)

export default Header
