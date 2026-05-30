"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui"
import { disconnectWhatsapp, getWhatsappConnection, type WhatsappConnection } from "@/lib/whatsapp/admin-actions"

const POLL_INTERVAL_MS = 3_000

const formatPairedNumber = (me: string) => {
  const digits = me.replace(/\D/g, "")
  if (digits.length >= 12) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const meio = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`
    return `+55 (${ddd}) ${meio}`
  }
  return `+${digits}`
}

type WhatsAppConnectionProps = {
  initial: WhatsappConnection
}

const WhatsAppConnection = ({ initial }: WhatsAppConnectionProps) => {
  const [connection, setConnection] = useState(initial)
  const [disconnecting, setDisconnecting] = useState(false)
  const consecutiveProblems = useRef(initial.status === "connected" ? 0 : 1)
  const [showHelp, setShowHelp] = useState(false)

  const refresh = useCallback(async () => {
    const next = await getWhatsappConnection()
    setConnection(next)

    if (next.status === "connected") {
      consecutiveProblems.current = 0
      setShowHelp(false)
    } else {
      consecutiveProblems.current += 1
      if (consecutiveProblems.current >= 5) setShowHelp(true)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await disconnectWhatsapp()
    await refresh()
    setDisconnecting(false)
  }

  if (connection.status === "connected") {
    return (
      <div className="max-w-lg">
        <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
            </span>
            <span className="text-green-300 font-medium">Conectado</span>
          </div>
          <div>
            <p className="text-sm text-brand-warm-gray mb-1">Número pareado</p>
            <p className="text-white font-medium">{connection.me ? formatPairedNumber(connection.me) : "—"}</p>
          </div>
          <p className="text-sm text-brand-warm-gray">
            As confirmações de pedido são enviadas por este número. Trocar de número exige parear o WhatsApp de novo.
          </p>
          <Button variant="danger" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? "Desconectando..." : "Desconectar / trocar número"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-warm-gray" />
          </span>
          <span className="text-brand-gray-light font-medium">
            {connection.status === "connecting" ? "Conectando..." : "Desconectado"}
          </span>
        </div>

        <div>
          <p className="text-white font-medium mb-1">Conecte o WhatsApp</p>
          <ol className="text-sm text-brand-warm-gray space-y-1 list-decimal list-inside">
            <li>Abra o WhatsApp no celular que vai enviar as mensagens</li>
            <li>Toque em Aparelhos conectados &rarr; Conectar um aparelho</li>
            <li>Aponte a câmera para o QR abaixo</li>
          </ol>
        </div>

        <div className="flex justify-center">
          {connection.qrDataUrl ? (
            <img
              src={connection.qrDataUrl}
              alt="QR code para parear o WhatsApp"
              width={280}
              height={280}
              className="rounded-lg bg-white p-2"
            />
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-brand-warm-gray">
              Gerando QR code...
            </div>
          )}
        </div>

        <p className="text-xs text-brand-warm-gray text-center">
          O QR atualiza sozinho. Assim que o aparelho parear, o status muda para Conectado.
        </p>

        {showHelp && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-300 font-medium mb-1">Não está conectando?</p>
            <p className="text-sm text-brand-warm-gray">
              Se o QR não funcionar depois de várias tentativas, o número pode ter sido bloqueado pelo WhatsApp.
              Nesse caso, use outro número para parear.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default WhatsAppConnection
