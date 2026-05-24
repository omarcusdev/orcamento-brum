import type { ButtonHTMLAttributes, ReactNode } from "react"

type Variant = "primary" | "secondary" | "ghost" | "ghost-yellow" | "danger" | "success"
type Size = "sm" | "md" | "lg"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const baseClass =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface disabled:opacity-50 disabled:cursor-not-allowed"

const variants: Record<Variant, string> = {
  primary: "bg-brand-yellow text-brand-black hover:bg-brand-amber active:brightness-95",
  secondary: "bg-brand-dark border border-white/10 text-white hover:border-white/30 hover:bg-white/5",
  ghost: "bg-transparent text-brand-gray-light hover:text-white hover:bg-white/5 border border-transparent",
  "ghost-yellow": "bg-brand-yellow/5 border border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/15 hover:border-brand-yellow/50",
  danger: "bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 hover:border-red-500/50",
  success: "bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 hover:border-green-500/50",
}

const sizes: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-5 py-3",
}

export const Button = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    disabled={disabled || loading}
    className={`${baseClass} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
  >
    {children}
  </button>
)
