"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

const Footer = () => (
  <footer className="relative bg-brand-dark text-brand-warm-gray py-16 px-4 overflow-hidden border-t border-brand-yellow/20">
    <div className="noise-overlay" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    <div className="relative max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <Image
            src="/logo-white.png"
            alt="ALFA Chopp Delivery"
            width={40}
            height={40}
          />
          <span className="font-display text-white font-bold text-xl tracking-wider">ALFA Chopp Delivery</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-8 text-sm"
        >
          <motion.a
            href="https://wa.me/5521999999999"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ opacity: 0.7 }}
            className="hover:text-brand-yellow transition-colors duration-200 tracking-wide uppercase font-medium"
          >
            WhatsApp
          </motion.a>
          <Link href="/admin" className="hover:text-brand-yellow transition-colors duration-200 tracking-wide uppercase font-medium">
            Painel
          </Link>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-center text-xs text-brand-warm-gray/50 mt-12 pt-8 border-t border-brand-yellow/10"
      >
        © {new Date().getFullYear()} ALFA Chopp Delivery. Todos os direitos reservados.
      </motion.div>
    </div>
  </footer>
)

export default Footer
