"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { CartItem } from "@/lib/types"
import { createOrder } from "@/lib/actions"

type CheckoutFormProps = {
  items: CartItem[]
  onBack: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const CheckoutForm = ({ items, onBack }: CheckoutFormProps) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = items.reduce((sum, item) => sum + item.produto.preco_avista * item.quantidade, 0)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    try {
      const result = await createOrder({
        nome: formData.get("nome") as string,
        telefone: formData.get("telefone") as string,
        email: (formData.get("email") as string) || undefined,
        data_evento: formData.get("data_evento") as string,
        horario_evento: formData.get("horario_evento") as string,
        endereco: formData.get("endereco") as string,
        observacoes: (formData.get("observacoes") as string) || undefined,
        tipo_chopeira: formData.get("tipo_chopeira") as "gelo" | "eletrica",
        metodo_pagamento: formData.get("metodo_pagamento") as "pix" | "cartao" | "dinheiro",
        items: items.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          preco_unitario: item.produto.preco_avista,
        })),
      })

      router.push(`/pedido/${result.pedidoId}/confirmacao`)
    } catch {
      setError("Erro ao enviar pedido. Tente novamente.")
      setLoading(false)
    }
  }

  return (
    <section className="py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="text-brand-yellow font-medium mb-6 flex items-center gap-1 cursor-pointer hover:underline"
        >
          ← Voltar ao catalogo
        </button>

        <h2 className="text-3xl font-bold text-brand-black mb-2">Finalizar Pedido</h2>
        <p className="text-gray-500 mb-8">Preencha os dados do seu evento</p>

        <div className="bg-gray-50 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-brand-black mb-3">Resumo do pedido</h3>
          {items.map((item) => (
            <div key={item.produto.id} className="flex justify-between text-sm py-1">
              <span className="text-gray-600">
                {item.quantidade}x {item.produto.marca} {item.produto.volume_litros}L
              </span>
              <span className="font-medium">
                {formatPrice(item.produto.preco_avista * item.quantidade)}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-lg mt-3 pt-3 border-t border-gray-200">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none"
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <label htmlFor="telefone" className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp) *</label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none"
                placeholder="(21) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email (opcional)</label>
            <input
              id="email"
              name="email"
              type="email"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none"
              placeholder="seu@email.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="data_evento" className="block text-sm font-medium text-gray-700 mb-1">Data do evento *</label>
              <input
                id="data_evento"
                name="data_evento"
                type="date"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none"
              />
            </div>
            <div>
              <label htmlFor="horario_evento" className="block text-sm font-medium text-gray-700 mb-1">Horario do evento *</label>
              <input
                id="horario_evento"
                name="horario_evento"
                type="time"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="endereco" className="block text-sm font-medium text-gray-700 mb-1">Endereco completo *</label>
            <textarea
              id="endereco"
              name="endereco"
              required
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none resize-none"
              placeholder="Rua, numero, bairro, cidade..."
            />
          </div>

          <div>
            <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 mb-1">Observacoes (opcional)</label>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none resize-none"
              placeholder="Escadas, portao, ponto de referencia..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de chopeira *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipo_chopeira" value="gelo" defaultChecked className="accent-brand-yellow" />
                <span>A gelo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tipo_chopeira" value="eletrica" className="accent-brand-yellow" />
                <span>Eletrica</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pagamento *</label>
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="metodo_pagamento" value="pix" defaultChecked className="accent-brand-yellow" />
                <span>Pix</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="metodo_pagamento" value="cartao" className="accent-brand-yellow" />
                <span>Cartao</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="metodo_pagamento" value="dinheiro" className="accent-brand-yellow" />
                <span>Dinheiro</span>
              </label>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-yellow text-brand-black font-bold py-4 rounded-lg text-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : `Confirmar Pedido — ${formatPrice(total)}`}
          </button>
        </form>
      </div>
    </section>
  )
}

export default CheckoutForm
