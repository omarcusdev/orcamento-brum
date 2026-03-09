"use client"

import Image from "next/image"
import { motion } from "framer-motion"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

const Hero = () => (
  <section className="relative bg-brand-dark text-white py-24 md:py-32 px-4 overflow-hidden">
    <div className="noise-overlay" />
    <div className="absolute inset-0 bg-gradient-to-b from-brand-yellow/5 via-transparent to-transparent" />
    <div className="relative max-w-5xl mx-auto text-center">
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <Image
          src="/logo-color.png"
          alt="ALFA Chopp Delivery"
          width={100}
          height={100}
          className="mx-auto mb-10"
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
        Chopp gelado no seu{" "}
        <span className="text-brand-yellow italic">evento</span>
      </motion.h1>
      <motion.p
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="text-lg md:text-xl text-brand-warm-gray max-w-xl mx-auto mb-10 leading-relaxed"
      >
        Delivery de chopp com chopeira inclusa para festas e eventos
        no Rio de Janeiro e Baixada Fluminense.
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
          Ver Catalogo
        </motion.a>
        <motion.a
          href="https://wa.me/5521999999999"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ opacity: 0.85, scale: 0.98 }}
          whileTap={{ scale: 0.95 }}
          className="border border-brand-yellow/40 text-brand-yellow font-semibold px-8 py-4 rounded-md text-sm tracking-widest uppercase hover:border-brand-yellow/70 transition-colors duration-300"
        >
          WhatsApp
        </motion.a>
      </motion.div>
    </div>
  </section>
)

export default Hero
