"use client"

import Image from "next/image"
import type { Produto } from "@/lib/types"

type ProductCardProps = {
  produto: Produto
  onAdd: (produto: Produto) => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductCard = ({ produto, onAdd }: ProductCardProps) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col">
    {produto.foto_url ? (
      <div className="relative h-48 bg-gray-100">
        <Image src={produto.foto_url} alt={produto.marca} fill className="object-cover" />
      </div>
    ) : (
      <div className="h-48 bg-gradient-to-br from-brand-yellow/20 to-brand-yellow/5 flex items-center justify-center">
        <span className="text-5xl">🍺</span>
      </div>
    )}
    <div className="p-4 flex flex-col flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-yellow/20 text-brand-black">
          {produto.volume_litros}L
        </span>
        {produto.tipo === "vinho" && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            Vinho
          </span>
        )}
      </div>
      <h3 className="font-bold text-brand-black text-lg">{produto.marca}</h3>
      <p className="text-sm text-gray-500 mb-3">Barril {produto.volume_litros}L com chopeira</p>
      <div className="mt-auto">
        <p className="text-2xl font-bold text-brand-black">{formatPrice(produto.preco_avista)}</p>
        <p className="text-xs text-gray-400">no pix/dinheiro</p>
      </div>
      <button
        onClick={() => onAdd(produto)}
        className="mt-3 w-full bg-brand-yellow text-brand-black font-semibold py-3 rounded-lg hover:brightness-110 transition cursor-pointer"
      >
        Adicionar
      </button>
    </div>
  </div>
)

export default ProductCard
