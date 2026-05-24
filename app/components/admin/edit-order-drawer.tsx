"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { updatePedido, addPedidoItem, removePedidoItem, updatePedidoItem } from "@/lib/admin-actions"
import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"
import { calculateOrderTotals } from "@/lib/pricing"
import type { Produto } from "@/lib/types"
import type { UpdatePedidoInput } from "@/lib/schemas"

type EditablePedido = {
  id: string
  status: string
  data_evento: string
  horario_evento: string
  endereco: string
  endereco_completo: {
    rua: string
    numero: string
    bairro: string
    cidade: string
    estado: string
    cep: string
    complemento: string
    lat: number
    lng: number
  } | null
  observacoes: string | null
  rampas_escadas: string | null
  tipo_chopeira: "gelo" | "eletrica"
  frete: number
  desconto: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
}

type EditableItem = {
  id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  is_consignado: boolean
  consignado_status: string | null
  subtotal: number
  produtos: { marca: string; volume_litros: number } | null
}

type Props = {
  open: boolean
  onClose: () => void
  pedido: EditablePedido
  items: EditableItem[]
  produtos: Produto[]
}

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const inputClass = "w-full bg-brand-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-brand-warm-gray focus:border-brand-yellow/40 focus:outline-none"

const sectionHeaderClass = "text-xs font-semibold uppercase tracking-[0.18em] text-brand-yellow/80 mb-3 pb-1.5 border-b border-white/10"

type SegmentedOption<T extends string> = { value: T; label: string }

