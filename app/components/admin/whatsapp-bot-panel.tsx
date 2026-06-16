"use client"

import { useState, useTransition } from "react"
import { Bot, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Select, Button } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"
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
  const [ativo, setAtivo] = useState(initial.ativo)
  const [janela, setJanela] = useState(initial.janelaHoras)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const trocarJanela = (next: number) => {
    setErro(null)
    setSalvo(false)
    const anterior = janela
    setJanela(next)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoJanela(next)
      if (!ok) {
        setJanela(anterior)
        setErro("Não consegui salvar a janela.")
      }
    })
  }

  const salvarMsg = () => {
    setErro(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(rascunho)
      if (ok) {
        const final = rascunho.trim() ? rascunho : DEFAULT_BOT_SAUDACAO_MSG
        setRascunho(final)
        setMensagem(final)
        setSalvo(true)
      } else {
        setErro("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = () => {
    setErro(null)
    setSalvo(false)
    setRascunho(DEFAULT_BOT_SAUDACAO_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappBotSaudacaoMessage(DEFAULT_BOT_SAUDACAO_MSG)
      if (ok) {
        setMensagem(DEFAULT_BOT_SAUDACAO_MSG)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Bot className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Saudação automática (bot)</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Responde com uma saudação automática quando o cliente escreve após um tempo sem falar com a gente (intervalo configurável). É uma mensagem fixa de boas-vindas. Requer o Atendimento ligado.
          </p>
        </div>
        <Switch
          id="whatsapp_bot_saudacao_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Saudação automática do bot"
        />
      </div>

      {ativo && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={toggleAberto}
            aria-expanded={aberto}
            className="flex w-full items-center gap-2 text-sm text-brand-warm-gray hover:text-white transition-colors"
          >
            {aberto ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <span className="font-medium">Mensagem e janela</span>
            <span className="text-xs text-brand-warm-gray/70">(após {labelJanela(janela)} parado)</span>
          </button>

          <Collapsible open={aberto}>
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
          </Collapsible>
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappBotPanel
