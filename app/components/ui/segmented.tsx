type SegmentedOption<T extends string> = {
  value: T
  label: string
}

type SegmentedProps<T extends string> = {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  disabled?: boolean
  fullWidth?: boolean
  size?: "sm" | "md"
}

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  fullWidth = true,
  size = "md",
}: SegmentedProps<T>) => {
  const sizeClass = size === "sm" ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex ${fullWidth ? "w-full" : ""} rounded-lg bg-brand-dark border border-white/10 p-0.5`}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
            className={`flex-1 rounded-md font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${
              selected ? "bg-brand-yellow text-brand-black" : "text-brand-gray-light hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