const Segmented = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  ariaLabel: string
}) => (
  <div role="radiogroup" aria-label={ariaLabel} className="inline-flex w-full rounded-lg bg-brand-dark border border-white/10 p-0.5">
    {options.map((opt) => (
      <button
        key={opt.value}
        type="button"
        role="radio"
        aria-checked={value === opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
          value === opt.value ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)

const EditOrderDrawer = ({ open, onClose, pedido, items, produtos }: Props) => {
  const original = useMemo(
    () => ({
      data_evento: pedido.data_evento,
      horario_evento: pedido.horario_evento.slice(0, 5),
      endereco: pedido.endereco,
      endereco_completo: pedido.endereco_completo,
      observacoes: pedido.observacoes ?? "",
      rampas_escadas: pedido.rampas_escadas ?? "",
      tipo_chopeira: pedido.tipo_chopeira,
      frete: pedido.frete,
      desconto: pedido.desconto,
      metodo_pagamento: pedido.metodo_pagamento ?? "pix",
      pago: pedido.pago,
    }),
    [pedido],
  )

  const [dataEvento, setDataEvento] = useState(original.data_evento)
  const [horarioEvento, setHorarioEvento] = useState(original.horario_evento)
  const [endereco, setEndereco] = useState(original.endereco)
  const [enderecoCompleto, setEnderecoCompleto] = useState(original.endereco_completo)
  const [showAddressAutocomplete, setShowAddressAutocomplete] = useState(false)
  const [observacoes, setObservacoes] = useState(original.observacoes)
  const [rampasEscadas, setRampasEscadas] = useState(original.rampas_escadas)
  const [tipoChopeira, setTipoChopeira] = useState<"gelo" | "eletrica">(original.tipo_chopeira)
  const [frete, setFrete] = useState(original.frete)
  const [desconto, setDesconto] = useState(original.desconto)
  const [metodoPagamento, setMetodoPagamento] = useState<"pix" | "cartao" | "dinheiro">(original.metodo_pagamento)
  const [pago, setPago] = useState(original.pago)

  const [newItemProdutoId, setNewItemProdutoId] = useState(produtos[0]?.id ?? "")
  const [newItemQty, setNewItemQty] = useState(1)
  const [newItemConsignado, setNewItemConsignado] = useState(false)

  const [saving, setSaving] = useState(false)
  const [itemBusy, setItemBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const changedFields = useMemo(() => {
    const fields: string[] = []
    if (dataEvento !== original.data_evento) fields.push("data")
    if (horarioEvento !== original.horario_evento) fields.push("horario")
    if (endereco !== original.endereco) fields.push("endereco")
    if (observacoes !== original.observacoes) fields.push("observacoes")
    if (rampasEscadas !== original.rampas_escadas) fields.push("rampas")
    if (tipoChopeira !== original.tipo_chopeira) fields.push("chopeira")
    if (frete !== original.frete) fields.push("frete")
    if (desconto !== original.desconto) fields.push("desconto")
    if (metodoPagamento !== original.metodo_pagamento) fields.push("pagamento")
    if (pago !== original.pago) fields.push("pago")
    return fields
  }, [dataEvento, horarioEvento, endereco, observacoes, rampasEscadas, tipoChopeira, frete, desconto, metodoPagamento, pago, original])

  const hasChanges = changedFields.length > 0

  const liveTotals = useMemo(() => {
    const totals = calculateOrderTotals(items.map((i) => ({
      subtotal: Number(i.subtotal),
      is_consignado: i.is_consignado,
      consignado_status: i.consignado_status,
    })))
    const subtotalMin = totals.subtotalMin
    const subtotalMax = totals.subtotalMax
    const totalMin = subtotalMin - desconto + frete
    const totalMax = subtotalMax - desconto + frete
    return { subtotalMin, subtotalMax, totalMin, totalMax, hasPendente: totals.hasPendente }
  }, [items, frete, desconto])

  const handleAddressSelect = (addr: AddressData) => {
    setEndereco(addr.formatted)
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

  const handleDiscard = () => {
    setDataEvento(original.data_evento)
    setHorarioEvento(original.horario_evento)
    setEndereco(original.endereco)
    setEnderecoCompleto(original.endereco_completo)
    setObservacoes(original.observacoes)
    setRampasEscadas(original.rampas_escadas)
    setTipoChopeira(original.tipo_chopeira)
    setFrete(original.frete)
    setDesconto(original.desconto)
    setMetodoPagamento(original.metodo_pagamento)
    setPago(original.pago)
    setShowAddressAutocomplete(false)
    setError(null)
  }

  const handleSave = async () => {
    if (!hasChanges) {
      onClose()
      return
    }
    setError(null)
    setSaving(true)
    try {
      const changes: UpdatePedidoInput = {
        data_evento: dataEvento,
        horario_evento: horarioEvento,
        endereco,
        endereco_completo: enderecoCompleto ?? undefined,
        observacoes: observacoes || null,
        rampas_escadas: rampasEscadas || null,
        tipo_chopeira: tipoChopeira,
        frete,
        desconto,
        metodo_pagamento: metodoPagamento,
        pago,
      }
      await updatePedido(pedido.id, changes)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemProdutoId) return
    setError(null)
    setItemBusy("add")
    try {
      await addPedidoItem(pedido.id, newItemProdutoId, newItemQty, newItemConsignado)
      setNewItemQty(1)
      setNewItemConsignado(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar item")
    } finally {
      setItemBusy(null)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    setError(null)
    setItemBusy(itemId)
    try {
      await removePedidoItem(itemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover item")
    } finally {
      setItemBusy(null)
    }
  }

  const handleUpdateItem = async (itemId: string, patch: { quantidade?: number; preco_unitario?: number }) => {
    setError(null)
    setItemBusy(itemId)
    try {
      await updatePedidoItem(itemId, patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar item")
    } finally {
      setItemBusy(null)
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
          onClick={() => !saving && onClose()}
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
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-bold text-white tracking-wide">EDITAR PEDIDO</h2>
                {hasChanges && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30">
                    {changedFields.length} {changedFields.length === 1 ? "alteração" : "alterações"}
                  </span>
                )}
              </div>
              <button onClick={onClose} disabled={saving} className="text-brand-warm-gray hover:text-white text-2xl leading-none disabled:opacity-50 cursor-pointer">×</button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <section>
                <h3 className={sectionHeaderClass}>Evento</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-brand-warm-gray block mb-1 uppercase tracking-wider">Data</label>
                      <input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[11px] text-brand-warm-gray block mb-1 uppercase tracking-wider">Horario</label>
                      <input type="time" value={horarioEvento} onChange={(e) => setHorarioEvento(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-brand-warm-gray block mb-1 uppercase tracking-wider">Chopeira</label>
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
                  <textarea placeholder="Rampas / escadas (opcional)" value={rampasEscadas} onChange={(e) => setRampasEscadas(e.target.value)} className={`${inputClass} h-16 resize-none`} />
                  <textarea placeholder="Observações (opcional)" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={`${inputClass} h-16 resize-none`} />
                </div>
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Endereço</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className={inputClass}
                  />
                  {showAddressAutocomplete ? (
                    <div className="space-y-2 bg-brand-dark/50 border border-brand-yellow/20 rounded-lg p-2">
                      <AddressAutocomplete onAddressSelect={handleAddressSelect} inputClassName={inputClass} />
                      <button
                        type="button"
                        onClick={() => setShowAddressAutocomplete(false)}
                        className="text-[11px] text-brand-warm-gray hover:text-white uppercase tracking-wider cursor-pointer"
                      >
                        Cancelar busca
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddressAutocomplete(true)}
                      className="text-[11px] text-brand-yellow/90 hover:text-brand-yellow uppercase tracking-wider cursor-pointer"
                    >
                      ↻ Trocar via Google
                    </button>
                  )}
                </div>
              </section>

              <section>
                <h3 className={sectionHeaderClass}>Itens</h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      busy={itemBusy === item.id}
                      disabled={itemBusy !== null && itemBusy !== item.id}
                      onUpdate={(patch) => handleUpdateItem(item.id, patch)}
                      onRemove={() => handleRemoveItem(item.id)}
                    />
                  ))}
                </ul>

                <div className="mt-3 bg-brand-dark border border-white/10 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] text-brand-warm-gray uppercase tracking-wider">Adicionar item</p>
                  <div className="flex gap-2">
                    <select value={newItemProdutoId} onChange={(e) => setNewItemProdutoId(e.target.value)} className={`${inputClass} flex-1`}>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.marca} {p.volume_litros}L</option>)}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Number(e.target.value))}
                      className={`${inputClass} w-20`}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                    <input type="checkbox" checked={newItemConsignado} onChange={(e) => setNewItemConsignado(e.target.checked)} />
                    Marcar como consignado (paga só se usar)
                  </label>
                  <button
                    onClick={handleAddItem}
                    disabled={itemBusy !== null || !newItemProdutoId}
                    className="w-full bg-brand-yellow/15 border border-brand-yellow/40 text-brand-yellow py-2 rounded text-sm font-semibold hover:bg-brand-yellow/25 disabled:opacity-50 cursor-pointer"
                  >
                    {itemBusy === "add" ? "Adicionando..." : "+ Adicionar item"}
                  </button>
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
                  <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                    <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
                    Cliente já pagou
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-brand-warm-gray block mb-1 uppercase tracking-wider">Frete (R$)</label>
                      <input type="number" min={0} step={0.01} value={frete} onChange={(e) => setFrete(Number(e.target.value))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-[11px] text-brand-warm-gray block mb-1 uppercase tracking-wider">Desconto (R$)</label>
                      <input type="number" min={0} step={0.01} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} className={inputClass} />
                    </div>
                  </div>
                  <div className="bg-brand-dark border border-white/10 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between text-brand-warm-gray">
                      <span>Subtotal {liveTotals.hasPendente ? "(usado/total)" : ""}</span>
                      <span>{liveTotals.hasPendente ? `${formatCurrency(liveTotals.subtotalMin)} / ${formatCurrency(liveTotals.subtotalMax)}` : formatCurrency(liveTotals.subtotalMax)}</span>
                    </div>
                    {desconto > 0 && (
                      <div className="flex justify-between text-brand-warm-gray">
                        <span>Desconto</span>
                        <span>−{formatCurrency(desconto)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-brand-warm-gray">
                      <span>Frete</span>
                      <span>{formatCurrency(frete)}</span>
                    </div>
                    <div className="flex justify-between text-white font-bold border-t border-white/10 pt-1.5 mt-1">
                      <span>Total</span>
                      <span className="text-brand-yellow">
                        {liveTotals.hasPendente ? `${formatCurrency(liveTotals.totalMin)} / ${formatCurrency(liveTotals.totalMax)}` : formatCurrency(liveTotals.totalMax)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <footer className="px-6 py-4 border-t border-white/10 flex gap-2 bg-brand-surface">
              <button
                onClick={handleDiscard}
                disabled={saving || !hasChanges}
                className="flex-1 border border-white/10 text-brand-gray-light py-2.5 rounded-lg text-sm hover:bg-white/5 disabled:opacity-30 cursor-pointer"
              >
                Descartar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] bg-brand-yellow text-brand-black font-bold py-2.5 rounded-lg text-sm hover:bg-brand-amber disabled:opacity-50 cursor-pointer"
              >
                {saving ? "Salvando..." : hasChanges ? `Salvar (${changedFields.length})` : "Sem alterações"}
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const ItemRow = ({
  item,
  busy,
  disabled,
  onUpdate,
  onRemove,
}: {
  item: EditableItem
  busy: boolean
  disabled: boolean
  onUpdate: (patch: { quantidade?: number; preco_unitario?: number }) => Promise<void>
  onRemove: () => void
}) => {
  const [qty, setQty] = useState(item.quantidade)
  const [preco, setPreco] = useState(item.preco_unitario)

  const qtyChanged = qty !== item.quantidade
  const precoChanged = preco !== item.preco_unitario

  const commitQty = (next: number) => {
    if (item.is_consignado) return
    if (next < 1 || next === item.quantidade) return
    setQty(next)
    void onUpdate({ quantidade: next })
  }

  const commitPreco = () => {
    if (preco === item.preco_unitario) return
    if (preco < 0 || Number.isNaN(preco)) {
      setPreco(item.preco_unitario)
      return
    }
    void onUpdate({ preco_unitario: preco })
  }

  return (
    <li className={`bg-brand-dark border rounded-lg px-3 py-2 text-sm transition ${busy ? "border-brand-yellow/40 opacity-70" : qtyChanged || precoChanged ? "border-brand-yellow/30" : "border-white/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-brand-gray-light truncate">
            {item.produtos?.marca} {item.produtos?.volume_litros}L
            {item.is_consignado && (
              <span className="text-yellow-400 ml-2 text-xs">· consignado ({item.consignado_status})</span>
            )}
          </p>
        </div>
        <button
          disabled={busy || disabled}
          onClick={onRemove}
          aria-label="Remover item"
          className="text-red-400 hover:bg-red-500/10 rounded px-2 disabled:opacity-30 cursor-pointer"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        {item.is_consignado ? (
          <span className="text-[11px] text-brand-warm-gray uppercase tracking-wider">Qtd 1</span>
        ) : (
          <div className="inline-flex items-center bg-brand-surface border border-white/10 rounded-md">
            <button
              type="button"
              onClick={() => commitQty(qty - 1)}
              disabled={busy || disabled || qty <= 1}
              className="px-2.5 py-1 text-brand-gray-light hover:text-white disabled:opacity-30 cursor-pointer"
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="px-3 text-sm font-semibold text-white tabular-nums min-w-[2ch] text-center">{qty}</span>
            <button
              type="button"
              onClick={() => commitQty(qty + 1)}
              disabled={busy || disabled}
              className="px-2.5 py-1 text-brand-gray-light hover:text-white disabled:opacity-30 cursor-pointer"
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 flex-1">
          <span className="text-[11px] text-brand-warm-gray uppercase tracking-wider">R$</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={preco}
            onChange={(e) => setPreco(Number(e.target.value))}
            onBlur={commitPreco}
            disabled={busy || disabled}
            className="w-20 bg-brand-surface border border-white/10 rounded-md px-2 py-1 text-sm text-white tabular-nums focus:border-brand-yellow/40 focus:outline-none disabled:opacity-50"
          />
          <span className="text-[11px] text-brand-warm-gray">/un</span>
        </div>
        <span className="text-white font-semibold tabular-nums">{formatCurrency(Number(item.subtotal))}</span>
      </div>
    </li>
  )
}

export default EditOrderDrawer
