"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Users, Clock, Beer } from "lucide-react"
import { calcularLitros, resolverCombo, type EstiloConsumo } from "./calculator-utils"

type CalculatorProps = {
  whatsappNumber?: string
}

const ESTILOS: Array<{ value: EstiloConsumo; label: string }> = [
  { value: "moderado", label: "Moderado (Família/Tarde)" },
  { value: "padrao", label: "Padrão (Churrasco/Festa)" },
  { value: "alto", label: "Alto (Balada/Open Bar)" },
]

const Calculator = ({ whatsappNumber = "5521999999999" }: CalculatorProps) => {
  const [pessoas, setPessoas] = useState(20)
  const [horas, setHoras] = useState(4)
  const [estilo, setEstilo] = useState<EstiloConsumo>("padrao")

  const litros = useMemo(() => calcularLitros(pessoas, horas, estilo), [pessoas, horas, estilo])
  const combo = useMemo(() => resolverCombo(litros), [litros])

  return (
    <section id="calculadora" className="bg-brand-dark py-16 md:py-24 px-4">
      <div className="relative max-w-6xl mx-auto bg-brand-yellow rounded-2xl p-8 md:p-12 shadow-2xl overflow-hidden">
        <Beer className="absolute -top-4 -right-4 w-40 h-40 text-brand-black/10" strokeWidth={1.2} aria-hidden="true" />

        <h2 className="font-headline text-brand-black text-3xl md:text-5xl font-black tracking-tight uppercase">
          Calculadora de Festa
        </h2>
        <p className="text-brand-black/80 text-base md:text-lg mt-3 mb-10">
          Não sabe quanto pedir? Faça uma simulação rápida para não faltar chopp.
        </p>

        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">

          <div className="space-y-6">
            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Número de pessoas (bebem chopp)
              </span>
              <div className="flex items-center gap-3 bg-brand-yellow/40 border border-brand-black/10 rounded-xl px-5 py-4">
                <Users className="w-5 h-5 text-brand-black/70 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pessoas}
                  onChange={(e) => setPessoas(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  className="w-full bg-transparent text-brand-black font-bold text-xl outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Duração da festa (horas)
              </span>
              <div className="flex items-center gap-3 bg-brand-yellow/40 border border-brand-black/10 rounded-xl px-5 py-4">
                <Clock className="w-5 h-5 text-brand-black/70 shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={horas}
                  onChange={(e) => setHoras(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  className="w-full bg-transparent text-brand-black font-bold text-xl outline-none"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-bold text-brand-black uppercase tracking-widest mb-2">
                Estilo de consumo
              </span>
              <div className="bg-brand-yellow/40 border border-brand-black/10 rounded-xl px-5 py-4">
                <select
                  value={estilo}
                  onChange={(e) => setEstilo(e.target.value as EstiloConsumo)}
                  className="w-full bg-transparent text-brand-black font-medium text-base outline-none cursor-pointer appearance-none"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0 center",
                    paddingRight: "20px",
                  }}
                >
                  {ESTILOS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="bg-brand-black text-white rounded-2xl p-8 flex flex-col justify-between min-h-[340px]">
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-white/70">Você vai precisar de aprox:</p>
              <div className="flex items-baseline justify-center gap-1 mt-4">
                <motion.span
                  key={litros}
                  initial={{ scale: 0.92, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="font-headline text-7xl md:text-8xl font-black text-brand-yellow leading-none"
                >
                  {litros}
                </motion.span>
                <span className="font-headline text-2xl md:text-3xl font-black uppercase tracking-tight text-brand-yellow leading-none">Litros</span>
              </div>
              <p className="text-xs text-white/60 mt-5 max-w-[260px] mx-auto">
                Cálculo baseado em média de consumo. Recomendamos sempre uma margem de segurança.
              </p>
              {litros > 0 && (
                <p className="text-xs text-brand-yellow/80 mt-3">
                  Sugestão: {combo.b50 > 0 ? `${combo.b50}× 50L` : ""}{combo.b50 > 0 && combo.b30 > 0 ? " + " : ""}{combo.b30 > 0 ? `${combo.b30}× 30L` : ""}
                </p>
              )}
            </div>

            <a
              href="#catalogo"
              className="mt-6 block w-full bg-brand-yellow text-brand-black font-bold uppercase tracking-widest text-sm px-4 py-4 rounded-xl text-center hover:opacity-90 transition-opacity"
            >
              Solicitar Essa Quantidade
            </a>

            {litros > 200 && (
              <p className="mt-3 text-center text-xs text-white/70">
                Eventos grandes?{" "}
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="text-brand-yellow underline">
                  Fale conosco
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
