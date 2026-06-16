// app/components/admin/whatsapp/config-drawer.tsx
"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { toggleSection, type SectionId } from "@/lib/whatsapp/accordion"
import type {
  WhatsappConnection,
  WhatsappFeatures,
  StatusEntregaConfig,
  LembreteConfig,
  BotSaudacaoConfig,
  AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import WhatsappFeaturesPanel from "@/components/admin/whatsapp-features-panel"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappStatusEntregaPanel from "@/components/admin/whatsapp-status-entrega-panel"
import WhatsappLembretePanel from "@/components/admin/whatsapp-lembrete-panel"
import WhatsappBotPanel from "@/components/admin/whatsapp-bot-panel"
import WhatsappAgentePanel from "@/components/admin/whatsapp-agente-panel"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"

type Props = {
  open: boolean
  onClose: () => void
  openSection: SectionId | null
  onOpenSection: (next: SectionId | null) => void
  connection: WhatsappConnection
  initialConnection: WhatsappConnection
  refresh: () => Promise<void> | void
  features: WhatsappFeatures
  onFeaturesChange: (f: WhatsappFeatures) => void
  statusEntrega: StatusEntregaConfig
  lembrete: LembreteConfig
  botSaudacao: BotSaudacaoConfig
  agente: AgenteConfig
  alertEmail: string
}

const ConfigDrawer = ({
  open, onClose, openSection, onOpenSection,
  connection, initialConnection, refresh,
  features, onFeaturesChange, statusEntrega, lembrete, botSaudacao, agente, alertEmail,
}: Props) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const toggle = (id: SectionId) => onOpenSection(toggleSection(openSection, id))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-brand-dark border-l border-white/10 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="font-display text-lg font-bold text-white tracking-wide">CONFIGURAÇÕES</h2>
              <button type="button" onClick={onClose} aria-label="Fechar configurações" className="text-brand-warm-gray hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <WhatsappFeaturesPanel
                initial={features} me={connection.me}
                expanded={openSection === "recursos"} onToggleExpand={() => toggle("recursos")}
                onFeaturesChange={onFeaturesChange}
              />
              <WhatsAppConnection
                initial={initialConnection} connection={connection} refresh={refresh}
                expanded={openSection === "conexao"} onToggleExpand={() => toggle("conexao")}
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
              <WhatsappAlertEmail
                initialEmail={alertEmail} disabled={!features.alerta}
                expanded={openSection === "alerta"} onToggleExpand={() => toggle("alerta")}
              />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConfigDrawer
