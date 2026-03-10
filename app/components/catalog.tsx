"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Produto } from "@/lib/types"
import ProductCard from "@/components/product-card"

type CatalogProps = {
  produtos: Produto[]
  onAddToCart: (produto: Produto) => void
}

const Catalog = ({ produtos, onAddToCart }: CatalogProps) => {
  const [filter, setFilter] = useState<"todos" | "chopp" | "vinho">("todos")

  const filtered = filter === "todos"
    ? produtos
    : produtos.filter((p) => p.tipo === filter)

  return (
    <section id="catalogo" className="relative py-20 px-4 bg-brand-surface">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-yellow/60 to-transparent" />
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
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((produto, idx) => (
              <ProductCard key={produto.id} produto={produto} onAdd={onAddToCart} index={idx} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

export default Catalog
