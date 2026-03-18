"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { FooterContent } from "@/lib/types"

type FooterProps = {
  whatsappNumber?: string
  content?: FooterContent | null
}

const Footer = ({ whatsappNumber = "5521999999999", content }: FooterProps) => {
  const texto = content?.texto ?? "ALFA Chopp Delivery"
  const links = content?.links && content.links.length > 0
    ? content.links
    : [{ label: "WhatsApp", url: `https://wa.me/${whatsappNumber}` }]

  return (
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
            <span className="font-display text-white font-bold text-xl tracking-wider">{texto}</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-center gap-8 text-sm"
          >
            {links.map((link) => (
              <motion.a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ opacity: 0.7 }}
                className="hover:text-brand-yellow transition-colors duration-200 tracking-wide uppercase font-medium"
              >
                {link.label}
              </motion.a>
            ))}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-xs text-brand-warm-gray/50 mt-12 pt-8 border-t border-brand-yellow/10"
        >
          © {new Date().getFullYear()} {texto}. Todos os direitos reservados.
        </motion.div>
      </div>
    </footer>
  )
}

export default Footer
