"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { HeroContent } from "@/lib/types"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

type HeroProps = {
  whatsappNumber?: string
  content?: HeroContent | null
}

const Hero = ({ whatsappNumber = "5521999999999", content }: HeroProps) => {
  const titulo = content?.titulo ?? "Chopp gelado no seu evento"
  const subtitulo = content?.subtitulo ?? "Delivery de chopp para festas e eventos no Rio de Janeiro e Baixada Fluminense."
  const ctaTexto = content?.cta_texto ?? "Ver Catalogo"
  const ctaWhatsapp = content?.cta_whatsapp_texto ?? "WhatsApp"

  return (
    <section className="relative bg-brand-dark text-white py-24 md:py-32 px-4 overflow-hidden">
      <div className="noise-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-yellow/10 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-yellow/5 rounded-full blur-3xl" />
      <div className="relative max-w-5xl mx-auto text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <Image
            src="/logo-color.png"
            alt="ALFA Chopp Delivery"
            width={160}
            height={160}
            className="mx-auto mb-8 drop-shadow-[0_0_30px_rgba(232,185,18,0.3)]"
            priority
          />
        </motion.div>
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight leading-[1.1]"
        >
          {titulo.includes("evento") ? (
            <>
              {titulo.split("evento")[0]}
              <span className="text-brand-yellow">evento</span>
              {titulo.split("evento")[1]}
            </>
          ) : (
            titulo
          )}
        </motion.h1>
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="text-lg md:text-xl text-brand-warm-gray max-w-xl mx-auto mb-10 leading-relaxed"
        >
          {subtitulo}
        </motion.p>
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.a
            href="#catalogo"
            whileHover={{ opacity: 0.85, scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
            className="bg-brand-yellow text-brand-black font-semibold px-8 py-4 rounded-md text-sm tracking-widest uppercase"
          >
            {ctaTexto}
          </motion.a>
          <motion.a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ opacity: 0.85, scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
            className="border border-brand-yellow/60 text-brand-yellow font-semibold px-8 py-4 rounded-md text-sm tracking-widest uppercase hover:border-brand-yellow/70 transition-colors duration-300"
          >
            {ctaWhatsapp}
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}

export default Hero
