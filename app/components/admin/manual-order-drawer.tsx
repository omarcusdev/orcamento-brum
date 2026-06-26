"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, RefreshCcw } from "lucide-react"
import { createManualOrder, searchClientes } from "@/lib/admin-actions"
import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"
import type { Produto } from "@/lib/types"
import type { ManualOrderInput } from "@/lib/schemas"
import { calculateOrderTotals, priceManualOrderLines } from "@/lib/pricing"
import { formatBRL } from "@/lib/format"
import {
  Button,
  Checkbox,
  Input,
  MoneyInput,
  NumberStepper,
  Segmented,
  Select,
  Textarea,
  fieldLabelClass,
} from "@/components/ui"

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

const sectionHeaderClass = "text-xs font-semibold uppercase tracking-[0.18em] text-brand-yellow/80 mb-3 pb-1.5 border-b border-white/10"

const describeBarrels = (barrelPrices: number[]) => {
  if (barrelPrices.length <= 1) return formatBRL(barrelPrices[0] ?? 0)
  const [first, ...rest] = barrelPrices
  const allEqual = rest.every((price) => price === first)
  return allEqual
    ? `${barrelPrices.length}x ${formatBRL(first)}`
    : `${formatBRL(first)} + ${rest.length}x ${formatBRL(rest[0])}`
}

