"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").replace(/^55/, "")
  if (digits.length !== 11) return raw
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const QUICK_LINKS = [
  { label: "Início", href: "#home" },
  { label: "Nossos Chopps", href: "#catalogo" },
  { label: "Calculadora", href: "#calculadora" },
  { label: "Dúvidas Frequentes", href: "#faq" },
] as const

const PAYMENT_ICONS = ["pix", "visa", "mastercard", "elo"] as const

type FooterLandingProps = {
  whatsappNumber?: string
  contactEmail?: string
  instagramUrl?: string
}

const FooterLanding = ({
  whatsappNumber = "5521999999999",
  contactEmail = "contato@alfachopp.com.br",
  instagramUrl = "https://www.instagram.com/alfachopp/",
}: FooterLandingProps) => (
  <footer className="bg-brand-dark text-brand-warm-gray pt-16 pb-6 px-6 border-t border-brand-yellow/15">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-7 h-7 rounded-full bg-brand-yellow/20 border border-brand-yellow flex items-center justify-center text-brand-yellow text-xs">🍺</span>
          <span className="leading-none">
            <span className="block font-display font-bold text-brand-yellow text-lg tracking-wide">ALFA</span>
            <span className="block font-display text-brand-yellow text-[10px] tracking-[0.2em]">CHOPP</span>
          </span>
        </div>
        <p className="text-sm leading-relaxed mb-4">
          Especialistas em levar o melhor chopp para o seu evento. Qualidade, pontualidade
          e serviço premium.
        </p>
        <div className="flex gap-3">
          <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-9 h-9 rounded-full border border-brand-yellow/40 flex items-center justify-center hover:bg-brand-yellow/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-brand-yellow">
              <rect x="2" y="2" width="20" height="20" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
            </svg>
          </a>
          <a href="https://www.facebook.com/alfachopp" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 rounded-full border border-brand-yellow/40 flex items-center justify-center hover:bg-brand-yellow/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-brand-yellow">
              <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9V12.06h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.45 2.91h-2.33V22c4.78-.78 8.43-4.94 8.43-9.94z"/>
            </svg>
          </a>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.05 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Links Rápidos</h3>
        <ul className="space-y-2 text-sm">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="hover:text-brand-yellow transition-colors">{link.label}</Link>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Contato</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">📞</span>
            <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-yellow transition-colors">
              {formatPhone(whatsappNumber)}
            </a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">✉️</span>
            <a href={`mailto:${contactEmail}`} className="hover:text-brand-yellow transition-colors break-all">{contactEmail}</a>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-yellow">📍</span>
            <span>Atendemos toda a região metropolitana</span>
          </li>
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.15 }}>
        <h3 className="font-display text-brand-yellow text-sm uppercase tracking-widest mb-4">Siga no Instagram</h3>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3].map((n) => (
            <a key={n} href={instagramUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-md hover:opacity-80 transition-opacity">
              <Image src={`/landing/instagram/0${n}.jpg`} alt={`Post Instagram ${n}`} width={120} height={120} className="object-cover w-full h-full" />
            </a>
          ))}
        </div>
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-yellow hover:underline">
          Ver perfil completo →
        </a>
      </motion.div>

    </div>

    <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-brand-yellow/15 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
      <p>© {new Date().getFullYear()} Alfa Chopp Express. Todos os direitos reservados.</p>
      <div className="flex gap-2">
        {PAYMENT_ICONS.map((name) => (
          <Image key={name} src={`/landing/payment/${name}.svg`} alt={name} width={48} height={18} />
        ))}
      </div>
    </div>
  </footer>
)

export default FooterLanding
