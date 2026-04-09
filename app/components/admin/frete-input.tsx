"use client"

import { useState } from "react"
import { updateFrete } from "@/lib/admin-actions"

type FreteInputProps = {
  pedidoId: string
  initialFrete: number
  readOnly: boolean
}

const FreteInput = ({ pedidoId, initialFrete, readOnly }: FreteInputProps) => {
  const [value, setValue] = useState(String(initialFrete || ""))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(false)

  const handleBlur = async () => {
    const parsed = parseFloat(value.replace(",", "."))
    if (isNaN(parsed) || parsed === initialFrete) return

    setSaving(true)
    setError(false)
    try {
      await updateFrete(pedidoId, parsed)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (readOnly) {
    return (
      <span className="font-medium text-white">
        {initialFrete > 0 ? `R$ ${initialFrete.toFixed(2).replace(".", ",")}` : "—"}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-brand-warm-gray text-sm">R$</span>
      <input
        type="text"
        data-frete-input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="0,00"
        className={`w-20 px-2 py-1 rounded border bg-brand-dark text-white text-sm text-right focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow/50 outline-none ${
          !value || value === "0" || value === "" ? "border-amber-500/60 ring-1 ring-amber-500/30" : "border-white/10"
        }`}
      />
      {saving && <span className="text-xs text-brand-warm-gray">...</span>}
      {saved && <span className="text-xs text-green-400">✓</span>}
      {error && <span className="text-xs text-red-400">✗</span>}
    </div>
  )
}

export default FreteInput
