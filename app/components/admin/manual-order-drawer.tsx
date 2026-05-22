"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createManualOrder, searchClientes } from "@/lib/admin-actions"
import type { Produto } from "@/lib/types"
import type { ManualOrderInput } from "@/lib/schemas"
import { calculateOrderTotals } from "@/lib/pricing"

type ClienteResult = {
  id: string
  nome: string
  telefone: string
  cpf: string | null
  email: string | null
  documento_verificado: boolean | null
}

type DraftItem = {
  produto_id: string
  quantidade: number
  is_consignado: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  produtos: Produto[]
}

const inputClass = "w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-warm-gray focus:border-brand-yellow/40 focus:outline-none"

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const computeLineSubtotal = (produto: Produto | undefined, item: DraftItem, metodo: "pix" | "cartao" | "dinheiro") => {
  if (!produto) return { subtotal: 0, firstUnitPrice: 0, secondUnitPrice: 0, unitPrice: 0 }
  const firstUnitPrice = metodo === "cartao" && produto.preco_cartao
    ? Number(produto.preco_cartao)
    : Number(produto.preco_avista)
  const secondUnitPrice = produto.preco_segundo_barril != null
    ? Number(produto.preco_segundo_barril)
    : firstUnitPrice
  const qty = Math.max(0, item.quantidade)
  const subtotal = qty === 0
    ? 0
    : qty === 1
      ? firstUnitPrice
      : firstUnitPrice + secondUnitPrice * (qty - 1)
  return { subtotal, firstUnitPrice, secondUnitPrice, unitPrice: firstUnitPrice }
}

