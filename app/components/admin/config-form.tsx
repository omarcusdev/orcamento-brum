"use client"

import { useState } from "react"
import { updateConfig } from "@/lib/admin-actions"

type ConfigFormProps = {
  whatsappNumero: string
}

const ConfigForm = ({ whatsappNumero: initial }: ConfigFormProps) => {
  const [whatsapp, setWhatsapp] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const cleaned = whatsapp.replace(/\D/g, "")
    await updateConfig("whatsapp_numero", cleaned)

    setWhatsapp(cleaned)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form onSubmit={handleSave} className="max-w-lg">
      <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
        <div>
          <h2 className="font-medium text-white mb-1">WhatsApp</h2>
          <p className="text-sm text-brand-warm-gray mb-3">
            Número exibido nos botões de WhatsApp da landing page. Use o formato com código do país (ex: 5521999999999).
          </p>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="5521999999999"
            className="w-full px-4 py-3 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-white placeholder-brand-warm-gray"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-yellow text-brand-black font-bold px-6 py-2.5 rounded-lg hover:brightness-110 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {saved && (
            <span className="text-green-400 text-sm font-medium">Salvo com sucesso!</span>
          )}
        </div>
      </div>
    </form>
  )
}

export default ConfigForm
