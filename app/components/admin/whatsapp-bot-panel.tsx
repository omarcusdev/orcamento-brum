"use client"

import { useState, useTransition } from "react"
import { Bot } from "lucide-react"
import { Textarea, Select, Button } from "@/components/ui"
import { FeaturePanel } from "@/components/admin/whatsapp/feature-panel"
import { useOptimisticFlag } from "@/lib/hooks/use-optimistic-flag"
import {
  setWhatsappBotSaudacaoFlag,
  setWhatsappBotSaudacaoJanela,
  setWhatsappBotSaudacaoMessage,
  type BotSaudacaoConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_BOT_SAUDACAO_MSG } from "@/lib/whatsapp/bot-saudacao-message"

type Props = { initial: BotSaudacaoConfig; expanded?: boolean; onToggleExpand?: () => void }

const JANELAS = [6, 12, 24, 48]
const labelJanela = (h: number) => (h >= 24 && h % 24 === 0 ? `${h / 24} dia${h > 24 ? "s" : ""}` : `${h}h`)

const WhatsappBotPanel = ({ initial, expanded, onToggleExpand }: Props) => {
  const { on: ativo, toggle, error, setError } = useOptimisticFlag(initial.ativo, setWhatsappBotSaudacaoFlag)
  const [janela, setJanela] = useState(initial.janelaHoras)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [salvo, setSalvo] = useState(false)
  const [, startTransition] = useTransition()

  // Optimistic update for the non-boolean janela: flip immediately, roll back on failure.
  const trocarJanela = (next: number) => {
    setError(null)
    setSalvo(false)
    const anterior = janela
    setJanela(next)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoJanela(next)
      if (!ok) {
        setJanela(anterior)
        setError("Não consegui salvar a janela.")
      }
    })
  }

  const salvarMsg = () => {
    setError(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_BOT_SAUDACAO_MSG
        setRascunho(final)
        setMensagem(final)
        setSalvo(true)
      } else {
        setError("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = () => {
    setError(null)
    setSalvo(false)
    setRascunho(DEFAULT_BOT_SAUDACAO_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(DEFAULT_BOT_SAUDACAO_MSG)
      if (ok) {
        setMensagem(DEFAULT_BOT_SAUDACAO_MSG)
        setSalvo(true)
      } else {
        setError("Não consegui restaurar.")
      }
    })
  }

  return (
    <FeaturePanel
      icon={Bot}
      title="Saudação automática (bot)"
      description="Responde com uma saudação automática quando o cliente escreve após um tempo sem falar com a gente (intervalo configurável). É uma mensagem fixa de boas-vindas. Requer o Atendimento ligado."
      on={ativo}
      onToggle={(next) => { setSalvo(false); toggle(next) }}
      switchId="whatsapp_bot_saudacao_ativo"
      error={error}
      collapseLabel="Mensagem e janela"
      collapseHint={`(após ${labelJanela(janela)} parado)`}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white shrink-0">Saudar após</span>
          <div className="w-32">
            <Select
              value={String(janela)}
              onChange={(e) => trocarJanela(Number(e.target.value))}
              aria-label="Janela de silêncio"
            >
              {JANELAS.map((h) => (
                <option key={h} value={String(h)}>
                  {labelJanela(h)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Textarea
          rows={3}
          value={rascunho}
          onChange={(e) => {
            setRascunho(e.target.value)
            setSalvo(false)
          }}
          aria-label="Mensagem da saudação"
        />

        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={salvarMsg} disabled={rascunho === mensagem}>
            Salvar
          </Button>
          <Button variant="ghost" size="sm" onClick={restaurar}>
            Restaurar padrão
          </Button>
          {salvo && <span className="text-xs text-green-300">Salvo ✓</span>}
        </div>

        <p className="text-xs text-brand-warm-gray border-t border-white/5 pt-3">
          Mensagem fixa (sem nome do cliente, porque pode ser um número sem cadastro). Inclua o
          link do site para o cliente fazer o pedido.
        </p>
      </div>
    </FeaturePanel>
  )
}

export default WhatsappBotPanel