const ManualOrderDrawer = ({ open, onClose, produtos }: Props) => {
  const [clienteMode, setClienteMode] = useState<"search" | "new">("search")
  const [clienteQuery, setClienteQuery] = useState("")
  const [clienteResults, setClienteResults] = useState<ClienteResult[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null)
  const [newCliente, setNewCliente] = useState({ nome: "", telefone: "", cpf: "", email: "" })

  const [enderecoText, setEnderecoText] = useState("")
  const [dataEvento, setDataEvento] = useState("")
  const [horarioEvento, setHorarioEvento] = useState("")
  const [tipoChopeira, setTipoChopeira] = useState<"gelo" | "eletrica">("gelo")
  const [rampasEscadas, setRampasEscadas] = useState("")
  const [observacoes, setObservacoes] = useState("")

  const [items, setItems] = useState<DraftItem[]>([])
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | "dinheiro">("pix")
  const [pago, setPago] = useState(false)
  const [frete, setFrete] = useState(0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (clienteQuery.trim().length < 2) {
      setClienteResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchClientes(clienteQuery)
        setClienteResults(results as ClienteResult[])
      } catch {
        setClienteResults([])
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [clienteQuery, open])

  const resetForm = () => {
    setClienteMode("search")
    setClienteQuery("")
    setClienteResults([])
    setSelectedCliente(null)
    setNewCliente({ nome: "", telefone: "", cpf: "", email: "" })
    setEnderecoText("")
    setDataEvento("")
    setHorarioEvento("")
    setTipoChopeira("gelo")
    setRampasEscadas("")
    setObservacoes("")
    setItems([])
    setMetodoPagamento("pix")
    setPago(false)
    setFrete(0)
    setError(null)
  }

  const handleClose = () => {
    if (submitting) return
    resetForm()
    onClose()
  }

  const addItem = () => {
    if (produtos.length === 0) return
    setItems((prev) => [...prev, { produto_id: produtos[0].id, quantidade: 1, is_consignado: false }])
  }

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const next = { ...item, ...patch }
      if (next.quantidade < 1) next.quantidade = 1
      return next
    }))
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const hasConsignado = items.some((i) => i.is_consignado)

  const itemRowsForTotals = items.flatMap((item) => {
    const produto = produtos.find((p) => p.id === item.produto_id)
    if (!produto) return []
    const firstUnitPrice = metodoPagamento === "cartao" && produto.preco_cartao
      ? Number(produto.preco_cartao)
      : Number(produto.preco_avista)
    const secondUnitPrice = produto.preco_segundo_barril != null ? Number(produto.preco_segundo_barril) : firstUnitPrice
    const qty = Math.max(0, item.quantidade)

    if (item.is_consignado) {
      return Array.from({ length: qty }, (_, i) => ({
        subtotal: i === 0 ? firstUnitPrice : secondUnitPrice,
        is_consignado: true,
        consignado_status: "pendente" as string | null,
      }))
    }
    const subtotal = qty === 0 ? 0 : qty === 1 ? firstUnitPrice : firstUnitPrice + secondUnitPrice * (qty - 1)
    return [{ subtotal, is_consignado: false, consignado_status: null as string | null }]
  })

  const totals = calculateOrderTotals(itemRowsForTotals)
  const totalMin = totals.subtotalMin + frete
  const totalMax = totals.subtotalMax + frete

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    items.every((i) => i.quantidade >= 1) &&
    !!enderecoText &&
    !!dataEvento &&
    !!horarioEvento &&
    ((clienteMode === "search" && !!selectedCliente) ||
      (clienteMode === "new" && newCliente.nome.length >= 2 && newCliente.telefone.length >= 10))

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const cliente: ManualOrderInput["cliente"] = clienteMode === "search" && selectedCliente
        ? { kind: "existing", id: selectedCliente.id }
        : {
            kind: "new",
            nome: newCliente.nome,
            telefone: newCliente.telefone,
            cpf: newCliente.cpf || null,
            email: newCliente.email || null,
          }

      const input: ManualOrderInput = {
        cliente,
        endereco: enderecoText,
        endereco_completo: null,
        data_evento: dataEvento,
        horario_evento: horarioEvento,
        tipo_chopeira: tipoChopeira,
        rampas_escadas: rampasEscadas || null,
        observacoes: observacoes || null,
        items,
        metodo_pagamento: metodoPagamento,
        pago,
        frete,
      }

      await createManualOrder(input)
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-brand-surface border-l border-white/10 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white tracking-wide">NOVO PEDIDO MANUAL</h2>
                <button onClick={handleClose} disabled={submitting} className="text-brand-warm-gray hover:text-white text-2xl leading-none disabled:opacity-50">×</button>
              </div>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Cliente</h3>
                <div className="flex gap-2 mb-3 text-xs">
                  <button onClick={() => setClienteMode("search")} className={`px-3 py-1.5 rounded ${clienteMode === "search" ? "bg-brand-yellow text-brand-black font-semibold" : "border border-white/10 text-brand-warm-gray"}`}>Buscar existente</button>
                  <button onClick={() => setClienteMode("new")} className={`px-3 py-1.5 rounded ${clienteMode === "new" ? "bg-brand-yellow text-brand-black font-semibold" : "border border-white/10 text-brand-warm-gray"}`}>Criar novo</button>
                </div>

                {clienteMode === "search" && (
                  <div className="space-y-2">
                    <input
                      value={clienteQuery}
                      onChange={(e) => { setClienteQuery(e.target.value); setSelectedCliente(null) }}
                      placeholder="Buscar por nome, telefone ou CPF"
                      className={inputClass}
                    />
                    {selectedCliente ? (
                      <div className="bg-brand-dark border border-brand-yellow/30 rounded-lg p-3 text-sm flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{selectedCliente.nome}</p>
                          <p className="text-brand-warm-gray text-xs">{selectedCliente.telefone} {selectedCliente.cpf ? `· ${selectedCliente.cpf}` : ""}</p>
                        </div>
                        <button onClick={() => { setSelectedCliente(null); setClienteQuery("") }} className="text-xs text-brand-yellow underline">Trocar</button>
                      </div>
                    ) : clienteResults.length > 0 ? (
                      <ul className="bg-brand-dark border border-white/10 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {clienteResults.map((c) => (
                          <li key={c.id}>
                            <button onClick={() => { setSelectedCliente(c); setClienteResults([]) }} className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm">
                              <p className="text-white">{c.nome}</p>
                              <p className="text-brand-warm-gray text-xs">{c.telefone} {c.cpf ? `· ${c.cpf}` : ""}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : clienteQuery.length >= 2 ? (
                      <p className="text-xs text-brand-warm-gray">Nenhum cliente encontrado. Use "Criar novo".</p>
                    ) : null}
                  </div>
                )}

                {clienteMode === "new" && (
                  <div className="space-y-2">
                    <input placeholder="Nome*" value={newCliente.nome} onChange={(e) => setNewCliente({ ...newCliente, nome: e.target.value })} className={inputClass} />
                    <input placeholder="Telefone* (ex: 21 99999-9999)" value={newCliente.telefone} onChange={(e) => setNewCliente({ ...newCliente, telefone: e.target.value })} className={inputClass} />
                    <input placeholder="CPF (opcional)" value={newCliente.cpf} onChange={(e) => setNewCliente({ ...newCliente, cpf: e.target.value })} className={inputClass} />
                    <input placeholder="Email (opcional)" value={newCliente.email} onChange={(e) => setNewCliente({ ...newCliente, email: e.target.value })} className={inputClass} />
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Endereco</h3>
                <textarea
                  value={enderecoText}
                  onChange={(e) => setEnderecoText(e.target.value)}
                  placeholder="Rua, numero, bairro, cidade, UF, CEP"
                  className={`${inputClass} h-20`}
                />
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Evento</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-xs text-brand-warm-gray block mb-1">Data</label>
                    <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-brand-warm-gray block mb-1">Horario</label>
                    <input type="time" value={horarioEvento} onChange={(e) => setHorarioEvento(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={tipoChopeira === "gelo"} onChange={() => setTipoChopeira("gelo")} /> Chopeira gelo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={tipoChopeira === "eletrica"} onChange={() => setTipoChopeira("eletrica")} /> Eletrica
                  </label>
                </div>
                <textarea placeholder="Rampas, escadas, instrucoes de acesso (opcional)" value={rampasEscadas} onChange={(e) => setRampasEscadas(e.target.value)} className={`${inputClass} h-16`} />
                <textarea placeholder="Observacoes (opcional)" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={`${inputClass} h-16 mt-2`} />
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Itens</h3>
                {items.length === 0 && <p className="text-xs text-brand-warm-gray mb-2">Nenhum item ainda.</p>}
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const produto = produtos.find((p) => p.id === item.produto_id)
                    const hasSegundoBarril = produto?.preco_segundo_barril != null
                    const calc = computeLineSubtotal(produto, item, metodoPagamento)
                    return (
                      <div key={idx} className="bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2">
                        <div className="flex gap-2">
                          <select value={item.produto_id} onChange={(e) => updateItem(idx, { produto_id: e.target.value })} className={`${inputClass} flex-1`}>
                            {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={item.quantidade}
                            onChange={(e) => updateItem(idx, { quantidade: Number(e.target.value) })}
                            className={`${inputClass} w-20`}
                          />
                          <button onClick={() => removeItem(idx)} className="text-red-400 px-2 hover:bg-red-500/10 rounded">×</button>
                        </div>
                        {hasSegundoBarril && (
                          <label className="flex items-center gap-2 text-xs text-white">
                            <input
                              type="checkbox"
                              checked={item.is_consignado}
                              onChange={(e) => updateItem(idx, { is_consignado: e.target.checked })}
                            />
                            <span>Consignado</span>
                            <span className="text-brand-warm-gray italic">(paga so se usar)</span>
                          </label>
                        )}
                        <p className="text-xs text-brand-warm-gray">
                          {item.is_consignado
                            ? item.quantidade > 1
                              ? `${formatCurrency(calc.firstUnitPrice)} + ${item.quantidade - 1}x ${formatCurrency(calc.secondUnitPrice)} = ${formatCurrency(calc.subtotal)} (consignado)`
                              : `${formatCurrency(calc.subtotal)} (consignado)`
                            : formatCurrency(calc.subtotal)}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <button onClick={addItem} className="mt-2 text-sm text-brand-yellow underline">+ Adicionar item</button>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-yellow uppercase tracking-wider mb-2">Pagamento</h3>
                <div className="flex gap-3 mb-2">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "pix"} onChange={() => setMetodoPagamento("pix")} /> Pix
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "cartao"} onChange={() => setMetodoPagamento("cartao")} /> Cartao
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="radio" checked={metodoPagamento === "dinheiro"} onChange={() => setMetodoPagamento("dinheiro")} /> Dinheiro
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-white mb-2">
                  <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} /> Cliente ja pagou
                </label>
                <div>
                  <label className="text-xs text-brand-warm-gray block mb-1">Frete (R$)</label>
                  <input type="number" min={0} step={0.01} value={frete} onChange={(e) => setFrete(Number(e.target.value))} className={inputClass} />
                </div>
              </section>

              <section className="bg-brand-dark border border-white/10 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="text-brand-warm-gray">Subtotal</span><span className="text-white">{formatCurrency(totals.subtotalMin)}</span></div>
                <div className="flex justify-between"><span className="text-brand-warm-gray">Frete</span><span className="text-white">{formatCurrency(frete)}</span></div>
                <div className="flex justify-between font-semibold mt-2">
                  <span className="text-white">Total</span>
                  <span className="text-brand-yellow">
                    {hasConsignado
                      ? `${formatCurrency(totalMin)} / ${formatCurrency(totalMax)}`
                      : formatCurrency(totalMin)}
                  </span>
                </div>
                {hasConsignado && (
                  <p className="text-xs text-brand-warm-gray mt-1">Min (consignado devolvido) / Max (consignado usado)</p>
                )}
              </section>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex gap-2">
                <button onClick={handleClose} disabled={submitting} className="flex-1 border border-white/10 text-brand-gray-light py-2.5 rounded-lg text-sm disabled:opacity-50">Cancelar</button>
                <button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg text-sm disabled:opacity-50">
                  {submitting ? "Criando..." : "Criar pedido"}
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ManualOrderDrawer
