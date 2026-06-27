"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Switch } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"

type FeaturePanelProps = {
  icon: ComponentType<{ className?: string }>
  title: string
  description: ReactNode
  on: boolean
  onToggle: (next: boolean) => void
  switchId: string
  error?: string | null
  collapseLabel?: ReactNode
  collapseHint?: ReactNode
  expanded?: boolean
  onToggleExpand?: () => void
  children?: ReactNode
}

export const FeaturePanel = ({
  icon: Icon,
  title,
  description,
  on,
  onToggle,
  switchId,
  error,
  collapseLabel,
  collapseHint,
  expanded,
  onToggleExpand,
  children,
}: FeaturePanelProps) => {
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">{description}</p>
        </div>
        <Switch id={switchId} checked={on} onChange={onToggle} aria-label={title} />
      </div>

      {on && children && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={toggleAberto}
            aria-expanded={aberto}
            className="flex w-full items-center gap-2 text-sm text-brand-warm-gray hover:text-white transition-colors"
          >
            {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="font-medium">{collapseLabel}</span>
            {collapseHint && <span className="text-xs text-brand-warm-gray/70">{collapseHint}</span>}
          </button>
          <Collapsible open={aberto}>{children}</Collapsible>
        </div>
      )}

      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  )
}
