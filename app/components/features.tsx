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
    title: "Extremamente Gelado",
    description: "Nossas chopeiras elétricas mantêm a temperatura ideal do primeiro ao último copo.",
    Icon: Beer,
  },
  {
    title: "Entrega, Instalação e Recolhimento",
    description: "Entregamos, instalamos e configuramos o equipamento. No fim do evento, voltamos para recolher tudo.",
    Icon: Truck,
  },
  {
    title: "Qualidade Premium",
    description: "Trabalhamos só com barris frescos e marcas selecionadas. Sabor consistente que seus convidados merecem.",
    Icon: Star,
  },
  {
    title: "Preços Honestos",
    description: "Condições especiais para pagamento à vista via Pix ou dinheiro. Sem letra miúda, sem taxa surpresa.",
    Icon: DollarSign,
  },
]

type FeaturesProps = {
  content?: FeaturesContent | null
}

const Features = ({ content }: FeaturesProps) => {
  const titulo = content?.titulo ?? "Por que escolher a ALFA?"
  const subtitulo = content?.subtitulo ?? "Tudo que você precisa para o seu evento, sem complicação"
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
                    <feature.Icon size={24} />
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
