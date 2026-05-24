import { Check } from "lucide-react"
import type { InputHTMLAttributes, ReactNode } from "react"

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = ({ label, description, checked, disabled, className, id, ...rest }: CheckboxProps) => (
  <label
    htmlFor={id}
    className={`group inline-flex items-start gap-2.5 text-sm ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className ?? ""}`}
  >
    <span className="relative inline-flex items-center justify-center mt-0.5">
      <input {...rest} id={id} type="checkbox" checked={checked} disabled={disabled} className="peer sr-only" />
      <span className="h-5 w-5 rounded-md border bg-brand-dark border-white/15 group-hover:border-white/30 peer-checked:bg-brand-yellow peer-checked:border-brand-yellow peer-focus-visible:ring-2 peer-focus-visible:ring-brand-yellow/50 transition" />
      <Check className="absolute h-3.5 w-3.5 text-brand-black opacity-0 peer-checked:opacity-100 transition pointer-events-none" strokeWidth={3} />
    </span>
    {(label || description) && (
      <span className="flex flex-col">
        {label && <span className="text-white leading-snug">{label}</span>}
        {description && <span className="text-xs text-brand-warm-gray leading-snug mt-0.5">{description}</span>}
      </span>
    )}
  </label>
)
