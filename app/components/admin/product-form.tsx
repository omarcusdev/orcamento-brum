"use client"

import { useState } from "react"
import type { Produto } from "@/lib/types"
import { createProduct, updateProduct } from "@/lib/admin-actions"

type ProductFormProps = {
  produto?: Produto
  onClose: () => void
}

const ProductForm = ({ produto, onClose }: ProductFormProps) => {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    if (produto) {
      await updateProduct(produto.id, formData)
    } else {
      await createProduct(formData)
    }

    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h3 className="font-bold text-lg text-brand-black mb-4">
          {produto ? "Editar Produto" : "Novo Produto"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="marca" className="block text-sm font-medium text-gray-700 mb-1">Marca *</label>
            <input
              id="marca"
              name="marca"
              type="text"
              required
              defaultValue={produto?.marca}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm"
            />
          </div>
          <div>
            <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
            <input
              id="descricao"
              name="descricao"
              type="text"
              defaultValue={produto?.descricao ?? ""}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="volume_litros" className="block text-sm font-medium text-gray-700 mb-1">Volume (L) *</label>
              <select
                id="volume_litros"
                name="volume_litros"
                required
                defaultValue={produto?.volume_litros ?? 50}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow outline-none text-sm"
              >
                <option value={30}>30L</option>
                <option value={50}>50L</option>
              </select>
            </div>
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                id="tipo"
                name="tipo"
                required
                defaultValue={produto?.tipo ?? "chopp"}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow outline-none text-sm"
              >
                <option value="chopp">Chopp</option>
                <option value="vinho">Vinho</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="preco_avista" className="block text-sm font-medium text-gray-700 mb-1">Preco a vista *</label>
              <input
                id="preco_avista"
                name="preco_avista"
                type="number"
                step="0.01"
                required
                defaultValue={produto?.preco_avista}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="preco_cartao" className="block text-sm font-medium text-gray-700 mb-1">Preco cartao</label>
              <input
                id="preco_cartao"
                name="preco_cartao"
                type="number"
                step="0.01"
                defaultValue={produto?.preco_cartao ?? ""}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductForm
