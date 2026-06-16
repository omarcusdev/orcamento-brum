"use client"

import { MessageSquare, Send } from "lucide-react"
import { Switch } from "@/components/ui"
import type { WhatsappFeatures } from "@/lib/whatsapp/admin-actions"
import type { WhatsappFeatureKey } from "@/lib/whatsapp/features"

const NAO_FAZ =
  "As respostas automáticas vêm da saudação e do Atendente IA (ajustáveis abaixo). O histórico antigo de conversas NÃO é importado — só aparecem as mensagens a partir de quando o Atendimento foi ligado."

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
]

type Props = {
  features: WhatsappFeatures
  me: string | null
  erro: keyof WhatsappFeatures | null
  onToggle: (key: WhatsappFeatureKey, field: keyof WhatsappFeatures, next: boolean) => void
}

const WhatsappFeaturesPanel = ({ features, me, erro, onToggle }: Props) => {
  const numero = formatNumero(me)

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <MessageSquare className="h-5 w-5 shrink-0 text-brand-yellow" />
        <span className="font-medium text-white">Recursos</span>
      </div>
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
                onChange={(next) => onToggle(row.key, row.field, next)}
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
