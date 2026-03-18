"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { useCart } from "@/lib/cart-context"
import { createOrder, uploadDocument } from "@/lib/actions"
import { formatCpf } from "@/lib/cpf"
import { isAddressInDeliveryArea } from "@/lib/geo"
import AddressAutocomplete from "@/components/address-autocomplete"
import type { AddressData } from "@/components/address-autocomplete"
import DocumentUpload from "@/components/document-upload"

type DeliveryConfig = {
  raioKm: number
  centroLat: number
  centroLng: number
}

type CheckoutFormProps = {
  deliveryConfig: DeliveryConfig
  exclusionZones: { lat: number; lng: number }[][]
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const inputClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 placeholder:text-brand-warm-gray/40"

const labelClassName = "block text-sm font-medium text-brand-gray-light mb-1.5"

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ""
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const selectClassName =
  "w-full px-4 py-3 rounded-md border border-white/10 bg-brand-surface text-white text-sm focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none transition-colors duration-200 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23B5AFA6%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat"

const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const buildDayOptions = (month: number, year: number) => {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => i + 1)
}

const buildYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear + 1]
}

const HORAS = Array.from({ length: 15 }, (_, i) => i + 8)
const MINUTOS = [0, 15, 30, 45]

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
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [clientVerified, setClientVerified] = useState(false)
  const [addressInArea, setAddressInArea] = useState<boolean | null>(null)

  const selectedMonth = mes ? parseInt(mes) : now.getMonth() + 1
  const selectedYear = parseInt(ano)
  const dayOptions = buildDayOptions(selectedMonth, selectedYear)

  const dataEvento = dia && mes && ano
    ? `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`
    : ""
  const horarioEvento = hora && minuto !== ""
    ? `${hora.padStart(2, "0")}:${minuto.padStart(2, "0")}`
    : ""

  const total = items.reduce((sum, item) => {
    const price = (metodoPagamento === "cartao" && item.produto.preco_cartao) ? item.produto.preco_cartao : item.produto.preco_avista
    return sum + price * item.quantidade
  }, 0)

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

  const checkExistingClient = async (cpfValue: string) => {
    const digits = cpfValue.replace(/\D/g, "")
    if (digits.length !== 11) return
    try {
      const res = await fetch(`/api/client-check?cpf=${digits}`)
      const data = await res.json()
      setClientVerified(data.verified ?? false)
    } catch { /* ignore */ }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!address) {
      setError("Selecione um endereco valido")
      setLoading(false)
      return
    }

    if (addressInArea === false) {
      setError("Infelizmente nao atendemos essa regiao")
      setLoading(false)
      return
    }

    const eventDate = new Date(dataEvento + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (eventDate < today) {
      setError("A data do evento nao pode ser no passado")
      setLoading(false)
      return
    }

    const formData = new FormData(e.currentTarget)

    try {
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
        tipo_chopeira: "gelo" as const,
        metodo_pagamento: metodoPagamento,
        items: items.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
        })),
      })

      if (documentFile && !clientVerified) {
        const docFormData = new FormData()
        docFormData.set("clienteId", result.clienteId)
        docFormData.set("documento", documentFile)
        await uploadDocument(docFormData)
      }

      clearCart()
      router.push(`/pedido/${result.pedidoId}/confirmacao`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pedido.")
      setLoading(false)
    }
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
          {items.map((item) => (
            <div key={item.produto.id} className="flex justify-between text-sm py-1.5">
              <span className="text-brand-gray-light">
                {item.quantidade}x {item.produto.marca} {item.produto.volume_litros}L
              </span>
              <span className="font-medium text-white">
                {formatPrice(((metodoPagamento === "cartao" && item.produto.preco_cartao) ? item.produto.preco_cartao : item.produto.preco_avista) * item.quantidade)}
              </span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t border-white/10">
            <span className="text-white">Total</span>
            <span className="font-display text-brand-yellow">{formatPrice(total)}</span>
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
              <label htmlFor="cpf" className={labelClassName}>CPF *</label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                onBlur={() => checkExistingClient(cpf)}
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

          <div>
            <label className={labelClassName}>Data do evento *</label>
            <div className="grid grid-cols-3 gap-3">
              <select
                required
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className={selectClassName}
              >
                <option value="" disabled>Dia</option>
                {dayOptions.map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
              <select
                required
                value={mes}
                onChange={(e) => { setMes(e.target.value); setDia("") }}
                className={selectClassName}
              >
                <option value="" disabled>Mes</option>
                {MESES.map((nome, idx) => (
                  <option key={nome} value={String(idx + 1)}>{nome}</option>
                ))}
              </select>
              <select
                required
                value={ano}
                onChange={(e) => { setAno(e.target.value); setDia("") }}
                className={selectClassName}
              >
                {buildYearOptions().map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClassName}>Horario do evento *</label>
            <div className="grid grid-cols-2 gap-3">
              <select
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={selectClassName}
              >
                <option value="" disabled>Hora</option>
                {HORAS.map((h) => (
                  <option key={h} value={String(h)}>{String(h).padStart(2, "0")}h</option>
                ))}
              </select>
              <select
                required
                value={minuto}
                onChange={(e) => setMinuto(e.target.value)}
                className={selectClassName}
              >
                <option value="" disabled>Minuto</option>
                {MINUTOS.map((m) => (
                  <option key={m} value={String(m)}>{String(m).padStart(2, "0")}min</option>
                ))}
              </select>
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
            <label className={labelClassName}>Documento de identidade (RG ou CNH) *</label>
            <DocumentUpload
              onFileSelect={setDocumentFile}
              verified={clientVerified}
            />
          </div>

          <div>
            <label className={labelClassName}>Forma de pagamento *</label>
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
            disabled={loading || addressInArea === false}
            whileHover={{ opacity: 0.85 }}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-brand-yellow text-brand-black font-medium py-4 rounded-md text-sm tracking-wide uppercase cursor-pointer transition-colors duration-200 hover:bg-brand-amber disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enviando..." : `Confirmar Pedido — ${formatPrice(total)}`}
          </motion.button>
        </motion.form>
      </div>
    </section>
  )
}

export default CheckoutForm
