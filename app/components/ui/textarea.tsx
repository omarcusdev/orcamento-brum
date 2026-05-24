import type { TextareaHTMLAttributes } from "react"
import { inputBaseClass } from "./input"

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export const Textarea = ({ invalid = false, className, ...rest }: TextareaProps) => (
  <textarea
    {...rest}
    className={`${inputBaseClass} resize-none ${invalid ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/30" : "border-white/10 focus:border-brand-yellow/40 focus:ring-brand-yellow/30"} ${className ?? ""}`}
  />
)
