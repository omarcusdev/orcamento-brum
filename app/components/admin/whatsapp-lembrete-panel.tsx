"use client"

import { useState, useTransition } from "react"
import { BellRing, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Select, Button } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"
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
  const [ativo, setAtivo] = useState(initial.ativo)
  const [hora, setHora] = useState(initial.hora)
  const [mensagem, setMensagem] = useState(initial.mensagem)
  const [rascunho, setRascunho] = useState(initial.mensagem)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  // Collapse fechado por default: a feature nasce ligada e e raramente editada, entao nao
  // empurramos o painel de Conversas (parte principal da tela) pra baixo.
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(false)
    setAtivo(next)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteFlag(next)
      if (!ok) {
        setAtivo(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const trocarHora = (next: number) => {
    setErro(null)
    setSalvo(false)
    const anterior = hora
    setHora(next)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteHora(next)
      if (!ok) {
        setHora(anterior)
        setErro("Não consegui salvar o horário.")
      }
    })
  }

  const salvarMsg = () => {
    setErro(null)
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
        setErro("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = () => {
    setErro(null)
    setSalvo(false)
    setRascunho(DEFAULT_LEMBRETE_MSG)
    startTransition(async () => {
      const { ok } = await setWhatsappLembreteMessage(DEFAULT_LEMBRETE_MSG)
      if (ok) {
        setMensagem(DEFAULT_LEMBRETE_MSG)
        setSalvo(true)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <BellRing className={`h-5 w-5 mt-0.5 shrink-0 ${ativo ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Lembrete na véspera</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Manda um lembrete automático no dia anterior à entrega, no horário escolhido.
          </p>
        </div>
        <Switch
          id="whatsapp_lembrete_vespera_ativo"
          checked={ativo}
          onChange={toggleMaster}
          aria-label="Lembrete na véspera"
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
            <span className="font-medium">Mensagem e horário</span>
            <span className="text-xs text-brand-warm-gray/70">(envia às {labelHora(hora)})</span>
          </button>

          <Collapsible open={aberto}>
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
          </Collapsible>
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappLembretePanel
