"use client"

import { useState, useTransition } from "react"
import { Sparkles } from "lucide-react"
import { Textarea, Button } from "@/components/ui"
import { FeaturePanel } from "@/components/admin/whatsapp/feature-panel"
import { useOptimisticFlag } from "@/lib/hooks/use-optimistic-flag"
import { setWhatsappAgenteFlag, setWhatsappAgenteFaq, type AgenteConfig } from "@/lib/whatsapp/admin-actions"
import { DEFAULT_AGENTE_FAQ } from "@/lib/whatsapp/bot-agente-kb"

type Props = { initial: AgenteConfig; expanded?: boolean; onToggleExpand?: () => void }

const WhatsappAgentePanel = ({ initial, expanded, onToggleExpand }: Props) => {
  const { on: ativo, toggle, error, setError } = useOptimisticFlag(initial.ativo, setWhatsappAgenteFlag)
  const [faq, setFaq] = useState(initial.faq)
  const [rascunho, setRascunho] = useState(initial.faq)
  const [salvo, setSalvo] = useState(false)
  const [, startTransition] = useTransition()

  const salvarFaq = () => {
    setError(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_AGENTE_FAQ
        setRascunho(final)
        setFaq(final)
        setSalvo(true)
      } else {
        setError("Não consegui salvar as informações.")
      }
    })
  }

  const restaurar = () => {
    setError(null)
    setSalvo(false)
    setRascunho(DEFAULT_AGENTE_FAQ)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(DEFAULT_AGENTE_FAQ)
      if (ok) {
        setFaq(DEFAULT_AGENTE_FAQ)
        setSalvo(true)
      } else {
        setError("Não consegui restaurar.")
      }
    })
  }

  return (
    <FeaturePanel
      icon={Sparkles}
      title="Atendente automático (IA)"
      description="Responde sozinho às dúvidas dos clientes (cardápio, horário, pagamento). Quando ligado, substitui a saudação automática. Requer o Atendimento ligado."
      on={ativo}
      onToggle={(next) => { setSalvo(false); toggle(next) }}
      switchId="whatsapp_bot_agente_ativo"
      error={error}
      collapseLabel="Informações que o atendente pode usar"
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mt-4 space-y-4">
        <p className="text-xs text-brand-warm-gray">
          Horário, formas de pagamento, cobertura, como pedir. O cardápio e os preços vêm do
          catálogo automaticamente — não precisa repetir aqui.
        </p>
        <Textarea
          rows={6}
          value={rascunho}
          onChange={(e) => { setRascunho(e.target.value); setSalvo(false) }}
          aria-label="Informações do atendente"
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={salvarFaq} disabled={rascunho === faq}>Salvar</Button>
          <Button variant="ghost" size="sm" onClick={restaurar}>Restaurar padrão</Button>
          {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
        </div>
        <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
          O atendente nunca inventa preço ou prazo: quando não sabe, pede pra confirmar com a
          equipe. Suas respostas aparecem nas Conversas abaixo.
        </p>
      </div>
    </FeaturePanel>
  )
}

export default WhatsappAgentePanel
