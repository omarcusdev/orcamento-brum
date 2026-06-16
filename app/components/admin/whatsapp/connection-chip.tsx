// app/components/admin/whatsapp/connection-chip.tsx
"use client"

import type { WhatsappConnection } from "@/lib/whatsapp/admin-actions"
import { connectionStatus, formatPairedNumber, type ChipTom } from "@/lib/whatsapp/connection-status"

type Props = { connection: WhatsappConnection; onClick: () => void }

const DOT: Record<ChipTom, string> = {
  verde: "bg-green-400",
  amarelo: "bg-brand-yellow",
  cinza: "bg-brand-warm-gray",
  vermelho: "bg-red-400",
}

const TEXTO: Record<ChipTom, string> = {
  verde: "text-green-300",
  amarelo: "text-brand-yellow",
  cinza: "text-brand-gray-light",
  vermelho: "text-red-300",
}

const ConnectionChip = ({ connection, onClick }: Props) => {
  const s = connectionStatus(connection)
  const numero = s.estado === "conectado" && connection.me ? formatPairedNumber(connection.me) : null
  const label = s.acionavel ? `${s.label} — Conectar` : s.label

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-brand-surface px-3 py-1.5 text-sm hover:border-white/20 transition-colors"
      aria-label={`Status da conexão: ${s.label}. Abrir configurações de conexão.`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {s.pulsar && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${DOT[s.tom]} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[s.tom]}`} />
      </span>
      <span className={`font-medium ${TEXTO[s.tom]}`}>{label}</span>
      {numero && <span className="text-brand-warm-gray hidden sm:inline">· {numero}</span>}
    </button>
  )
}

export default ConnectionChip
