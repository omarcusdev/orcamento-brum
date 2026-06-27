// app/components/admin/whatsapp/config-drawer.tsx
"use client"

import { toggleSection, type SectionId } from "@/lib/whatsapp/accordion"
import type {
  WhatsappConnection,
  WhatsappFeatures,
  StatusEntregaConfig,
  LembreteConfig,
  BotSaudacaoConfig,
  AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import type { WhatsappFeatureKey } from "@/lib/whatsapp/features"
import { Drawer } from "@/components/ui"
import WhatsappFeaturesPanel from "@/components/admin/whatsapp-features-panel"
import WhatsappStatusEntregaPanel from "@/components/admin/whatsapp-status-entrega-panel"
import WhatsappLembretePanel from "@/components/admin/whatsapp-lembrete-panel"
import WhatsappBotPanel from "@/components/admin/whatsapp-bot-panel"
import WhatsappAgentePanel from "@/components/admin/whatsapp-agente-panel"

type Props = {
  open: boolean
  onClose: () => void
  openSection: SectionId | null
  onOpenSection: (next: SectionId | null) => void
  connection: WhatsappConnection
  features: WhatsappFeatures
  featErro: keyof WhatsappFeatures | null
  onToggleFeature: (key: WhatsappFeatureKey, field: keyof WhatsappFeatures, next: boolean) => void
  statusEntrega: StatusEntregaConfig
  lembrete: LembreteConfig
  botSaudacao: BotSaudacaoConfig
  agente: AgenteConfig
}

const ConfigDrawer = ({
  open, onClose, openSection, onOpenSection,
  connection,
  features, featErro, onToggleFeature, statusEntrega, lembrete, botSaudacao, agente,
}: Props) => {
  const toggle = (id: SectionId) => onOpenSection(toggleSection(openSection, id))

  return (
    <Drawer open={open} onClose={onClose} title="CONFIGURAÇÕES" bg="dark">
      <div className="space-y-3">
        <WhatsappFeaturesPanel
          features={features}
          me={connection.me}
          erro={featErro}
          onToggle={onToggleFeature}
        />
        <WhatsappStatusEntregaPanel
          initial={statusEntrega}
          expanded={openSection === "status"} onToggleExpand={() => toggle("status")}
        />
        <WhatsappLembretePanel
          initial={lembrete}
          expanded={openSection === "lembrete"} onToggleExpand={() => toggle("lembrete")}
        />
        <WhatsappBotPanel
          initial={botSaudacao}
          expanded={openSection === "bot"} onToggleExpand={() => toggle("bot")}
        />
        <WhatsappAgentePanel
          initial={agente}
          expanded={openSection === "agente"} onToggleExpand={() => toggle("agente")}
        />
      </div>
    </Drawer>
  )
}

export default ConfigDrawer
