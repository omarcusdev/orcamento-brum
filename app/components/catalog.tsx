"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Produto } from "@/lib/types"
import ProductCard from "@/components/product-card"

type CatalogProps = {
  produtos: Produto[]
  onAddToCart: (produto: Produto) => void
}

const VOLUMES = [50, 30] as const

const Catalog = ({ produtos, onAddToCart }: CatalogProps) => {
  const [filter, setFilter] = useState<"todos" | "chopp" | "vinho">("todos")

  const filtered = filter === "todos"
    ? produtos
    : produtos.filter((p) => p.tipo === filter)

  const sections = VOLUMES
    .map((volume) => ({
      volume,
      items: filtered.filter((p) => p.volume_litros === volume),
    }))
    .filter((s) => s.items.length > 0)

  return (
    <section id="catalogo" className="py-20 px-4 bg-[#2A2A2A]">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-5xl font-bold text-white text-center mb-3 uppercase tracking-wider"
        >
          Nossos Chopps
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-gray-light text-center mb-10"
        >
          Escolha seus chopps e monte seu pedido
        </motion.p>
        <div className="flex justify-center gap-2 mb-10">
          {(["todos", "chopp", "vinho"] as const).map((tipo) => (
            <motion.button
              key={tipo}
              onClick={() => setFilter(tipo)}
              whileHover={{ opacity: 0.85 }}
              whileTap={{ scale: 0.95 }}
              className={`px-5 py-2 rounded-md text-sm font-medium tracking-wide uppercase transition-all duration-200 cursor-pointer ${
                filter === tipo
                  ? "bg-brand-yellow text-brand-black"
                  : "bg-brand-black text-brand-warm-gray border border-white/10 hover:border-brand-yellow/30"
              }`}
            >
              {tipo === "todos" ? "Todos" : tipo === "chopp" ? "Chopp" : "Vinho"}
            </motion.button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-14"
          >
            {sections.map(({ volume, items }) => (
              <div key={volume}>
                <div className="flex items-baseline gap-4 mb-6">
                  <h3 className="font-display text-xl md:text-2xl font-bold text-white tracking-wider uppercase">
                    Barris de <span className="text-brand-yellow">{volume}L</span>
                  </h3>
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-brand-warm-gray tracking-wide uppercase">
                    {items.length} {items.length === 1 ? "opção" : "opções"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((produto, idx) => (
                    <ProductCard key={produto.id} produto={produto} onAdd={onAddToCart} index={idx} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

export default Catalog
