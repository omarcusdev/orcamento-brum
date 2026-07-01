"use client"

import { useState } from "react"
import { RefreshCcw } from "lucide-react"
import AddressAutocomplete, { type AddressData } from "@/components/address-autocomplete"
import { Button } from "@/components/ui"

// Shared between the manual-order and edit-order drawers. Owns its own open state so the parent
// only deals with the selected AddressData. Class string matches the prior inline usage exactly.
const autocompleteInputClass =
  "w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 text-sm text-white placeholder-brand-warm-gray/70 focus:border-brand-yellow/40 focus:ring-1 focus:ring-brand-yellow/30 outline-none"

type Props = {
  onSelect: (addr: AddressData) => void
  openLabel: string
}

export const AddressSearchToggle = ({ onSelect, openLabel }: Props) => {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <div className="space-y-2 bg-brand-dark/50 border border-brand-yellow/20 rounded-lg p-2">
        <AddressAutocomplete
          onAddressSelect={(addr) => {
            onSelect(addr)
            setOpen(false)
          }}
          inputClassName={autocompleteInputClass}
        />
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar busca
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-[11px] text-brand-yellow/90 hover:text-brand-yellow uppercase tracking-wider cursor-pointer inline-flex items-center gap-1.5"
    >
      <RefreshCcw className="h-3 w-3" />
      {openLabel}
    </button>
  )
}
