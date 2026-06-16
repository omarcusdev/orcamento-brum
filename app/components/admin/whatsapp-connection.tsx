"use client"

import { useCallback, useEffect, useState } from "react"
import { Button, Input, Segmented, fieldLabelClass } from "@/components/ui"
import { formatPairedNumber } from "@/lib/whatsapp/connection-status"
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappConnection,
  type WhatsappConnection,
} from "@/lib/whatsapp/admin-actions"

const POLL_INTERVAL_MS = 3_000

const isPairing = (connection: WhatsappConnection) =>
  !connection.paired && (connection.qrDataUrl !== null || connection.code !== null)

const isIdle = (connection: WhatsappConnection) =>
  !connection.paired && connection.qrDataUrl === null && connection.code === null

type PairingMethod = "qr" | "code"

type WhatsAppConnectionProps = {
  initial: WhatsappConnection
  connection?: WhatsappConnection
  refresh?: () => Promise<void> | void
}

const WhatsAppConnection = ({
  initial,
  connection: controlled,
  refresh: refreshProp,
}: WhatsAppConnectionProps) => {
  const [local, setLocal] = useState(initial)
  const connection = controlled ?? local

  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<PairingMethod>("qr")
  const [phone, setPhone] = useState("")
  const [phoneError, setPhoneError] = useState(false)

  const refresh = useCallback(async () => {
    if (refreshProp) return void refreshProp()
    setLocal(await getWhatsappConnection())
  }, [refreshProp])

  useEffect(() => {
    if (controlled) return
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [controlled, refresh])

  const handleConnect = async (chosenMethod: PairingMethod) => {
    if (chosenMethod === "code" && !phone.trim()) {
      setPhoneError(true)
      return
    }
    setPhoneError(false)
    setBusy(true)
    await connectWhatsapp(chosenMethod, chosenMethod === "code" ? phone : undefined)
    await refresh()
    setBusy(false)
  }

  const handleDisconnect = async () => {
    setBusy(true)
    await disconnectWhatsapp()
    await refresh()
    setBusy(false)
  }

  const renderCorpo = () => {
    if (connection.status === "connected" && connection.paired) {
      return (
        <div className="space-y-5">
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
          <Button variant="danger" onClick={handleDisconnect} disabled={busy}>
            {busy ? "Desconectando..." : "Desconectar / trocar número"}
          </Button>
        </div>
      )
    }

    if (connection.paired) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-yellow/50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-yellow" />
            </span>
            <span className="text-brand-yellow font-medium">Reconectando…</span>
          </div>
          <p className="text-sm text-brand-warm-gray">
            A sessão caiu e está tentando voltar sozinha. {connection.me ? formatPairedNumber(connection.me) : ""}
          </p>
        </div>
      )
    }

    if (isPairing(connection)) {
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-warm-gray" />
            <span className="text-brand-gray-light font-medium">Aguardando pareamento…</span>
          </div>

          {connection.qrDataUrl ? (
            <>
              <div>
                <p className="text-white font-medium mb-1">Escaneie o QR code</p>
                <ol className="text-sm text-brand-warm-gray space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular que vai enviar as mensagens</li>
                  <li>Toque em Aparelhos conectados &rarr; Conectar um aparelho</li>
                  <li>Aponte a câmera para o QR abaixo</li>
                </ol>
              </div>
              <div className="flex justify-center">
                <img
                  src={connection.qrDataUrl}
                  alt="QR code para parear o WhatsApp"
                  width={280}
                  height={280}
                  className="rounded-lg bg-white p-2"
                />
              </div>
              <p className="text-xs text-brand-warm-gray text-center">
                O QR atualiza sozinho. Assim que o aparelho parear, o status muda para Conectado.
              </p>
            </>
          ) : (
            <>
              <div>
                <p className="text-white font-medium mb-1">Digite este código no WhatsApp</p>
                <ol className="text-sm text-brand-warm-gray space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no celular informado</li>
                  <li>Toque em Aparelhos conectados &rarr; Conectar um aparelho</li>
                  <li>Toque em Conectar com número de telefone</li>
                  <li>Digite o código abaixo</li>
                </ol>
              </div>
              <div className="flex justify-center">
                <p className="text-3xl font-mono font-bold tracking-[0.3em] text-brand-yellow">{connection.code}</p>
              </div>
            </>
          )}

          <Button variant="ghost" onClick={handleDisconnect} disabled={busy}>
            {busy ? "Cancelando..." : "Cancelar"}
          </Button>
        </div>
      )
    }

    if (connection.status === "connecting") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-warm-gray/50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-warm-gray" />
            </span>
            <span className="text-brand-gray-light font-medium">Iniciando pareamento…</span>
          </div>
          <p className="text-sm text-brand-warm-gray">Gerando o {method === "code" ? "código" : "QR code"}…</p>
          <Button variant="ghost" onClick={handleDisconnect} disabled={busy}>
            {busy ? "Cancelando..." : "Cancelar"}
          </Button>
        </div>
      )
    }

    // IDLE — não pareado, sem tentativa em andamento
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-3 w-3 rounded-full bg-brand-warm-gray" />
          <span className="text-brand-gray-light font-medium">Desconectado</span>
        </div>

        <div>
          <p className="text-white font-medium mb-1">Conecte o WhatsApp</p>
          <p className="text-sm text-brand-warm-gray">
            Escolha como parear o número que vai enviar as confirmações de pedido.
          </p>
        </div>

        <Segmented
          ariaLabel="Método de pareamento"
          value={method}
          onChange={setMethod}
          options={[
            { value: "qr", label: "Via QR code" },
            { value: "code", label: "Via código" },
          ]}
        />

        {method === "qr" ? (
          <Button variant="primary" onClick={() => handleConnect("qr")} disabled={busy}>
            {busy ? "Iniciando..." : "Conectar via QR"}
          </Button>
        ) : (
          <div className="space-y-2">
            <div>
              <label className={fieldLabelClass} htmlFor="whatsapp-phone">
                Número (com DDD)
              </label>
              <Input
                id="whatsapp-phone"
                type="tel"
                inputMode="numeric"
                placeholder="21 99999-9999"
                value={phone}
                invalid={phoneError}
                onChange={(e) => {
                  setPhone(e.target.value)
                  if (phoneError) setPhoneError(false)
                }}
              />
              {phoneError && <p className="text-xs text-red-400 mt-1">Informe o número do WhatsApp.</p>}
            </div>
            <Button variant="primary" onClick={() => handleConnect("code")} disabled={busy}>
              {busy ? "Gerando..." : "Gerar código"}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return renderCorpo()
}

export default WhatsAppConnection
