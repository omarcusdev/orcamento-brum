"use client"

import { useState } from "react"
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
    <section id="catalogo" className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-brand-black text-center mb-2">
          Nossos Chopps
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Escolha seus chopps e monte seu pedido
        </p>
        <div className="flex justify-center gap-2 mb-8">
          {(["todos", "chopp", "vinho"] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFilter(tipo)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer ${
                filter === tipo
                  ? "bg-brand-yellow text-brand-black"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-brand-yellow"
              }`}
            >
              {tipo === "todos" ? "Todos" : tipo === "chopp" ? "Chopp" : "Vinho"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((produto) => (
            <ProductCard key={produto.id} produto={produto} onAdd={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Catalog
