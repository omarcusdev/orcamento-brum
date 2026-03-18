"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { createProduct, updateProduct, uploadProductImage } from "@/lib/admin-actions"
import ImageUpload from "@/components/admin/image-upload"

type ProductFormProps = {
  produto?: Produto
  onClose: () => void
}

const ProductForm = ({ produto, onClose }: ProductFormProps) => {
  const [loading, setLoading] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    if (produto) {
      await updateProduct(produto.id, formData)
      if (imageFile) {
        const imgFormData = new FormData()
        imgFormData.set("foto", imageFile)
        await uploadProductImage(produto.id, imgFormData)
      }
    } else {
      const result = await createProduct(formData)
      if (imageFile && result?.id) {
        const imgFormData = new FormData()
        imgFormData.set("foto", imageFile)
        await uploadProductImage(result.id, imgFormData)
      }
    }

    setLoading(false)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="bg-brand-surface rounded-2xl max-w-md w-full p-6 border border-white/10"
      >
        <h3 className="font-display text-xl font-bold text-white tracking-wide mb-4">
          {produto ? "EDITAR PRODUTO" : "NOVO PRODUTO"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="marca" className="block text-sm font-medium text-brand-gray-light mb-1">Marca *</label>
            <input
              id="marca"
              name="marca"
              type="text"
              required
              defaultValue={produto?.marca}
              className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
            />
          </div>
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-brand-gray-light mb-1">Descricao</label>
            <input
              id="descricao"
              name="descricao"
              type="text"
              defaultValue={produto?.descricao ?? ""}
              className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="volume_litros" className="block text-sm font-medium text-brand-gray-light mb-1">Volume (L) *</label>
              <select
                id="volume_litros"
                name="volume_litros"
                required
                defaultValue={produto?.volume_litros ?? 50}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow outline-none text-sm text-white"
              >
                <option value={30}>30L</option>
                <option value={50}>50L</option>
              </select>
            </div>
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-brand-gray-light mb-1">Tipo *</label>
              <select
                id="tipo"
                name="tipo"
                required
                defaultValue={produto?.tipo ?? "chopp"}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow outline-none text-sm text-white"
              >
                <option value="chopp">Chopp</option>
                <option value="vinho">Vinho</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-gray-light mb-1">Foto do produto</label>
            <ImageUpload currentUrl={produto?.foto_url} onFileSelect={setImageFile} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="preco_avista" className="block text-sm font-medium text-brand-gray-light mb-1">Preco a vista *</label>
              <input
                id="preco_avista"
                name="preco_avista"
                type="number"
                step="0.01"
                required
                defaultValue={produto?.preco_avista}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
              />
            </div>
            <div>
              <label htmlFor="preco_cartao" className="block text-sm font-medium text-brand-gray-light mb-1">Preco cartao</label>
              <input
                id="preco_cartao"
                name="preco_cartao"
                type="number"
                step="0.01"
                defaultValue={produto?.preco_cartao ?? ""}
                className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.97 }}
              className="flex-1 border border-white/10 text-brand-gray-light font-medium py-2.5 rounded-lg hover:bg-white/5 transition cursor-pointer"
            >
              Cancelar
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

export default ProductForm
