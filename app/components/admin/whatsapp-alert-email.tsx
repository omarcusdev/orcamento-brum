"use client"

import { useState } from "react"
import { setWhatsappAlertEmail } from "@/lib/whatsapp/admin-actions"
import { Button, Input } from "@/components/ui"

type WhatsappAlertEmailProps = {
  initialEmail: string
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const WhatsappAlertEmail = ({ initialEmail }: WhatsappAlertEmailProps) => {
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<"saved" | "erro" | null>(null)

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
    <form onSubmit={handleSubmit} className="max-w-lg">
      <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
        <p className="text-sm text-brand-warm-gray">
          Email que recebe o aviso quando a conexão do WhatsApp cair, para reconectar pelo painel.
        </p>
        <Input
          type="email"
          value={email}
          invalid={feedback === "erro"}
          onChange={(e) => {
            setEmail(e.target.value)
            if (feedback) setFeedback(null)
          }}
          placeholder="financeiro@exemplo.com"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
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
  )
}

export default WhatsappAlertEmail
