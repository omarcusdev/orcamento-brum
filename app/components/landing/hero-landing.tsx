"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

type HeroLandingProps = {
  whatsappNumber?: string
}

const HeroLanding = ({ whatsappNumber = "5521999999999" }: HeroLandingProps) => (
  <section
    id="home"
    className="relative bg-brand-dark text-white overflow-hidden pt-20 md:pt-0"
  >
    <div className="grid md:grid-cols-[1.1fr_0.9fr] min-h-[80vh]">
      <div className="relative z-10 flex flex-col justify-center px-6 md:px-16 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex self-start items-center bg-brand-yellow text-brand-black text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full mb-6"
        >
          Delivery Premium
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display font-bold leading-[0.95] tracking-tight text-5xl md:text-6xl lg:text-7xl"
        >
          <span className="block">O Melhor Chopp</span>
          <span className="block text-brand-yellow">Pelo Melhor Preço</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 text-base md:text-lg text-brand-warm-gray max-w-md leading-relaxed"
        >
          Leve a experiência da choperia para o conforto da sua casa. Equipamento profissional,
          instalação rápida e o sabor inigualável que seus convidados merecem.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 flex flex-col sm:flex-row gap-3"
        >
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center bg-brand-yellow text-brand-black font-bold uppercase tracking-widest text-xs px-6 py-3.5 rounded-md hover:opacity-90 transition-opacity"
          >
            Solicitar Orçamento
          </a>
          <Link
            href="#calculadora"
            className="inline-flex items-center justify-center border border-white/40 text-white font-bold uppercase tracking-widest text-xs px-6 py-3.5 rounded-md hover:border-white transition-colors"
          >
            Ver Opções
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-brand-warm-gray"
        >
          <span className="flex items-center gap-2"><span className="text-brand-yellow">✓</span> Instalação Grátis</span>
          <span className="flex items-center gap-2"><span className="text-brand-yellow">✓</span> Equipamento Incluso</span>
        </motion.div>
      </div>

      <div className="relative min-h-[300px] md:min-h-full">
        <Image
          src="/landing/hero-chopp.jpg"
          alt="Brindando com chopp"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 md:bg-gradient-to-r md:from-brand-dark md:via-transparent md:to-transparent" />
      </div>
    </div>
  </section>
)

export default HeroLanding
