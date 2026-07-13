"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { useCart } from "@/lib/cart-context"
import { createOrder, getBookedSlots } from "@/lib/actions"
import { formatCpf } from "@/lib/cpf"
import { isAddressInDeliveryArea } from "@/lib/geo"
import AddressAutocomplete from "@/components/address-autocomplete"
import type { AddressData } from "@/components/address-autocomplete"
import { calculateLine } from "@/lib/pricing"
import { formatBRL, formatPhone } from "@/lib/format"
import { validateCheckout } from "@/lib/checkout-validation"
import { getDaysInMonth, buildYearOptions } from "@/lib/checkout-datetime"
import { EventDateTimePicker } from "@/components/checkout/event-datetime-picker"

type DeliveryConfig = {
  raioKm: number
  centroLat: number
  centroLng: number
}

type CheckoutFormProps = {
  deliveryConfig: DeliveryConfig
  exclusionZones: { lat: number; lng: number }[][]
}

const inputClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 placeholder:text-brand-warm-gray/40"

const labelClassName = "block text-sm font-medium text-brand-gray-light mb-1.5"

const CheckoutForm = ({ deliveryConfig, exclusionZones }: CheckoutFormProps) => {
  const router = useRouter()
  const { items, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const [dia, setDia] = useState("")
  const [mes, setMes] = useState("")
  const [ano, setAno] = useState(String(now.getFullYear()))
  const [hora, setHora] = useState("")
  const [minuto, setMinuto] = useState("")
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | "dinheiro">("pix")

  const [cpf, setCpf] = useState("")
  const [address, setAddress] = useState<AddressData | null>(null)
  const [complemento, setComplemento] = useState("")
  const [addressInArea, setAddressInArea] = useState<boolean | null>(null)
  const [tipoChopeira, setTipoChopeira] = useState<"gelo" | "eletrica" | "">("")
  const [temRampas, setTemRampas] = useState<"sim" | "nao" | "">("")
  const [rampasDetalhes, setRampasDetalhes] = useState("")
  const [bookedSlots, setBookedSlots] = useState<Record<number, number>>({})

  const selectedMonth = mes ? parseInt(mes) : 0
  const selectedYear = parseInt(ano)
  const maxDays = selectedMonth ? getDaysInMonth(selectedMonth, selectedYear) : 31
  const diaInvalida = dia && selectedMonth > 0 && parseInt(dia) > maxDays

  const dataEvento = dia && mes && ano && !diaInvalida
    ? `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`
    : ""
  const horarioEvento = hora && minuto !== ""
    ? `${hora.padStart(2, "0")}:${minuto.padStart(2, "0")}`
    : ""

  const lines = items.map((item) => ({ item, line: calculateLine(item.produto, item.quantidade, metodoPagamento) }))
  const total = lines.reduce((sum, { line }) => sum + line.total, 0)
  const totalSavings = lines.reduce((sum, { line }) => sum + line.savings, 0)

  const handleAddressSelect = (addr: AddressData) => {
    setAddress(addr)
    const inArea = isAddressInDeliveryArea(
      addr.lat, addr.lng,
      deliveryConfig.centroLat, deliveryConfig.centroLng,
      deliveryConfig.raioKm,
      exclusionZones
    )
    setAddressInArea(inArea)
  }

  useEffect(() => {
    if (!dataEvento) {
      setBookedSlots({})
      return
    }
    getBookedSlots(dataEvento).then(setBookedSlots).catch(() => setBookedSlots({}))
  }, [dataEvento])

  useEffect(() => {
    if (hora && (bookedSlots[parseInt(hora, 10)] ?? 0) >= 2) {
      setHora("")
      setMinuto("")
    }
  }, [bookedSlots, hora])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const validationError = validateCheckout({
      address: address ? { numero: address.numero } : null,
      addressInArea,
      dataEvento,
      horarioEvento,
      tipoChopeira,
      temRampas,
    })
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }
    // validateCheckout already requires a non-null address; re-narrow here so TS
    // knows `address` below is defined (the check itself is unreachable).
    if (!address) return

    const formData = new FormData(e.currentTarget)

    const result = await createOrder({
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: (formData.get("email") as string) || undefined,
      cpf: cpf,
      data_evento: dataEvento,
      horario_evento: horarioEvento,
      endereco_rua: address.rua,
      endereco_numero: address.numero,
      endereco_bairro: address.bairro,
      endereco_cidade: address.cidade,
      endereco_estado: address.estado,
      endereco_cep: address.cep,
      endereco_complemento: complemento || undefined,
      endereco_lat: address.lat,
      endereco_lng: address.lng,
      observacoes: (formData.get("observacoes") as string) || undefined,
      tipo_chopeira: tipoChopeira as "gelo" | "eletrica",
      rampas_escadas: temRampas === "sim" ? rampasDetalhes : undefined,
      metodo_pagamento: metodoPagamento,
      items: items.map((item) => ({
        produto_id: item.produto.id,
        quantidade: item.quantidade,
      })),
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    clearCart()
    router.push(`/pedido/${result.pedidoId}/confirmacao`)
  }

  if (items.length === 0) {
    return (
      <section className="py-20 px-4 bg-brand-dark min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4 uppercase tracking-wider">
            Carrinho vazio
          </h2>
          <p className="text-brand-warm-gray mb-8">Adicione produtos antes de finalizar o pedido.</p>
          <Link
            href="/"
            className="inline-block bg-brand-yellow text-brand-black font-medium px-8 py-3 rounded-md text-sm tracking-wide uppercase hover:bg-brand-amber transition-colors duration-200"
          >
            Ver catalogo
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 md:py-20 px-4 bg-brand-dark min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="text-brand-yellow font-medium mb-8 flex items-center gap-2 text-sm tracking-wide hover:text-brand-amber transition-colors duration-200"
        >
          <span>←</span> Voltar ao catalogo
        </Link>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-5xl font-bold text-white mb-2 uppercase tracking-wider"
        >
          Finalizar Pedido
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-gray-light mb-10"
        >
          Preencha os dados do seu evento
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-brand-surface rounded-lg p-5 mb-10 border border-white/5"
        >
          <h3 className="font-display font-bold text-white mb-4 text-lg">Resumo do pedido</h3>
          {lines.map(({ item, line }) => (
            <div key={item.produto.id} className="py-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-brand-gray-light">
                  {item.quantidade}x {item.produto.marca} {item.produto.volume_litros}L
                </span>
                <span className="font-medium text-white">{formatBRL(line.total)}</span>
              </div>
              {line.hasPromo && (
                <p className="text-[11px] text-green-400 mt-0.5">
                  1º {formatBRL(line.firstUnitPrice)} · 2º+ {formatBRL(line.extraUnitPrice)}
                </p>
              )}
            </div>
          ))}
          {totalSavings > 0 && (
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-white/10">
              <span className="text-brand-warm-gray">Promo do 2º barril</span>
              <span className="text-green-400">- {formatBRL(totalSavings)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-white/10">
            <span className="text-white">Total</span>
            <span className="font-display text-brand-yellow">{formatBRL(total)}</span>
          </div>
          <p className="text-brand-warm-gray text-xs mt-2">O frete sera calculado e informado apos a confirmacao do pedido.</p>
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
              <label htmlFor="cpf" className={labelClassName}>CPF *</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                className={inputClassName}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="telefone" className={labelClassName}>Telefone (WhatsApp) *</label>
              <input
                id="telefone"
                name="telefone"
                type="tel"
                required
                maxLength={15}
                className={inputClassName}
                placeholder="(21) 99999-9999"
                onChange={(e) => { e.target.value = formatPhone(e.target.value) }}
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClassName}>Email <span className="text-brand-warm-gray">(opcional)</span></label>
              <input
                id="email"
                name="email"
                type="email"
                className={inputClassName}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className={labelClassName}>Endereco do evento *</label>
            <AddressAutocomplete
              onAddressSelect={handleAddressSelect}
              inputClassName={inputClassName}
            />
            {addressInArea === false && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm mt-2"
              >
                Infelizmente nao atendemos essa regiao
              </motion.p>
            )}
            {addressInArea === true && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-green-400 text-sm mt-2"
              >
                Atendemos sua regiao!
              </motion.p>
            )}
          </div>

          {address && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label htmlFor="complemento" className={labelClassName}>Complemento <span className="text-brand-warm-gray">(opcional)</span></label>
                <input
                  id="complemento"
                  type="text"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  className={inputClassName}
                  placeholder="Apartamento, bloco, ponto de referencia..."
                />
              </div>
              <div>
                <label className={labelClassName}>Numero</label>
                <input
                  type="text"
                  value={address.numero}
                  readOnly
                  className={`${inputClassName} opacity-60`}
                />
              </div>
            </motion.div>
          )}

          {address && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
            >
              <label className={labelClassName}>Local possui rampas ou escadas? *</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${temRampas === "sim" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                  <input type="radio" name="rampas" value="sim" checked={temRampas === "sim"} onChange={() => setTemRampas("sim")} className="sr-only" />
                  <span className="font-medium">Sim</span>
                </label>
                <label className={`flex items-center justify-center px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${temRampas === "nao" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                  <input type="radio" name="rampas" value="nao" checked={temRampas === "nao"} onChange={() => setTemRampas("nao")} className="sr-only" />
                  <span className="font-medium">Nao</span>
                </label>
              </div>
              {temRampas === "sim" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3"
                >
                  <input
                    type="text"
                    required
                    value={rampasDetalhes}
                    onChange={(e) => setRampasDetalhes(e.target.value)}
                    className={inputClassName}
                    placeholder="Descreva (ex: 3o andar sem elevador)"
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          <EventDateTimePicker
            dia={dia} mes={mes} ano={ano} hora={hora} minuto={minuto}
            onDia={setDia} onMes={setMes} onAno={setAno}
            onHora={(v) => { setHora(v); if (minuto === "") setMinuto("0") }}
            onMinuto={setMinuto}
            maxDays={maxDays} diaInvalida={diaInvalida} selectedMonth={selectedMonth}
            yearOptions={buildYearOptions(now.getFullYear())}
            bookedSlots={bookedSlots}
          />

          <div>
            <label className={labelClassName}>Preferência de Chopeira *</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "eletrica" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="eletrica" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} className="sr-only" />
                <span className="text-xl">⚡</span>
                <span className="font-medium">Elétrica</span>
                <span className="text-xs text-brand-warm-gray text-center leading-tight">Refrigeração própria: mantém o chopp gelado sem gelo.</span>
              </label>
              <label className={`flex flex-col items-center gap-1 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${tipoChopeira === "gelo" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="tipo_chopeira" value="gelo" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} className="sr-only" />
                <span className="text-xl">🧊</span>
                <span className="font-medium">Gelo</span>
                <span className="text-xs text-brand-warm-gray text-center leading-tight">Resfriada com gelo: simples e sem energia elétrica.</span>
              </label>
            </div>
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
            <label className={labelClassName}>Forma de pagamento (pagamento na entrega) *</label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${metodoPagamento === "pix" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="metodo_pagamento" value="pix" checked={metodoPagamento === "pix"} onChange={() => setMetodoPagamento("pix")} className="sr-only" />
                Pix
              </label>
              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${metodoPagamento === "cartao" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="metodo_pagamento" value="cartao" checked={metodoPagamento === "cartao"} onChange={() => setMetodoPagamento("cartao")} className="sr-only" />
                Cartao
              </label>
              <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border text-sm cursor-pointer transition-colors duration-200 ${metodoPagamento === "dinheiro" ? "border-brand-yellow bg-brand-yellow/10 text-brand-yellow" : "border-white/10 bg-brand-surface text-brand-gray-light hover:border-white/20"}`}>
                <input type="radio" name="metodo_pagamento" value="dinheiro" checked={metodoPagamento === "dinheiro"} onChange={() => setMetodoPagamento("dinheiro")} className="sr-only" />
                Dinheiro
              </label>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-sm"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={loading || addressInArea === false || !!diaInvalida || !tipoChopeira || (!!address && !temRampas)}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-brand-yellow text-brand-black font-medium py-4 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : `Confirmar Pedido — ${formatBRL(total)}`}
          </motion.button>
        </motion.form>
      </div>
    </section>
  )
}

export default CheckoutForm
