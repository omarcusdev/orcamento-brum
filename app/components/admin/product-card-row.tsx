"use client"

import Image from "next/image"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"

type ProductCardRowProps = {
  produto: Produto
  isToggling: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductCardRow = ({ produto, isToggling, onToggle, onEdit, onDelete }: ProductCardRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: produto.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-brand-surface rounded-xl border border-white/10 p-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 flex-1">
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar"
          className="text-brand-warm-gray hover:text-white cursor-grab active:cursor-grabbing touch-none px-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9-13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
          </svg>
        </button>
        {produto.foto_url ? (
          <Image
            src={produto.foto_url}
            alt={produto.marca}
            width={44}
            height={44}
            className="w-11 h-11 rounded-lg object-cover border border-white/10 shrink-0"
            unoptimized
          />
        ) : (
          <div
            aria-label="Sem foto"
            className="w-11 h-11 rounded-lg border border-dashed border-white/15 bg-brand-dark flex items-center justify-center text-brand-warm-gray/60 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75 7.409 10.591a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{produto.marca}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              produto.volume_litros === 30
                ? "bg-cyan-500/15 text-cyan-400"
                : "bg-blue-500/15 text-blue-400"
            }`}>{produto.volume_litros}L</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              produto.tipo === "chopp"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-violet-500/15 text-violet-400"
            }`}>
              {produto.tipo}
            </span>
          </div>
          <p className="text-sm text-brand-warm-gray mt-1">
            {formatPrice(produto.preco_avista)}
            {produto.preco_cartao && ` / ${formatPrice(produto.preco_cartao)} cartao`}
            {produto.preco_segundo_barril && (
              <span className="text-green-400">
                {" · 2º "}{formatPrice(produto.preco_segundo_barril)}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`relative w-10 h-5 rounded-full transition-colors ${isToggling ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          style={{ backgroundColor: produto.ativo ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)" }}
          aria-label={produto.ativo ? "Desativar produto" : "Ativar produto"}
        >
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`absolute top-0.5 w-4 h-4 rounded-full ${isToggling ? "animate-pulse" : ""}`}
            style={{
              left: produto.ativo ? "calc(100% - 18px)" : "2px",
              backgroundColor: produto.ativo ? "#22c55e" : "#8A8278",
            }}
          />
        </button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
          className="px-3 py-1.5 rounded-lg border border-white/10 text-brand-gray-light hover:border-brand-yellow/40 hover:text-white text-xs font-medium cursor-pointer transition"
        >
          Editar
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onDelete}
          aria-label="Excluir produto"
          className="p-1.5 rounded-lg border border-white/10 text-red-400/70 hover:text-red-300 hover:border-red-500/30 cursor-pointer transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

export default ProductCardRow
