import type { InputHTMLAttributes } from "react"

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange"> & {
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Switch = ({ checked, onChange, disabled, className, id, ...rest }: SwitchProps) => (
  <label
    htmlFor={id}
    className={`relative inline-flex items-center ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className ?? ""}`}
  >
    <input
      {...rest}
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <span className="h-6 w-11 rounded-full bg-white/15 peer-checked:bg-brand-yellow peer-focus-visible:ring-2 peer-focus-visible:ring-brand-yellow/50 transition-colors" />
    <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
  </label>
)
