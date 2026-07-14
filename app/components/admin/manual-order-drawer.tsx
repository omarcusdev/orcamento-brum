"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { createManualOrder, searchClientes } from "@/lib/admin-actions"
import { type AddressData } from "@/components/address-autocomplete"
import { addressDataToEnderecoCompleto } from "@/lib/address"
import { AddressSearchToggle } from "@/components/admin/address-search-toggle"
import type { Produto } from "@/lib/types"
import type { ManualOrderInput } from "@/lib/schemas"
import { calculateOrderTotals, priceManualOrderLines, consignadoSplit, hasFirmeItem, REQUIRE_FIRME_MESSAGE, priceBarrels } from "@/lib/pricing"
import { formatBRL } from "@/lib/format"
import {
  Button,
  Checkbox,
  Drawer,
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
  ultimo_endereco: string | null
}

type DraftItem = {
  produto_id: string
  barrels: boolean[] // cada = isConsignado; barril novo nasce firme (false)
}

type Props = {
  open: boolean
  onClose: () => void
  produtos: Produto[]
}

const sectionHeaderClass = "text-xs font-semibold uppercase tracking-[0.18em] text-brand-yellow/80 mb-3 pb-1.5 border-b border-white/10"

const ManualOrderDrawer = ({ open, onClose, produtos }: Props) => {
  const [clienteMode, setClienteMode] = useState<"search" | "new">("search")
  const [clienteQuery, setClienteQuery] = useState("")
  const [clienteResults, setClienteResults] = useState<ClienteResult[]>([])
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null)
  const [newCliente, setNewCliente] = useState({ nome: "", telefone: "", cpf: "", email: "" })

  const [enderecoText, setEnderecoText] = useState("")
  const [enderecoCompleto, setEnderecoCompleto] = useState<ManualOrderInput["endereco_completo"]>(null)
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
    setEnderecoCompleto(addressDataToEnderecoCompleto(addr, enderecoCompleto?.complemento ?? ""))
  }

  const addItem = () => {
    if (produtos.length === 0) return
    setItems((prev) => [...prev, { produto_id: produtos[0].id, barrels: [false] }])
  }

  const setItemProduto = (idx: number, produto_id: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, produto_id } : it)))

  const setItemQty = (idx: number, qty: number) =>
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const next = Math.max(1, Math.min(100, Math.floor(qty)))
      const barrels = it.barrels.slice(0, next)
      while (barrels.length < next) barrels.push(false) // barris novos nascem firme
      return { ...it, barrels }
    }))

  const setBarrelConsignado = (idx: number, barrelIdx: number, isConsignado: boolean) =>
    setItems((prev) => prev.map((it, i) =>
      i === idx ? { ...it, barrels: it.barrels.map((b, bi) => (bi === barrelIdx ? isConsignado : b)) } : it,
    ))

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  // Achata cada produto (barrels[]) pros itens-wire {produto_id, quantidade, is_consignado}
  // que o server/pricing já consomem — agrupando firmes e consignado da linha.
  const wireItems = items.flatMap((item) => {
    const firmeCount = item.barrels.filter((b) => !b).length
    const consignadoCount = item.barrels.length - firmeCount
    const lines: ManualOrderInput["items"] = []
    if (firmeCount > 0) lines.push({ produto_id: item.produto_id, quantidade: firmeCount, is_consignado: false })
    if (consignadoCount > 0) lines.push({ produto_id: item.produto_id, quantidade: consignadoCount, is_consignado: true })
    return lines
  })

  const pricedLines = priceManualOrderLines(wireItems, produtos, metodoPagamento)

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
  // Resumo: separa "a pagar agora" (firmes + frete) do consignado. Valor cheio segue em split.totalCheio.
  const split = consignadoSplit(itemRowsForTotals, frete, 0)

  const canSubmit =
    !submitting &&
    items.length > 0 &&
    items.every((i) => i.barrels.length >= 1) &&
    hasFirmeItem(wireItems) &&
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
        items: wireItems,
        metodo_pagamento: metodoPagamento,
        pago,
        frete,
      }

      const result = await createManualOrder(input)
      if (result && "error" in result) {
        setError(result.error ?? "Erro ao criar pedido")
        return
      }
      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      closeDisabled={submitting}
      title="NOVO PEDIDO MANUAL"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
            {submitting ? "Criando..." : "Criar pedido"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
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
                  <div className="min-w-0">
                    <p className="text-white font-medium">{selectedCliente.nome}</p>
                    <p className="text-brand-warm-gray text-xs">{selectedCliente.telefone} {selectedCliente.cpf ? `· ${selectedCliente.cpf}` : ""}</p>
                    {selectedCliente.ultimo_endereco && <p className="text-brand-warm-gray text-xs truncate">📍 {selectedCliente.ultimo_endereco}</p>}
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
                        {c.ultimo_endereco && <p className="text-brand-warm-gray text-xs truncate">📍 {c.ultimo_endereco}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : clienteQuery.length >= 2 ? (
                <p className="text-xs text-brand-warm-gray">Nenhum cliente encontrado. Use &quot;Criar novo&quot;.</p>
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
          <h3 className={sectionHeaderClass}>Itens</h3>
          {items.length === 0 && <p className="text-xs text-brand-warm-gray mb-3">Nenhum item ainda.</p>}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const produto = produtos.find((p) => p.id === item.produto_id)
              const barrelPrices = produto
                ? priceBarrels(produto, item.barrels, metodoPagamento)
                : item.barrels.map((b) => ({ is_consignado: b, preco: 0 }))
              return (
                <div key={idx} className="bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Select value={item.produto_id} onChange={(e) => setItemProduto(idx, e.target.value)} className="flex-1">
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                    </Select>
                    <NumberStepper
                      value={item.barrels.length}
                      onChange={(next) => setItemQty(idx, next)}
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
                  <div className="space-y-1.5">
                    {item.barrels.map((isConsignado, barrelIdx) => (
                      <div key={barrelIdx} className="flex items-center gap-2">
                        <span className="text-xs text-brand-warm-gray w-16 shrink-0">Barril {barrelIdx + 1}</span>
                        <Segmented
                          value={isConsignado ? "consignado" : "firme"}
                          onChange={(v) => setBarrelConsignado(idx, barrelIdx, v === "consignado")}
                          ariaLabel={`Barril ${barrelIdx + 1}: firme ou consignado`}
                          options={[
                            { value: "firme", label: "Firme" },
                            { value: "consignado", label: "Consignado" },
                          ]}
                        />
                        <span className="text-xs tabular-nums text-brand-warm-gray ml-auto shrink-0">{formatBRL(barrelPrices[barrelIdx]?.preco ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  {item.barrels.some((b) => b) && (
                    <p className="text-[11px] text-brand-warm-gray italic">Consignado: paga só se usar.</p>
                  )}
                </div>
              )
            })}
          </div>
          <Button variant="ghost-yellow" fullWidth onClick={addItem} className="mt-3">
            + Adicionar item
          </Button>
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
            <AddressSearchToggle onSelect={handleAddressSelect} openLabel="Buscar via Google" />
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
              {split.hasConsignado ? (
                <>
                  <div className="flex justify-between text-white font-bold">
                    <span>A pagar agora</span>
                    <span className="text-brand-yellow tabular-nums">{formatBRL(split.aPagar)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray text-xs">
                    <span className="pl-2">Firmes</span>
                    <span className="tabular-nums">{formatBRL(split.firmes)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray text-xs">
                    <span className="pl-2">Frete</span>
                    <span className="tabular-nums">{formatBRL(frete)}</span>
                  </div>
                  <div className="flex justify-between text-brand-warm-gray">
                    <span>Consignado (só se usar)</span>
                    <span className="tabular-nums">{formatBRL(split.consignado)}</span>
                  </div>
                  <div className="flex justify-between text-white border-t border-white/10 pt-1.5 mt-1">
                    <span>Total se usar tudo</span>
                    <span className="tabular-nums">{formatBRL(split.totalCheio)}</span>
                  </div>
                  <p className="text-[11px] text-brand-warm-gray pt-1">
                    No acerto a gente abate os barris devolvidos.
                  </p>
                </>
              ) : (
                <>
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
                    <span className="text-brand-yellow tabular-nums">{formatBRL(split.totalCheio)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {items.length > 0 && !hasFirmeItem(wireItems) && (
          <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {REQUIRE_FIRME_MESSAGE}
          </p>
        )}

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Drawer>
  )
}

export default ManualOrderDrawer
