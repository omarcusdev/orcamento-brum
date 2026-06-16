// app/components/admin/whatsapp/connection-modal.tsx
"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import type { WhatsappConnection } from "@/lib/whatsapp/admin-actions"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"

type Props = {
  open: boolean
  onClose: () => void
  initial: WhatsappConnection
  connection: WhatsappConnection
  refresh: () => Promise<void> | void
  alertEmail: string
  alertaDisabled: boolean
}

const ConnectionModal = ({ open, onClose, initial, connection, refresh, alertEmail, alertaDisabled }: Props) => {
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Conexão do WhatsApp"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-brand-dark border border-white/10 rounded-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-brand-dark">
              <h2 className="font-display text-lg font-bold text-white tracking-wide">CONEXÃO</h2>
              <button type="button" onClick={onClose} aria-label="Fechar" className="text-brand-warm-gray hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <WhatsAppConnection initial={initial} connection={connection} refresh={refresh} />
              <div className="border-t border-white/10 pt-6">
                <p className="text-sm font-medium text-white mb-3">Alerta por e-mail</p>
                <WhatsappAlertEmail initialEmail={alertEmail} disabled={alertaDisabled} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConnectionModal
