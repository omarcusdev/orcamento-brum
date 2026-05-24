"use client"

import { Minus, Plus } from "lucide-react"

type NumberStepperProps = {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  size?: "sm" | "md"
  ariaLabel?: string
}

export const NumberStepper = ({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  size = "md",
  ariaLabel = "Quantidade",
}: NumberStepperProps) => {
  const decrement = () => {
    const next = value - step
    if (next < min) return
    onChange(next)
  }

  const increment = () => {
    const next = value + step
    if (typeof max === "number" && next > max) return
    onChange(next)
  }

  const btnSize = size === "sm" ? "px-2 py-1" : "px-2.5 py-1.5"
  const valueSize = size === "sm" ? "px-2 text-xs min-w-[2ch]" : "px-3 text-sm min-w-[2.5ch]"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <div className="inline-flex items-center bg-brand-surface border border-white/10 rounded-md" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || value <= min}
        className={`${btnSize} text-brand-gray-light hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer rounded-l-md transition`}
        aria-label="Diminuir"
      >
        <Minus className={iconSize} strokeWidth={2.5} />
      </button>
      <span className={`${valueSize} font-semibold text-white tabular-nums text-center select-none`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={disabled || (typeof max === "number" && value >= max)}
        className={`${btnSize} text-brand-gray-light hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer rounded-r-md transition`}
        aria-label="Aumentar"
      >
        <Plus className={iconSize} strokeWidth={2.5} />
      </button>
    </div>
  )
}
