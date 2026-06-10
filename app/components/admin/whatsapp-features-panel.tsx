"use client"

import { useState, useTransition } from "react"
import { MessageSquare, BellRing, Send } from "lucide-react"
import { Switch } from "@/components/ui"
import { setWhatsappFeature, type WhatsappFeatures } from "@/lib/whatsapp/admin-actions"
import type { WhatsappFeatureKey } from "@/lib/whatsapp/features"

const NAO_FAZ =
  "Ele só responde sozinho com a saudação automática (painel abaixo), se você ligar — e NÃO traz o histórico antigo de conversas."

const formatNumero = (me: string | null): string | null => {
  if (!me) return null
  const d = me.replace(/\D/g, "")
  if (d.length >= 12) {
    const ddd = d.slice(2, 4)
    const resto = d.slice(4)
    const meio = resto.length === 9 ? `${resto.slice(0, 5)}-${resto.slice(5)}` : `${resto.slice(0, 4)}-${resto.slice(4)}`
    return `+55 (${ddd}) ${meio}`
  }
  return `+${d}`
}

type Row = {
  key: WhatsappFeatureKey
  field: keyof WhatsappFeatures
  icon: typeof MessageSquare
  titulo: string
  descricao: string
}

const ROWS: Row[] = [
  {
    key: "whatsapp_confirmacao_ativo",
    field: "confirmacao",
    icon: Send,
    titulo: "Confirmação automática de pedido",
    descricao: "Envia a mensagem de confirmação quando entra um pedido novo.",
  },
  {
    key: "whatsapp_atendimento_ativo",
    field: "atendimento",
    icon: MessageSquare,
    titulo: "Atendimento (receber e exibir mensagens)",
    descricao: "Captura as mensagens dos clientes e mostra o painel Conversas abaixo.",
  },
  {
    key: "whatsapp_alerta_ativo",
    field: "alerta",
    icon: BellRing,
    titulo: "Alerta por e-mail se a conexão cair",
    descricao: "Avisa por e-mail o endereço configurado quando o número desconectar.",
  },
]

type Props = {
  initial: WhatsappFeatures
  me: string | null
}

const WhatsappFeaturesPanel = ({ initial, me }: Props) => {
  const [features, setFeatures] = useState(initial)
  const [erro, setErro] = useState<keyof WhatsappFeatures | null>(null)
  const [, startTransition] = useTransition()
  const numero = formatNumero(me)

  const toggle = (row: Row, next: boolean) => {
    setErro(null)
    setFeatures((f) => ({ ...f, [row.field]: next })) // otimista
    startTransition(async () => {
      const { ok } = await setWhatsappFeature(row.key, next)
      if (!ok) {
        setFeatures((f) => ({ ...f, [row.field]: !next })) // rollback
        setErro(row.field)
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <ul className="divide-y divide-white/5">
        {ROWS.map((row) => {
          const Icon = row.icon
          const on = features[row.field]
          return (
            <li key={row.key} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{row.titulo}</p>
                <p className="text-xs text-brand-warm-gray mt-0.5">{row.descricao}</p>
                {erro === row.field && (
                  <p className="text-xs text-red-300 mt-1">Não consegui salvar. Tente de novo.</p>
                )}
              </div>
              <Switch
                id={row.key}
                checked={on}
                onChange={(next) => toggle(row, next)}
                aria-label={row.titulo}
              />
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
        {NAO_FAZ}
        {numero ? ` Pra testar o atendimento, peça pra alguém mandar um "oi" pro ${numero}.` : ""}
      </p>
    </div>
  )
}

export default WhatsappFeaturesPanel
