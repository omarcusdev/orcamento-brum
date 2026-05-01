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
    className="relative h-screen min-h-[640px] flex items-center pt-20 overflow-hidden bg-brand-dark"
  >
    <div className="absolute inset-0 z-0">
      <Image
        src="/landing/hero-chopp.jpg"
        alt="Brindando com chopp"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-40"
      />
    </div>
    <div className="absolute inset-0 z-0 bg-gradient-to-r from-black via-black/85 to-transparent" />

    <div className="relative z-10 container mx-auto px-6 md:px-10 lg:px-16 grid md:grid-cols-2 gap-8 items-center">
      <div className="max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-block bg-brand-yellow/20 border border-brand-yellow/40 rounded-full px-4 py-1 mb-4"
        >
          <span className="text-brand-yellow text-xs font-bold uppercase tracking-[0.2em]">Delivery Premium</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-sans font-black leading-tight uppercase text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
        >
          <span className="block text-white">O Melhor Chopp</span>
          <span className="block text-brand-yellow mt-1">Pelo Melhor Preço</span>
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
          className="mt-8 flex flex-col sm:flex-row gap-4"
        >
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-yellow hover:bg-white text-brand-black px-8 py-4 rounded-full font-bold text-base text-center transition-all shadow-lg shadow-brand-yellow/30 hover:-translate-y-0.5"
          >
            SOLICITAR ORÇAMENTO
          </a>
          <Link
            href="#calculadora"
            className="border border-white text-white hover:bg-white hover:text-brand-black px-8 py-4 rounded-full font-bold text-base text-center transition-all"
          >
            VER OPÇÕES
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-warm-gray"
        >
          <span className="flex items-center gap-2"><span className="text-brand-yellow font-bold">✓</span> Instalação Grátis</span>
          <span className="flex items-center gap-2"><span className="text-brand-yellow font-bold">✓</span> Equipamento Incluso</span>
        </motion.div>
      </div>
    </div>
  </section>
)

export default HeroLanding
