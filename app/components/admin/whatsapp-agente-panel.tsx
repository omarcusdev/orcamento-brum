"use client"

import { useState, useTransition } from "react"
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Button } from "@/components/ui"
import {
  setWhatsappAgenteFlag,
  setWhatsappAgenteFaq,
  type AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_AGENTE_FAQ } from "@/lib/whatsapp/bot-agente-kb"

type Props = { initial: AgenteConfig }

const WhatsappAgentePanel = ({ initial }: Props) => {
  const [ativo, setAtivo] = useState(initial.ativo)
  const [faq, setFaq] = useState(initial.faq)
  const [rascunho, setRascunho] = useState(initial.faq)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const salvarFaq = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_AGENTE_FAQ
        setRascunho(final)
        setFaq(final)
        setSalvo(true)
      } else {
        setErro("Não consegui salvar as informações.")
      }
    })
  }

  const restaurar = () => {
    setErro(null)
    setSalvo(false)
    setRascunho(DEFAULT_AGENTE_FAQ)
    startTransition(async () => {
      const { ok } = await setWhatsappAgenteFaq(DEFAULT_AGENTE_FAQ)
      if (ok) {
        setFaq(DEFAULT_AGENTE_FAQ)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Sparkles className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Atendente automático (IA)</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Responde sozinho às dúvidas dos clientes (cardápio, horário, pagamento). Quando ligado,
            substitui a saudação automática. Requer o Atendimento ligado.
          </p>
        </div>
        <Switch
          id="whatsapp_bot_agente_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Atendente automático (IA)"
        />
      </div>

      {ativo && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex w-full items-center gap-2 text-sm text-brand-warm-gray hover:text-white transition-colors"
          >
            {aberto ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">Informações que o atendente pode usar</span>
          </button>

          {aberto && (
            <div className="mt-4 space-y-4">
              <p className="text-xs text-brand-warm-gray">
                Horário, formas de pagamento, cobertura, como pedir. O cardápio e os preços vêm do
                catálogo automaticamente — não precisa repetir aqui.
              </p>
              <Textarea
                rows={6}
                value={rascunho}
                onChange={(e) => {
                  setRascunho(e.target.value)
                  setSalvo(false)
                }}
                aria-label="Informações do atendente"
              />
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={salvarFaq} disabled={rascunho === faq}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={restaurar}>
                  Restaurar padrão
                </Button>
                {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
              </div>
              <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
                O atendente nunca inventa preço ou prazo: quando não sabe, pede pra confirmar com a
                equipe. Suas respostas aparecem nas Conversas abaixo.
              </p>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappAgentePanel
