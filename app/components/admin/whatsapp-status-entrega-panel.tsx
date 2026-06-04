"use client"

import { useState, useTransition } from "react"
import { Truck, ChevronDown, ChevronRight } from "lucide-react"
import { Switch, Textarea, Button } from "@/components/ui"
import {
  setWhatsappStatusFlag,
  setWhatsappStatusMessage,
  type StatusEntregaConfig,
} from "@/lib/whatsapp/admin-actions"
import {
  STATUS_NOTIFY_STATUSES,
  STATUS_LABELS,
  DEFAULT_STATUS_MESSAGES,
  type NotifyStatus,
} from "@/lib/whatsapp/status-messages"

type Props = { initial: StatusEntregaConfig }

const WhatsappStatusEntregaPanel = ({ initial }: Props) => {
  const [master, setMaster] = useState(initial.master)
  const [porStatus, setPorStatus] = useState(initial.porStatus)
  const [rascunho, setRascunho] = useState<Record<NotifyStatus, string>>(
    () =>
      Object.fromEntries(
        STATUS_NOTIFY_STATUSES.map((s) => [s, initial.porStatus[s].mensagem]),
      ) as Record<NotifyStatus, string>,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<NotifyStatus | null>(null)
  // Mensagens ficam num collapse fechado: a feature nasce ligada e é raramente editada,
  // então o padrão é não empurrar o painel de Conversas (parte principal) pra baixo.
  const [aberto, setAberto] = useState(false)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setSalvo(null)
    setMaster(next)
    startTransition(async () => {
      const { ok } = await setWhatsappStatusFlag("master", next)
      if (!ok) {
        setMaster(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const toggleStatus = (s: NotifyStatus, next: boolean) => {
    setErro(null)
    setSalvo(null)
    setPorStatus((p) => ({ ...p, [s]: { ...p[s], ativo: next } }))
    startTransition(async () => {
      const { ok } = await setWhatsappStatusFlag(s, next)
      if (!ok) {
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], ativo: !next } }))
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const salvarMsg = (s: NotifyStatus) => {
    setErro(null)
    setSalvo(null)
    startTransition(async () => {
      const { ok } = await setWhatsappStatusMessage(s, rascunho[s])
      if (ok) {
        // texto vazio = servidor cai no padrao; espelhamos o mesmo comportamento localmente
        const final = rascunho[s].trim() ? rascunho[s] : DEFAULT_STATUS_MESSAGES[s]
        setRascunho((r) => ({ ...r, [s]: final }))
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], mensagem: final } }))
        setSalvo(s)
      } else {
        setErro("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = (s: NotifyStatus) => {
    setErro(null)
    setSalvo(null)
    setRascunho((r) => ({ ...r, [s]: DEFAULT_STATUS_MESSAGES[s] }))
    startTransition(async () => {
      const { ok } = await setWhatsappStatusMessage(s, DEFAULT_STATUS_MESSAGES[s])
      if (ok) {
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], mensagem: DEFAULT_STATUS_MESSAGES[s] } }))
        setSalvo(s)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Truck className={`h-5 w-5 mt-0.5 shrink-0 ${master ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Avisar status de entrega</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Manda mensagem automática quando o pedido muda de status. Escolha em quais status e edite cada texto.
          </p>
        </div>
        <Switch
          id="whatsapp_status_entrega_ativo"
          checked={master}
          onChange={toggleMaster}
          aria-label="Avisar status de entrega"
        />
      </div>

      {master && (
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
            <span className="font-medium">Mensagens por status</span>
            <span className="text-xs text-brand-warm-gray/70">
              ({STATUS_NOTIFY_STATUSES.filter((s) => porStatus[s].ativo).length} de {STATUS_NOTIFY_STATUSES.length} ligados)
            </span>
          </button>

          {aberto && (
            <>
              <ul className="mt-4 space-y-5">
                {STATUS_NOTIFY_STATUSES.map((s) => (
                  <li key={s} className="space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`text-sm font-medium ${porStatus[s].ativo ? "text-white" : "text-brand-warm-gray"}`}>
                        {STATUS_LABELS[s]}
                      </span>
                      <Switch
                        id={`whatsapp_status_${s}`}
                        checked={porStatus[s].ativo}
                        onChange={(next) => toggleStatus(s, next)}
                        aria-label={STATUS_LABELS[s]}
                      />
                    </div>
                    <Textarea
                      rows={3}
                      value={rascunho[s]}
                      onChange={(e) => {
                        const v = e.target.value
                        setRascunho((r) => ({ ...r, [s]: v }))
                        setSalvo(null)
                      }}
                      disabled={!porStatus[s].ativo}
                      aria-label={`Mensagem ${STATUS_LABELS[s]}`}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => salvarMsg(s)}
                        disabled={!porStatus[s].ativo || rascunho[s] === porStatus[s].mensagem}
                      >
                        Salvar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restaurar(s)}
                        disabled={!porStatus[s].ativo}
                      >
                        Restaurar padrão
                      </Button>
                      {salvo === s && <span className="text-xs text-green-300">Salvo ✓</span>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
                Use <code className="text-brand-yellow">{"{nome}"}</code> (primeiro nome) e{" "}
                <code className="text-brand-yellow">{"{pedido}"}</code> (nº do pedido) nas mensagens.
              </p>
            </>
          )}
        </div>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}
    </div>
  )
}

export default WhatsappStatusEntregaPanel
