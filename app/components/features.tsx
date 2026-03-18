"use client"

import { motion } from "framer-motion"
import { Beer, Truck, Wrench, DollarSign, Clock, Shield, Star, Heart, Phone, MapPin, Zap, Gift } from "lucide-react"
import type { FeaturesContent } from "@/lib/types"
import type { ComponentType } from "react"

const iconMap: Record<string, ComponentType<{ size?: number }>> = {
  beer: Beer, truck: Truck, wrench: Wrench, "dollar-sign": DollarSign,
  clock: Clock, shield: Shield, star: Star, heart: Heart,
  phone: Phone, "map-pin": MapPin, zap: Zap, gift: Gift,
}

const defaultFeatures = [
  {
    title: "Chopp Gelado Garantido",
    description: "Qualidade premium para seu evento. Consulte opcoes de equipamento pelo WhatsApp.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v4M10 2v4M14 2v4"/>
      </svg>
    ),
  },
  {
    title: "Entrega e Retirada",
    description: "Entregamos e recolhemos o equipamento. Voce so aproveita a festa.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    title: "Assistencia no Evento",
    description: "Oferecemos suporte tecnico durante seu evento, caso necessario.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    title: "Precos Promocionais",
    description: "Condicoes especiais para pagamento a vista via Pix ou dinheiro.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
]

type FeaturesProps = {
  content?: FeaturesContent | null
}

const Features = ({ content }: FeaturesProps) => {
  const titulo = content?.titulo ?? "Por que escolher a ALFA?"
  const subtitulo = content?.subtitulo ?? "Tudo que voce precisa para seu evento, sem complicacao"
  const useDynamic = content?.items && content.items.length > 0

  return (
    <section className="relative py-20 px-4 bg-brand-dark">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-yellow/60 to-transparent" />
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-5xl font-bold text-white text-center mb-3 uppercase tracking-wider"
        >
          {titulo}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-gray-light text-center mb-14"
        >
          {subtitulo}
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {useDynamic
            ? content!.items.map((item, idx) => {
                const IconComponent = iconMap[item.icone] ?? Star
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="text-center p-6"
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-yellow/20 flex items-center justify-center mx-auto mb-5 text-brand-yellow">
                      <IconComponent size={24} />
                    </div>
                    <h3 className="font-display font-bold text-white text-lg mb-2">{item.titulo}</h3>
                    <p className="text-sm text-brand-gray-light leading-relaxed">{item.descricao}</p>
                  </motion.div>
                )
              })
            : defaultFeatures.map((feature, idx) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="text-center p-6"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-yellow/20 flex items-center justify-center mx-auto mb-5 text-brand-yellow">
                    {feature.icon}
                  </div>
                  <h3 className="font-display font-bold text-white text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-brand-gray-light leading-relaxed">{feature.description}</p>
                </motion.div>
              ))
          }
        </div>
      </div>
    </section>
  )
}

export default Features
