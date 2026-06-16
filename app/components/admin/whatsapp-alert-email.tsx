"use client"

import { useState } from "react"
import { Mail, ChevronDown, ChevronRight } from "lucide-react"
import { setWhatsappAlertEmail } from "@/lib/whatsapp/admin-actions"
import { Button, Input } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"

type WhatsappAlertEmailProps = {
  initialEmail: string
  disabled?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const WhatsappAlertEmail = ({ initialEmail, disabled = false, expanded, onToggleExpand }: WhatsappAlertEmailProps) => {
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<"saved" | "erro" | null>(null)
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setFeedback("erro")
      return
    }

    setSaving(true)
    const { ok } = await setWhatsappAlertEmail(trimmed)
    setSaving(false)

    if (!ok) {
      setFeedback("erro")
      return
    }

    setEmail(trimmed)
    setFeedback("saved")
    setTimeout(() => setFeedback(null), 3000)
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10">
      <button
        type="button"
        onClick={toggleAberto}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <Mail className={`h-5 w-5 shrink-0 ${disabled ? "text-brand-warm-gray" : "text-brand-yellow"}`} />
        <span className="flex-1 font-medium text-white">Alerta por e-mail</span>
        {aberto ? <ChevronDown className="h-4 w-4 text-brand-warm-gray" /> : <ChevronRight className="h-4 w-4 text-brand-warm-gray" />}
      </button>
      <Collapsible open={aberto}>
        <form onSubmit={handleSubmit} className={`px-6 pb-6 ${disabled ? "opacity-50 pointer-events-none" : ""}`} aria-disabled={disabled}>
          <div className="space-y-4">
            {disabled && (
              <p className="text-xs text-brand-warm-gray">Alerta desligado — ligue o recurso em Recursos para editar.</p>
            )}
            <p className="text-sm text-brand-warm-gray">
              Email que recebe o aviso quando a conexão do WhatsApp cair, para reconectar pelo painel.
            </p>
            <Input
              type="email"
              value={email}
              invalid={feedback === "erro"}
              disabled={disabled}
              onChange={(e) => {
                setEmail(e.target.value)
                if (feedback) setFeedback(null)
              }}
              placeholder="financeiro@exemplo.com"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={saving} disabled={disabled}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              {feedback === "saved" && (
                <span className="text-green-400 text-sm font-medium">Salvo com sucesso!</span>
              )}
              {feedback === "erro" && (
                <span className="text-red-300 text-sm font-medium">Informe um email válido.</span>
              )}
            </div>
          </div>
        </form>
      </Collapsible>
    </div>
  )
}

export default WhatsappAlertEmail
