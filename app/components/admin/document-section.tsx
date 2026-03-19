"use client"

import { useState } from "react"
import { verifyDocument, getDocumentSignedUrl } from "@/lib/admin-actions"

type DocumentSectionProps = {
  clienteId: string
  pedidoId: string
  documentoStatus: string
  documentoPessoalUrl: string | null
  comprovanteResidenciaUrl: string | null
  documentoVerificado: boolean
  documentoVerificadoEm: string | null
}

const DocumentSection = ({
  clienteId,
  pedidoId,
  documentoStatus: initialStatus,
  documentoPessoalUrl,
  comprovanteResidenciaUrl,
  documentoVerificado,
  documentoVerificadoEm,
}: DocumentSectionProps) => {
  const [status, setStatus] = useState(initialStatus)
  const [verified, setVerified] = useState(documentoVerificado)
  const [verifiedAt, setVerifiedAt] = useState(documentoVerificadoEm)
  const [verifying, setVerifying] = useState(false)
  const [pessoalUrl, setPessoalUrl] = useState<string | null>(null)
  const [residenciaUrl, setResidenciaUrl] = useState<string | null>(null)
  const [loadingPessoal, setLoadingPessoal] = useState(false)
  const [loadingResidencia, setLoadingResidencia] = useState(false)

  const handleViewDocument = async (tipo: "pessoal" | "residencia") => {
    const setUrl = tipo === "pessoal" ? setPessoalUrl : setResidenciaUrl
    const setLoading = tipo === "pessoal" ? setLoadingPessoal : setLoadingResidencia
    setLoading(true)
    try {
      const url = await getDocumentSignedUrl(clienteId, tipo)
      setUrl(url)
    } catch {
      setUrl(null)
    }
    setLoading(false)
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await verifyDocument(clienteId, pedidoId)
      setVerified(true)
      setStatus("verificado")
      setVerifiedAt(new Date().toISOString())
    } catch { /* ignore */ }
    setVerifying(false)
  }

  if (status === "pendente") {
    return (
      <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTOS</h2>
        <p className="text-sm text-brand-warm-gray">Nenhum documento enviado pelo cliente</p>
      </div>
    )
  }

  const renderDocViewer = (
    label: string,
    hasUrl: boolean,
    signedUrl: string | null,
    isLoading: boolean,
    tipo: "pessoal" | "residencia"
  ) => (
    <div>
      <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-2">{label}</p>
      {!hasUrl ? (
        <p className="text-sm text-brand-warm-gray">Nao enviado</p>
      ) : signedUrl ? (
        <div>
          <img src={signedUrl} alt={label} className="max-h-48 rounded-lg border border-white/10" />
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-brand-yellow text-sm hover:underline mt-1 inline-block">
            Abrir em nova aba
          </a>
        </div>
      ) : (
        <button
          onClick={() => handleViewDocument(tipo)}
          disabled={isLoading}
          className="px-4 py-2 bg-brand-dark border border-white/10 rounded-lg text-sm text-brand-gray-light hover:border-brand-yellow/30 transition cursor-pointer disabled:opacity-50"
        >
          {isLoading ? "Carregando..." : "Ver documento"}
        </button>
      )}
    </div>
  )

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
      <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTOS</h2>

      {verified ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-green-500/30 bg-green-900/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-green-400 text-sm font-medium">
            Verificados {verifiedAt ? `em ${new Date(verifiedAt).toLocaleDateString("pt-BR")}` : ""}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {renderDocViewer("Documento pessoal", !!documentoPessoalUrl, pessoalUrl, loadingPessoal, "pessoal")}
          {renderDocViewer("Comprovante de residencia", !!comprovanteResidenciaUrl, residenciaUrl, loadingResidencia, "residencia")}
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition cursor-pointer disabled:opacity-50"
          >
            {verifying ? "Verificando..." : "Verificar documentos"}
          </button>
        </div>
      )}
    </div>
  )
}

export default DocumentSection
