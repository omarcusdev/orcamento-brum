import type { SelectHTMLAttributes } from "react"

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

const baseClass =
  "w-full px-3 py-2.5 pr-10 rounded-lg bg-brand-dark border border-white/10 text-sm text-white focus:border-brand-yellow/40 focus:ring-1 focus:ring-brand-yellow/30 outline-none transition disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22none%22%20stroke%3D%22%23B5AFA6%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m2%204%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat"

export const Select = ({ className, children, ...rest }: SelectProps) => (
  <select {...rest} className={`${baseClass} ${className ?? ""}`}>
    {children}
  </select>
)