const ManualOrderDrawer = ({ open, onClose, produtos }: Props) => {
  const [clienteMode, setClienteMode] = useState<"search" | "new">("search")
  const [clienteQuery, setClienteQuery] = useState("")
  const [clienteResults, setClienteResults] = useState<ClienteResult[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null)
  const [newCliente, setNewCliente] = useState({ nome: "", telefone: "", cpf: "", email: "" })

  const [enderecoText, setEnderecoText] = useState("")
  const [enderecoCompleto, setEnderecoCompleto] = useState<ManualOrderInput["endereco_completo"]>(null)
  const [showAddressAutocomplete, setShowAddressAutocomplete] = useState(false)
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
    setEnderecoCompleto(null)
    setShowAddressAutocomplete(false)
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

  // Preenche o endereço (texto + lat/lng) a partir da seleção do Google, igual ao editar pedido.
  const handleAddressSelect = (addr: AddressData) => {
    setEnderecoText(addr.formatted)
    setEnderecoCompleto({
      rua: addr.rua,
      numero: addr.numero,
      bairro: addr.bairro,
      cidade: addr.cidade,
      estado: addr.estado,
      cep: addr.cep,
      complemento: enderecoCompleto?.complemento ?? "",
      lat: addr.lat,
      lng: addr.lng,
    })
    setShowAddressAutocomplete(false)
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

  const pricedLines = priceManualOrderLines(items, produtos, metodoPagamento)

  const itemRowsForTotals = pricedLines.flatMap((line) =>
    line.is_consignado
      ? line.barrelPrices.map((price) => ({
          subtotal: price,
          is_consignado: true,
          consignado_status: "pendente" as string | null,
        }))
      : [{ subtotal: line.subtotal, is_consignado: false, consignado_status: null as string | null }],
  )

  const totals = calculateOrderTotals(itemRowsForTotals)
  // Valor cheio: consignado conta no total (abatido só no acerto), então mostramos o máximo — não R$ 0.
  const total = totals.subtotalMax + frete

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
        endereco_completo: enderecoCompleto,
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
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-brand-surface border-l border-white/10 flex flex-col"
          >
            <header className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/10">
              <h2 className="font-display text-xl font-bold text-white tracking-wide">NOVO PEDIDO MANUAL</h2>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                aria-label="Fechar"
                className="text-brand-warm-gray hover:text-white disabled:opacity-50 cursor-pointer p-1 rounded hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <section>
                <h3 className={sectionHeaderClass}>Cliente</h3>
                <div className="mb-3">
                  <Segmented
                    value={clienteMode}
                    onChange={(v) => setClienteMode(v)}
                    ariaLabel="Modo cliente"
                    options={[
                      { value: "search", label: "Buscar existente" },
                      { value: "new", label: "Criar novo" },
                    ]}
                  />
                </div>

                {clienteMode === "search" && (
                  <div className="space-y-2">
                    <Input
                      value={clienteQuery}
                      onChange={(e) => { setClienteQuery(e.target.value); setSelectedCliente(null) }}
                      placeholder="Buscar por nome, telefone ou CPF"
                    />
                    {selectedCliente ? (
                      <div className="bg-brand-dark border border-brand-yellow/30 rounded-lg p-3 text-sm flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{selectedCliente.nome}</p>
                          <p className="text-brand-warm-gray text-xs">{selectedCliente.telefone} {selectedCliente.cpf ? `· ${selectedCliente.cpf}` : ""}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedCliente(null); setClienteQuery("") }}>
                          Trocar
                        </Button>
                      </div>
                    ) : clienteResults.length > 0 ? (
                      <ul className="bg-brand-dark border border-white/10 rounded-lg divide-y divide-white/5 max-h-48 overflow-y-auto">
                        {clienteResults.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { setSelectedCliente(c); setClienteResults([]) }}
                              className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm cursor-pointer transition"
                            >
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
                    <Input placeholder="Nome *" value={newCliente.nome} onChange={(e) => setNewCliente({ ...newCliente, nome: e.target.value })} />
                    <Input placeholder="Telefone * (ex: 21 99999-9999)" value={newCliente.telefone} onChange={(e) => setNewCliente({ ...newCliente, telefone: e.target.value })} />
                    <Input placeholder="CPF (opcional)" value={newCliente.cpf} onChange={(e) => setNewCliente({ ...newCliente, cpf: e.target.value })} />
                    <Input placeholder="Email (opcional)" type="email" value={newCliente.email} onChange={(e) => setNewCliente({ ...newCliente, email: e.target.value })} />
                  </div>
                )}
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Endereço</h3>
                <div className="space-y-2">
                  <Textarea
                    value={enderecoText}
                    onChange={(e) => setEnderecoText(e.target.value)}
                    placeholder="Rua, número, bairro, cidade, UF, CEP"
                    className="h-20"
                  />
                  {showAddressAutocomplete ? (
                    <div className="space-y-2 bg-brand-dark/50 border border-brand-yellow/20 rounded-lg p-2">
                      <AddressAutocomplete onAddressSelect={handleAddressSelect} inputClassName="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 text-sm text-white placeholder-brand-warm-gray/70 focus:border-brand-yellow/40 focus:ring-1 focus:ring-brand-yellow/30 outline-none" />
                      <Button variant="ghost" size="sm" onClick={() => setShowAddressAutocomplete(false)}>
                        Cancelar busca
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddressAutocomplete(true)}
                      className="text-[11px] text-brand-yellow/90 hover:text-brand-yellow uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Buscar via Google
                    </button>
                  )}
                </div>
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Evento</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={fieldLabelClass}>Data</label>
                      <Input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
                    </div>
                    <div>
                      <label className={fieldLabelClass}>Horário</label>
                      <Input type="time" value={horarioEvento} onChange={(e) => setHorarioEvento(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={fieldLabelClass}>Chopeira</label>
                    <Segmented
                      value={tipoChopeira}
                      onChange={setTipoChopeira}
                      ariaLabel="Tipo de chopeira"
                      options={[
                        { value: "gelo", label: "Gelo" },
                        { value: "eletrica", label: "Elétrica" },
                      ]}
                    />
                  </div>
                  <Textarea placeholder="Rampas, escadas, instruções de acesso (opcional)" value={rampasEscadas} onChange={(e) => setRampasEscadas(e.target.value)} className="h-16" />
                  <Textarea placeholder="Observações (opcional)" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="h-16" />
                </div>
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Itens</h3>
                {items.length === 0 && <p className="text-xs text-brand-warm-gray mb-3">Nenhum item ainda.</p>}
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const produto = produtos.find((p) => p.id === item.produto_id)
                    const hasSegundoBarril = produto?.preco_segundo_barril != null
                    const calc = pricedLines[idx]
                    return (
                      <div key={idx} className="bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Select value={item.produto_id} onChange={(e) => updateItem(idx, { produto_id: e.target.value })} className="flex-1">
                            {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                          </Select>
                          <NumberStepper
                            value={item.quantidade}
                            onChange={(next) => updateItem(idx, { quantidade: next })}
                            min={1}
                            max={100}
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            aria-label="Remover item"
                            className="text-red-400 hover:bg-red-500/10 rounded p-1.5 cursor-pointer transition"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {hasSegundoBarril && (
                          <Checkbox
                            checked={item.is_consignado}
                            onChange={(e) => updateItem(idx, { is_consignado: e.target.checked })}
                            label={
                              <>
                                Consignado <span className="text-brand-warm-gray italic">(paga só se usar)</span>
                              </>
                            }
                          />
                        )}
                        <p className="text-xs text-brand-warm-gray">
                          {item.is_consignado
                            ? `${describeBarrels(calc.barrelPrices)}${item.quantidade > 1 ? ` = ${formatBRL(calc.subtotal)}` : ""} (consignado)`
                            : formatBRL(calc.subtotal)}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <Button variant="ghost-yellow" fullWidth onClick={addItem} className="mt-3">
                  + Adicionar item
                </Button>
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Pagamento</h3>
                <div className="space-y-3">
                  <Segmented
                    value={metodoPagamento}
                    onChange={setMetodoPagamento}
                    ariaLabel="Método de pagamento"
                    options={[
                      { value: "pix", label: "PIX" },
                      { value: "cartao", label: "Cartão" },
                      { value: "dinheiro", label: "Dinheiro" },
                    ]}
                  />
                  <Checkbox checked={pago} onChange={(e) => setPago(e.target.checked)} label="Cliente já pagou" />
                  <div>
                    <label className={fieldLabelClass}>Frete</label>
                    <MoneyInput value={frete} onChange={setFrete} min={0} aria-label="Frete" />
                  </div>
                  <div className="bg-brand-dark border border-white/10 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between text-brand-warm-gray">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{formatBRL(totals.subtotalMax)}</span>
                    </div>
                    <div className="flex justify-between text-brand-warm-gray">
                      <span>Frete</span>
                      <span className="tabular-nums">{formatBRL(frete)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1.5 mt-1">
                      <span>Total</span>
                      <span className="text-brand-yellow tabular-nums">{formatBRL(total)}</span>
                    </div>
                    {hasConsignado && (
                      <p className="text-[11px] text-brand-warm-gray pt-1">
                        Consignado entra no total; no acerto a gente abate os barris devolvidos.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <footer className="px-6 py-4 border-t border-white/10 flex gap-2 bg-brand-surface">
              <Button variant="secondary" onClick={handleClose} disabled={submitting} className="flex-1">
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
                {submitting ? "Criando..." : "Criar pedido"}
              </Button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ManualOrderDrawer
