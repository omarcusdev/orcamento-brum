"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { Produto } from "@/lib/types"
import { updateProductSecondBarrelPrice } from "@/lib/admin-actions"
import { Input } from "@/components/ui"
import { formatBRL } from "@/lib/format"

type PromocoesListProps = {
  produtos: Produto[]
}

const PromocoesList = ({ produtos: initialProdutos }: PromocoesListProps) => {
  const [produtos, setProdutos] = useState<Produto[]>(initialProdutos)
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialProdutos.map((p) => [p.id, p.preco_segundo_barril != null ? String(p.preco_segundo_barril) : ""]))
  )
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string | null>>({})
  const [savedAtById, setSavedAtById] = useState<Record<string, number | null>>({})

  useEffect(() => {
    setProdutos(initialProdutos)
    setDrafts(Object.fromEntries(initialProdutos.map((p) => [p.id, p.preco_segundo_barril != null ? String(p.preco_segundo_barril) : ""])))
  }, [initialProdutos])

  const persist = async (produto: Produto, raw: string) => {
    const trimmed = raw.trim().replace(",", ".")
    const value = trimmed === "" ? null : Number(trimmed)

    const current = produto.preco_segundo_barril
    if (value === current) return
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setErrorById((prev) => ({ ...prev, [produto.id]: "Preco invalido" }))
      return
    }
    if (value !== null && value >= produto.preco_avista) {
      setErrorById((prev) => ({ ...prev, [produto.id]: "Deve ser menor que o preco a vista" }))
      return
    }

    setSavingId(produto.id)
    setErrorById((prev) => ({ ...prev, [produto.id]: null }))
    try {
      await updateProductSecondBarrelPrice(produto.id, value)
      setProdutos((prev) => prev.map((p) => (p.id === produto.id ? { ...p, preco_segundo_barril: value } : p)))
      setSavedAtById((prev) => ({ ...prev, [produto.id]: Date.now() }))
    } catch (err) {
      setErrorById((prev) => ({ ...prev, [produto.id]: err instanceof Error ? err.message : "Erro ao salvar" }))
    } finally {
      setSavingId(null)
    }
  }

  const clear = async (produto: Produto) => {
    setDrafts((prev) => ({ ...prev, [produto.id]: "" }))
    await persist(produto, "")
  }

  const renderRow = (produto: Produto) => {
    const draft = drafts[produto.id] ?? ""
    const error = errorById[produto.id] ?? null
    const savedAt = savedAtById[produto.id] ?? null
    const draftNum = draft.trim() === "" ? null : Number(draft.trim().replace(",", "."))
    const previewSavings = draftNum !== null && Number.isFinite(draftNum) && draftNum > 0 && draftNum < produto.preco_avista
      ? produto.preco_avista - draftNum
      : null

    return (
      <div
        key={produto.id}
        className="bg-brand-surface rounded-xl border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{produto.marca}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              produto.volume_litros === 30 ? "bg-cyan-500/15 text-cyan-400" : "bg-blue-500/15 text-blue-400"
            }`}>{produto.volume_litros}L</span>
            {produto.tipo === "vinho" && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-500/15 text-violet-400">vinho</span>
            )}
          </div>
          <p className="text-xs text-brand-warm-gray mt-1">
            1º barril: <span className="text-brand-gray-light">{formatBRL(produto.preco_avista)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 sm:w-auto">
          <div className="flex flex-col">
            <label htmlFor={`promo-${produto.id}`} className="text-[10px] uppercase tracking-wide text-brand-warm-gray mb-1">
              2º barril (R$)
            </label>
            <Input
              id={`promo-${produto.id}`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [produto.id]: e.target.value }))}
              onBlur={(e) => persist(produto, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  ;(e.target as HTMLInputElement).blur()
                }
                if (e.key === "Escape") {
                  setDrafts((prev) => ({ ...prev, [produto.id]: produto.preco_segundo_barril != null ? String(produto.preco_segundo_barril) : "" }))
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              placeholder="—"
              className="w-32"
            />
          </div>
          {produto.preco_segundo_barril != null && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => clear(produto)}
              disabled={savingId === produto.id}
              className="self-end text-xs text-brand-warm-gray hover:text-red-400 cursor-pointer underline-offset-2 hover:underline disabled:opacity-50"
            >
              limpar
            </motion.button>
          )}
        </div>

        <div className="text-xs text-right min-w-[120px]">
          {savingId === produto.id ? (
            <span className="text-brand-warm-gray">Salvando…</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : previewSavings !== null ? (
            <span className="text-green-400">desc. {formatBRL(previewSavings)}</span>
          ) : savedAt ? (
            <span className="text-green-400">salvo</span>
          ) : produto.preco_segundo_barril ? (
            <span className="text-brand-warm-gray">desc. {formatBRL(produto.preco_avista - produto.preco_segundo_barril)}</span>
          ) : (
            <span className="text-brand-warm-gray/60">sem promo</span>
          )}
        </div>
      </div>
    )
  }

  const produtos50 = produtos.filter((p) => p.volume_litros === 50)
  const produtos30 = produtos.filter((p) => p.volume_litros === 30)

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-6"
      >
        <h1 className="font-display text-3xl font-bold text-white tracking-wide">PROMOÇÕES</h1>
        <p className="text-sm text-brand-warm-gray mt-1">
          Defina o preço do 2º barril por produto. A partir do 2º barril do mesmo item, esse valor substitui o preço normal.
          Deixe em branco para desativar a promo.
        </p>
      </motion.div>

      {produtos50.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">BARRIS DE 50L</h2>
          <div className="space-y-3">{produtos50.map(renderRow)}</div>
        </section>
      )}

      {produtos30.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">BARRIS DE 30L</h2>
          <div className="space-y-3">{produtos30.map(renderRow)}</div>
        </section>
      )}

      {produtos.length === 0 && (
        <p className="text-sm text-brand-warm-gray">Nenhum produto ativo.</p>
      )}
    </div>
  )
}

export default PromocoesList
