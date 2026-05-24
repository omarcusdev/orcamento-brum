"use client"

import { useEffect, useState } from "react"
import { inputBaseClass } from "./input"

type MoneyInputProps = {
  value: number
  onChange: (next: number) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
  invalid?: boolean
  min?: number
  max?: number
  "aria-label"?: string
}

const formatBR = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const parseBR = (text: string): number => {
  const cleaned = text.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : NaN
}

export const MoneyInput = ({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  className,
  invalid = false,
  min,
  max,
  ...rest
}: MoneyInputProps) => {
  const [draft, setDraft] = useState(formatBR(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(formatBR(value))
  }, [value, focused])

  const stateClass = invalid
    ? "border-red-500/50 focus-within:border-red-500/60 focus-within:ring-red-500/30"
    : "border-white/10 focus-within:border-brand-yellow/40 focus-within:ring-brand-yellow/30"

  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-brand-warm-gray pointer-events-none">R$</span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          const parsed = parseBR(next)
          if (!Number.isNaN(parsed)) {
            let clamped = parsed
            if (typeof min === "number" && clamped < min) clamped = min
            if (typeof max === "number" && clamped > max) clamped = max
            onChange(clamped)
          }
        }}
        onBlur={() => {
          setFocused(false)
          setDraft(formatBR(value))
          onBlur?.()
        }}
        className={`${inputBaseClass} pl-10 focus:ring-1 ${stateClass} text-right tabular-nums`}
      />
    </div>
  )
}
