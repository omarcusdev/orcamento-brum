"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"

type ProductCardProps = {
  produto: Produto
  onAdd: (produto: Produto) => void
  index?: number
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductCard = ({ produto, onAdd, index = 0 }: ProductCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.08, ease: "easeOut" }}
    whileHover={{ y: -4, transition: { duration: 0.25 } }}
    className="bg-white rounded-lg overflow-hidden border border-gray-100/80 flex flex-col shadow-sm hover:shadow-lg transition-shadow duration-300"
  >
    {produto.foto_url ? (
      <div className="relative h-44 bg-brand-cream">
        <Image src={produto.foto_url} alt={produto.marca} fill className="object-cover" />
      </div>
    ) : (
      <div className="h-44 bg-gradient-to-br from-brand-yellow/15 to-brand-cream flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-brand-yellow/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-amber">
            <path d="M17 8h1a4 4 0 110 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM6 2v4M10 2v4M14 2v4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    )}
    <div className="p-5 flex flex-col flex-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-brand-yellow/15 text-brand-gold tracking-wide uppercase">
          {produto.volume_litros}L
        </span>
        {produto.tipo === "vinho" && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600 tracking-wide uppercase">
            Vinho
          </span>
        )}
      </div>
      <h3 className="font-display font-bold text-brand-black text-xl mb-1">{produto.marca}</h3>
      <p className="text-sm text-brand-warm-gray mb-4">Barril {produto.volume_litros}L com chopeira</p>
      <div className="mt-auto">
        <p className="font-display text-2xl font-bold text-brand-black">{formatPrice(produto.preco_avista)}</p>
        <p className="text-xs text-brand-warm-gray mt-0.5">no pix/dinheiro</p>
      </div>
      <motion.button
        onClick={() => onAdd(produto)}
        whileHover={{ opacity: 0.85 }}
        whileTap={{ scale: 0.97 }}
        className="mt-4 w-full bg-brand-dark text-white font-medium py-3 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-black"
      >
        Adicionar
      </motion.button>
    </div>
  </motion.div>
)

export default ProductCard
