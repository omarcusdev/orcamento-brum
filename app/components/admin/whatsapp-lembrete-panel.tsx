"use client"

import { useState, useTransition } from "react"
import { BellRing } from "lucide-react"
import { Textarea, Select, Button } from "@/components/ui"
import { FeaturePanel } from "@/components/admin/whatsapp/feature-panel"
import { useOptimisticFlag } from "@/lib/hooks/use-optimistic-flag"
import {
  setWhatsappLembreteFlag,
  setWhatsappLembreteHora,
  setWhatsappLembreteMessage,
  type LembreteConfig,
} from "@/lib/whatsapp/admin-actions"
import { DEFAULT_LEMBRETE_MSG } from "@/lib/whatsapp/lembrete-message"

type Props = { initial: LembreteConfig; expanded?: boolean; onToggleExpand?: () => void }

const HORAS = Array.from({ length: 24 }, (_, h) => h)
const labelHora = (h: number) => `${String(h).padStart(2, "0")}:00`

const WhatsappLembretePanel = ({ initial, expanded, onToggleExpand }: Props) => {
  const { on: ativo, toggle, error, setError } = useOptimisticFlag(initial.ativo, setWhatsappLembreteFlag)
  const [hora, setHora] = useState(initial.hora)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [salvo, setSalvo] = useState(false)
  // Collapse fechado por default: a feature nasce ligada e é raramente editada, entao nao
  // empurramos o painel de Conversas (parte principal da tela) pra baixo.
  const [, startTransition] = useTransition()

  // Optimistic update for the non-boolean hora: flip immediately, roll back on failure.
  const trocarHora = (next: number) => {
    setError(null)
    setSalvo(false)
    const anterior = hora
    setHora(next)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteHora(next)
      if (!ok) {
        setHora(anterior)
        setError("Não consegui salvar o horário.")
      }
    })
  }

  const salvarMsg = () => {
    setError(null)
    setSalvo(false)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteMessage(rascunho)
      if (ok) {
        // texto vazio = servidor cai no padrao; espelhamos localmente
        const final = rascunho.trim() ? rascunho : DEFAULT_LEMBRETE_MSG
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
    setRascunho(DEFAULT_LEMBRETE_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteMessage(DEFAULT_LEMBRETE_MSG)
      if (ok) {
        setMensagem(DEFAULT_LEMBRETE_MSG)
        setSalvo(true)
      } else {
        setError("Não consegui restaurar.")
      }
    })
  }

  return (
    <FeaturePanel
      icon={BellRing}
      title="Lembrete na véspera"
      description="Manda um lembrete automático no dia anterior à entrega, no horário escolhido."
      on={ativo}
      onToggle={(next) => { setSalvo(false); toggle(next) }}
      switchId="whatsapp_lembrete_vespera_ativo"
      error={error}
      collapseLabel="Mensagem e horário"
      collapseHint={`(envia às ${labelHora(hora)})`}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="mt-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white shrink-0">Enviar às</span>
          <div className="w-32">
            <Select
              value={String(hora)}
              onChange={(e) => trocarHora(Number(e.target.value))}
              aria-label="Horário do lembrete"
            >
              {HORAS.map((h) => (
                <option key={h} value={String(h)}>
                  {labelHora(h)}
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
          aria-label="Mensagem do lembrete"
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
          Use <code className="text-brand-yellow">{"{nome}"}</code> (primeiro nome),{" "}
          <code className="text-brand-yellow">{"{pedido}"}</code> (nº),{" "}
          <code className="text-brand-yellow">{"{data}"}</code> (DD/MM) e{" "}
          <code className="text-brand-yellow">{"{horario}"}</code> (HH:MM).
        </p>
      </div>
    </FeaturePanel>
  )
}

export default WhatsappLembretePanel
