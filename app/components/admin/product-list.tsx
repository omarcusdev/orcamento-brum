"use client"

import { useState } from "react"
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

  const handleToggle = async (id: string, currentActive: boolean) => {
    await toggleProductActive(id, !currentActive)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-brand-black">Catalogo</h1>
        <button
          onClick={() => { setEditingProduct(undefined); setShowForm(true) }}
          className="bg-brand-yellow text-brand-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition cursor-pointer"
        >
          + Novo Produto
        </button>
      </div>
      <div className="space-y-3">
        {produtos.map((produto) => (
          <div key={produto.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-brand-black">{produto.marca}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{produto.volume_litros}L</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{produto.tipo}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formatPrice(produto.preco_avista)}
                {produto.preco_cartao && ` / ${formatPrice(produto.preco_cartao)} cartao`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggle(produto.id, produto.ativo)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${
                  produto.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                }`}
              >
                {produto.ativo ? "Ativo" : "Inativo"}
              </button>
              <button
                onClick={() => { setEditingProduct(produto); setShowForm(true) }}
                className="text-gray-400 hover:text-brand-black text-sm cursor-pointer"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>
      {showForm && (
        <ProductForm produto={editingProduct} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

export default ProductList
