"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { Produto } from "@/lib/types"
import { toggleProductActive } from "@/lib/admin-actions"
import ProductForm from "@/components/admin/product-form"

type ProductListProps = {
  produtos: Produto[]
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductList = ({ produtos }: ProductListProps) => {
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Produto | undefined>()
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  const handleToggle = async (id: string, currentActive: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(id))
    await toggleProductActive(id, !currentActive)
    setTogglingIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex justify-between items-center mb-6"
      >
        <h1 className="font-display text-3xl font-bold text-white tracking-wide">CATALOGO</h1>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setEditingProduct(undefined); setShowForm(true) }}
          className="bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition cursor-pointer"
        >
          + Novo Produto
        </motion.button>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brand-yellow/5 border border-brand-yellow/10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-brand-yellow shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-brand-yellow/80">Desativar um produto remove ele do catalogo visivel para os clientes.</p>
      </motion.div>
      <div className="space-y-3">
        {produtos.map((produto, index) => {
          const isToggling = togglingIds.has(produto.id)
          return (
          <motion.div
            key={produto.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
            whileHover={{ y: -2 }}
            className="bg-brand-surface rounded-xl border border-white/10 p-4 flex items-center justify-between"
          >
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
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggle(produto.id, produto.ativo)}
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
                onClick={() => { setEditingProduct(produto); setShowForm(true) }}
                className="px-3 py-1.5 rounded-lg border border-white/10 text-brand-gray-light hover:border-brand-yellow/40 hover:text-white text-xs font-medium cursor-pointer transition"
              >
                Editar
              </motion.button>
            </div>
          </motion.div>
          )
        })}
      </div>
      <AnimatePresence>
        {showForm && (
          <ProductForm produto={editingProduct} onClose={() => setShowForm(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProductList
