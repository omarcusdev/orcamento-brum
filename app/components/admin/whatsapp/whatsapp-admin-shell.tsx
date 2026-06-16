// app/components/admin/whatsapp/whatsapp-admin-shell.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Settings } from "lucide-react"
import {
  getWhatsappConnection,
  type WhatsappConnection,
  type WhatsappFeatures,
  type StatusEntregaConfig,
  type LembreteConfig,
  type BotSaudacaoConfig,
  type AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import type { getConversas } from "@/lib/whatsapp/chat-actions"
import type { SectionId } from "@/lib/whatsapp/accordion"
import { Button } from "@/components/ui"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"
import ConnectionChip from "./connection-chip"
import ConfigDrawer from "./config-drawer"

const POLL_INTERVAL_MS = 3_000

type Props = {
  initialConnection: WhatsappConnection
  features: WhatsappFeatures
  statusEntrega: StatusEntregaConfig
  lembrete: LembreteConfig
  botSaudacao: BotSaudacaoConfig
  agente: AgenteConfig
  alertEmail: string
  conversas: Awaited<ReturnType<typeof getConversas>>
}

const WhatsappAdminShell = (props: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSection, setOpenSection] = useState<SectionId | null>(null)
  const [connection, setConnection] = useState(props.initialConnection)
  const [features, setFeatures] = useState(props.features)

  const refresh = useCallback(async () => {
    setConnection(await getWhatsappConnection())
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const abrirConfig = (section: SectionId | null = null) => {
    setOpenSection(section)
    setDrawerOpen(true)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-white mr-auto">WhatsApp</h1>
        <ConnectionChip connection={connection} onClick={() => abrirConfig("conexao")} />
        <Button variant="secondary" onClick={() => abrirConfig(null)}>
          <Settings className="h-4 w-4" /> Configurar
        </Button>
      </div>

      <section>
        {features.atendimento ? (
          <>
            <p className="text-sm text-brand-warm-gray mb-4">
              As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
            </p>
            <AtendimentoClient initial={props.conversas} />
          </>
        ) : (
          <div className="bg-brand-surface rounded-xl border border-white/10 p-6 text-sm text-brand-warm-gray">
            <p className="mb-4">
              Atendimento desligado — ligue o recurso <strong className="text-white">Atendimento</strong> para receber e ver mensagens.
            </p>
            <Button variant="secondary" onClick={() => abrirConfig("recursos")}>
              <Settings className="h-4 w-4" /> Abrir configurações
            </Button>
          </div>
        )}
      </section>

      <ConfigDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        openSection={openSection}
        onOpenSection={setOpenSection}
        connection={connection}
        initialConnection={props.initialConnection}
        refresh={refresh}
        features={features}
        onFeaturesChange={setFeatures}
        statusEntrega={props.statusEntrega}
        lembrete={props.lembrete}
        botSaudacao={props.botSaudacao}
        agente={props.agente}
        alertEmail={props.alertEmail}
      />
    </div>
  )
}

export default WhatsappAdminShell
