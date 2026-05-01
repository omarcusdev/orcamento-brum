"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useCart } from "@/lib/cart-context"
import type { Produto } from "@/lib/types"
import { calcularLitros, resolverCombo, type EstiloConsumo } from "./calculator-utils"

type CalculatorProps = {
  produtos: Produto[]
  whatsappNumber?: string
}

const ESTILOS: Array<{ value: EstiloConsumo; label: string }> = [
  { value: "moderado", label: "Moderado (Família/Tarde)" },
  { value: "padrao", label: "Padrão (Churrasco/Festa)" },
  { value: "alto", label: "Alto (Balada/Open Bar)" },
]

const findChopp = (produtos: Produto[], volume: 30 | 50): Produto | null => {
  const chopps = produtos.filter((p) => p.tipo === "chopp" && p.ativo && p.volume_litros === volume)
  if (chopps.length === 0) return null
  const pilsen = chopps.find((p) => p.marca.toLowerCase().includes("pilsen"))
  return pilsen ?? chopps[0]
}

const Calculator = ({ produtos, whatsappNumber = "5521999999999" }: CalculatorProps) => {
  const [pessoas, setPessoas] = useState(20)
  const [horas, setHoras] = useState(4)
  const [estilo, setEstilo] = useState<EstiloConsumo>("padrao")
  const [feedback, setFeedback] = useState<string | null>(null)
  const { addToCart } = useCart()

  const litros = useMemo(() => calcularLitros(pessoas, horas, estilo), [pessoas, horas, estilo])
  const combo = useMemo(() => resolverCombo(litros), [litros])
  const podeAdicionar = litros > 0

  const handleAdd = () => {
    setFeedback(null)
    if (!podeAdicionar) return
    const produto50 = combo.b50 > 0 ? findChopp(produtos, 50) : null
    const produto30 = combo.b30 > 0 ? findChopp(produtos, 30) : null
    if ((combo.b50 > 0 && !produto50) || (combo.b30 > 0 && !produto30)) {
      setFeedback("Algum barril desse tamanho não está disponível agora — fale conosco no WhatsApp.")
      return
    }
    if (produto50 && combo.b50 > 0) addToCart(produto50, combo.b50)
    if (produto30 && combo.b30 > 0) addToCart(produto30, combo.b30)
    const marca = (produto50 ?? produto30)?.marca ?? "chopp"
    setFeedback(`Adicionamos ${combo.b50 > 0 ? `${combo.b50}× 50L` : ""}${combo.b50 > 0 && combo.b30 > 0 ? " + " : ""}${combo.b30 > 0 ? `${combo.b30}× 30L` : ""} de ${marca} ao carrinho. Você pode trocar a marca antes de finalizar.`)
  }

  return (
    <section id="calculadora" className="bg-brand-dark py-16 md:py-24 px-4">
      <div className="max-w-5xl mx-auto bg-brand-yellow rounded-xl p-6 md:p-10 shadow-2xl">
        <h2 className="font-display text-brand-black text-3xl md:text-4xl font-bold tracking-tight uppercase">
          Calculadora de Festa
        </h2>
        <p className="text-brand-black/80 text-sm md:text-base mt-2 mb-8">
          Não sabe quanto pedir? Faça uma simulação rápida para não faltar chopp.
        </p>

        <div className="grid md:grid-cols-2 gap-6 md:gap-10">

          <div className="space-y-5">
            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Número de pessoas (bebem chopp)
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pessoas}
                onChange={(e) => setPessoas(Number(e.target.value.replace(/\D/g, "")) || 0)}
                className="w-full bg-white text-brand-black font-bold text-lg px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Duração da festa (horas)
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={horas}
                onChange={(e) => setHoras(Number(e.target.value.replace(/\D/g, "")) || 0)}
                className="w-full bg-white text-brand-black font-bold text-lg px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Estilo de consumo
              </span>
              <select
                value={estilo}
                onChange={(e) => setEstilo(e.target.value as EstiloConsumo)}
                className="w-full bg-white text-brand-black font-bold text-base px-4 py-3 rounded-md border-2 border-brand-black/15 focus:border-brand-black outline-none cursor-pointer"
              >
                {ESTILOS.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="bg-brand-black text-white rounded-md p-6 flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/60">Você vai precisar de aprox.</p>
              <div className="flex items-baseline gap-2 mt-2">
                <motion.span
                  key={litros}
                  initial={{ scale: 0.92, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="font-display text-7xl font-bold text-brand-yellow"
                >
                  {litros}
                </motion.span>
                <span className="font-display text-xl uppercase tracking-widest">Litros</span>
              </div>
              <p className="text-xs text-white/50 mt-3">
                Cálculo aproximado. Recomendamos sempre uma margem de segurança.
              </p>
              {litros > 0 && (
                <p className="text-xs text-brand-yellow/80 mt-2">
                  Combo sugerido: {combo.b50 > 0 ? `${combo.b50}× 50L` : ""}{combo.b50 > 0 && combo.b30 > 0 ? " + " : ""}{combo.b30 > 0 ? `${combo.b30}× 30L` : ""} ({combo.total}L total)
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={!podeAdicionar}
              className="mt-5 w-full bg-brand-yellow text-brand-black font-bold uppercase tracking-widest text-sm px-4 py-3.5 rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Solicitar Essa Quantidade
            </button>

            {feedback && (
              <p className="mt-3 text-xs text-white/80">{feedback}</p>
            )}

            {litros > 200 && (
              <p className="mt-3 text-xs text-white/70">
                Eventos grandes?{" "}
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">
                  Fale conosco para preço especial
                </a>.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Calculator
