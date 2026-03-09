"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import type { CartItem } from "@/lib/types"
import { createOrder } from "@/lib/actions"

type CheckoutFormProps = {
  items: CartItem[]
  onBack: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const inputClassName =
  "w-full px-4 py-3 rounded-md border border-gray-200 bg-white text-brand-black text-sm focus:border-brand-amber focus:ring-1 focus:ring-brand-amber outline-none transition-colors duration-200 placeholder:text-brand-warm-gray/50"

const labelClassName = "block text-sm font-medium text-brand-black mb-1.5"

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
    <section className="py-20 px-4 bg-brand-cream/30">
      <div className="max-w-2xl mx-auto">
        <motion.button
          onClick={onBack}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ opacity: 0.7 }}
          className="text-brand-amber font-medium mb-8 flex items-center gap-2 cursor-pointer text-sm tracking-wide"
        >
          <span>←</span> Voltar ao catalogo
        </motion.button>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-4xl font-bold text-brand-black mb-2"
        >
          Finalizar Pedido
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-warm-gray mb-10"
        >
          Preencha os dados do seu evento
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-white rounded-lg p-5 mb-10 border border-gray-100/80 shadow-sm"
        >
          <h3 className="font-display font-bold text-brand-black mb-4">Resumo do pedido</h3>
          {items.map((item) => (
            <div key={item.produto.id} className="flex justify-between text-sm py-1.5">
              <span className="text-brand-warm-gray">
                {item.quantidade}x {item.produto.marca} {item.produto.volume_litros}L
              </span>
              <span className="font-medium text-brand-black">
                {formatPrice(item.produto.preco_avista * item.quantidade)}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-gray-100">
            <span className="text-brand-black">Total</span>
            <span className="font-display text-brand-black">{formatPrice(total)}</span>
          </div>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nome" className={labelClassName}>Nome *</label>
              <input
                id="nome"
                name="nome"
                type="text"
                required
                className={inputClassName}
                placeholder="Seu nome completo"
              />
            </div>
            <div>
              <label htmlFor="telefone" className={labelClassName}>Telefone (WhatsApp) *</label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                required
                className={inputClassName}
                placeholder="(21) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={labelClassName}>Email (opcional)</label>
            <input
              id="email"
              name="email"
              type="email"
              className={inputClassName}
              placeholder="seu@email.com"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="data_evento" className={labelClassName}>Data do evento *</label>
              <input
                id="data_evento"
                name="data_evento"
                type="date"
                required
                className={inputClassName}
              />
            </div>
            <div>
              <label htmlFor="horario_evento" className={labelClassName}>Horario do evento *</label>
              <input
                id="horario_evento"
                name="horario_evento"
                type="time"
                required
                className={inputClassName}
              />
            </div>
          </div>

          <div>
            <label htmlFor="endereco" className={labelClassName}>Endereco completo *</label>
            <textarea
              id="endereco"
              name="endereco"
              required
              rows={3}
              className={`${inputClassName} resize-none`}
              placeholder="Rua, numero, bairro, cidade..."
            />
          </div>

          <div>
            <label htmlFor="observacoes" className={labelClassName}>Observacoes (opcional)</label>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              className={`${inputClassName} resize-none`}
              placeholder="Escadas, portao, ponto de referencia..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-black mb-3">Tipo de chopeira *</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-black">
                <input type="radio" name="tipo_chopeira" value="gelo" defaultChecked className="accent-brand-amber" />
                A gelo
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-black">
                <input type="radio" name="tipo_chopeira" value="eletrica" className="accent-brand-amber" />
                Eletrica
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-black mb-3">Forma de pagamento *</label>
            <div className="flex gap-6 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-black">
                <input type="radio" name="metodo_pagamento" value="pix" defaultChecked className="accent-brand-amber" />
                Pix
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-black">
                <input type="radio" name="metodo_pagamento" value="cartao" className="accent-brand-amber" />
                Cartao
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-black">
                <input type="radio" name="metodo_pagamento" value="dinheiro" className="accent-brand-amber" />
                Dinheiro
              </label>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-brand-dark text-white font-medium py-4 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : `Confirmar Pedido — ${formatPrice(total)}`}
          </motion.button>
        </motion.form>
      </div>
    </section>
  )
}

export default CheckoutForm
