"use client"

import { useState } from "react"
import { updateConfig } from "@/lib/admin-actions"
import { Button, Checkbox, Input } from "@/components/ui"

type ConfigFormProps = {
  whatsappNumero: string
  emailDestinatario: string
  emailAtivo: boolean
}

const ConfigForm = ({ whatsappNumero: initialWhatsapp, emailDestinatario: initialEmail, emailAtivo: initialEmailAtivo }: ConfigFormProps) => {
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp)
  const [email, setEmail] = useState(initialEmail)
  const [emailAtivo, setEmailAtivo] = useState(initialEmailAtivo)
  const [savingWhatsapp, setSavingWhatsapp] = useState(false)
  const [savedWhatsapp, setSavedWhatsapp] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savedEmail, setSavedEmail] = useState(false)

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingWhatsapp(true)
    setSavedWhatsapp(false)
    const cleaned = whatsapp.replace(/\D/g, "")
    await updateConfig("whatsapp_numero", cleaned)
    setWhatsapp(cleaned)
    setSavingWhatsapp(false)
    setSavedWhatsapp(true)
    setTimeout(() => setSavedWhatsapp(false), 3000)
  }

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEmail(true)
    setSavedEmail(false)
    const trimmed = email.trim()
    await Promise.all([
      updateConfig("email_notificacao_destinatario", trimmed),
      updateConfig("email_notificacao_ativo", emailAtivo ? "true" : "false"),
    ])
    setEmail(trimmed)
    setSavingEmail(false)
    setSavedEmail(true)
    setTimeout(() => setSavedEmail(false), 3000)
  }

  return (
    <div className="max-w-lg space-y-6">
      <form onSubmit={handleSaveWhatsapp}>
        <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
          <div>
            <h2 className="font-medium text-white mb-1">WhatsApp</h2>
            <p className="text-sm text-brand-warm-gray mb-3">
              Número exibido nos botões de WhatsApp da landing page. Use o formato com código do país (ex: 5521999999999).
            </p>
            <Input
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5521999999999"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={savingWhatsapp}>
              {savingWhatsapp ? "Salvando..." : "Salvar"}
            </Button>
            {savedWhatsapp && (
              <span className="text-green-400 text-sm font-medium">Salvo com sucesso!</span>
            )}
          </div>
        </div>
      </form>

      <form onSubmit={handleSaveEmail}>
        <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
          <div>
            <h2 className="font-medium text-white mb-1">Notificação de novo pedido</h2>
            <p className="text-sm text-brand-warm-gray mb-3">
              Email que recebe um aviso toda vez que um novo pedido for criado pelo cliente.
            </p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="financeiro@exemplo.com"
            />
          </div>
          <Checkbox
            checked={emailAtivo}
            onChange={(e) => setEmailAtivo(e.target.checked)}
            label={
              <>
                Notificações por email <span className="text-brand-warm-gray">— {emailAtivo ? "ativas" : "desativadas"}</span>
              </>
            }
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={savingEmail}>
              {savingEmail ? "Salvando..." : "Salvar"}
            </Button>
            {savedEmail && (
              <span className="text-green-400 text-sm font-medium">Salvo com sucesso!</span>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default ConfigForm
