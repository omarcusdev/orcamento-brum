import type { InputHTMLAttributes } from "react"

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  invalid?: boolean
}

export const inputBaseClass =
  "w-full px-3 py-2.5 rounded-lg bg-brand-dark border text-sm text-white placeholder-brand-warm-gray/70 focus:ring-1 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"

const stateClass = {
  default: "border-white/10 focus:border-brand-yellow/40 focus:ring-brand-yellow/30",
  invalid: "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/30",
}

export const Input = ({ invalid = false, className, ...rest }: InputProps) => (
  <input
    {...rest}
    className={`${inputBaseClass} ${invalid ? stateClass.invalid : stateClass.default} ${className ?? ""}`}
  />
)
