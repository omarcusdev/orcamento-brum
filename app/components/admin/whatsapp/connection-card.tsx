"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { WhatsappConnection } from "@/lib/whatsapp/admin-actions"
import { connectionStatus, formatPairedNumber, type ChipTom } from "@/lib/whatsapp/connection-status"
import Collapsible from "./collapsible"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"

type Props = {
  initial: WhatsappConnection
  connection: WhatsappConnection
  refresh: () => Promise<void> | void
  alertEmail: string
  alertaDisabled: boolean
}

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

// Conexão mora na própria tela (topo), como card colapsável: fechado mostra só o status;
// abre pra parear/trocar + configurar o alerta por e-mail (ambos são "saúde da conexão").
const ConnectionCard = ({ initial, connection, refresh, alertEmail, alertaDisabled }: Props) => {
  const [aberto, setAberto] = useState(false)
  const s = connectionStatus(connection)
  const numero = s.estado === "conectado" && connection.me ? formatPairedNumber(connection.me) : null
  const acao = aberto ? "Fechar" : s.acionavel ? "Conectar" : "Detalhes"

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {s.pulsar && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${DOT[s.tom]} opacity-60`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[s.tom]}`} />
        </span>
        <span className={`font-medium ${TEXTO[s.tom]}`}>{s.label}</span>
        {numero && <span className="text-sm text-brand-warm-gray hidden sm:inline">· {numero}</span>}
        <span className="ml-auto flex items-center gap-1 text-xs text-brand-warm-gray">
          {acao}
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      <Collapsible open={aberto}>
        <div className="px-5 pb-5 space-y-6">
          <WhatsAppConnection initial={initial} connection={connection} refresh={refresh} />
          <div className="border-t border-white/10 pt-5">
            <p className="text-sm font-medium text-white mb-3">Alerta por e-mail</p>
            <WhatsappAlertEmail initialEmail={alertEmail} disabled={alertaDisabled} />
          </div>
        </div>
      </Collapsible>
    </div>
  )
}

export default ConnectionCard
