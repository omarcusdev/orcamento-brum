"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { verifyDocument, revertDocumentoVerificacao, getDocumentSignedUrlByPath, getDocumentSignedUrl } from "@/lib/admin-actions"

type DocumentSectionProps = {
  clienteId: string
  pedidoId: string
  documentoStatus: string
  documentoPessoalUrls: string[] | null
  comprovanteResidenciaUrl: string | null
  documentoVerificado: boolean
  documentoVerificadoEm: string | null
}

const DocumentSection = ({
  clienteId,
  pedidoId,
  documentoStatus: initialStatus,
  documentoPessoalUrls,
  comprovanteResidenciaUrl,
  documentoVerificado,
  documentoVerificadoEm,
}: DocumentSectionProps) => {
  const [status, setStatus] = useState(initialStatus)
  const [verified, setVerified] = useState(documentoVerificado)
  const [verifiedAt, setVerifiedAt] = useState(documentoVerificadoEm)
  const [verifying, setVerifying] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [pessoalSignedUrls, setPessoalSignedUrls] = useState<Record<string, string>>({})
  const [residenciaUrl, setResidenciaUrl] = useState<string | null>(null)
  const [loadingPessoal, setLoadingPessoal] = useState<string | null>(null)
  const [loadingResidencia, setLoadingResidencia] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)

  const handleViewPessoal = async (storagePath: string) => {
    setLoadingPessoal(storagePath)
    setDocError(null)
    try {
      const url = await getDocumentSignedUrlByPath(storagePath)
      setPessoalSignedUrls((prev) => ({ ...prev, [storagePath]: url }))
    } catch {
      setDocError("Erro ao carregar documento pessoal")
    }
    setLoadingPessoal(null)
  }

  const handleViewResidencia = async () => {
    setLoadingResidencia(true)
    setDocError(null)
    try {
      const url = await getDocumentSignedUrl(clienteId, "residencia")
      setResidenciaUrl(url)
    } catch {
      setDocError("Erro ao carregar comprovante de residencia")
    }
    setLoadingResidencia(false)
  }

  const handleRevertVerification = async () => {
    if (!confirm("Desfazer verificacao do documento? Sera necessario verificar novamente antes de avancar.")) return
    setReverting(true)
    setDocError(null)
    try {
      await revertDocumentoVerificacao(clienteId)
      setVerified(false)
      setVerifiedAt(null)
      setStatus("enviado")
    } catch {
      setDocError("Erro ao desfazer verificacao")
    }
    setReverting(false)
  }

  const handleVerify = async () => {
    setVerifying(true)
    setShowConfirmModal(false)
    try {
      await verifyDocument(clienteId, pedidoId)
      setVerified(true)
      setStatus("verificado")
      setVerifiedAt(new Date().toISOString())
    } catch {
      setDocError("Erro ao verificar documentos")
    }
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

  const renderResidenciaViewer = () => (
    <div>
      <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-2">Comprovante de residencia</p>
      {!comprovanteResidenciaUrl ? (
        <p className="text-sm text-brand-warm-gray">Nao enviado</p>
      ) : residenciaUrl ? (
        <div>
          <img src={residenciaUrl} alt="Comprovante de residencia" className="max-h-48 rounded-lg border border-white/10" />
          <a href={residenciaUrl} target="_blank" rel="noopener noreferrer" className="text-brand-yellow text-sm hover:underline mt-1 inline-block">
            Abrir em nova aba
          </a>
        </div>
      ) : (
        <button
          onClick={handleViewResidencia}
          disabled={loadingResidencia}
          className="px-4 py-2 bg-brand-dark border border-white/10 rounded-lg text-sm text-brand-gray-light hover:border-brand-yellow/30 transition cursor-pointer disabled:opacity-50"
        >
          {loadingResidencia ? "Carregando..." : "Ver documento"}
        </button>
      )}
    </div>
  )

  const renderPessoalViewer = () => {
    const urls = documentoPessoalUrls ?? []
    return (
      <div>
        <p className="text-xs text-brand-warm-gray uppercase tracking-wider mb-2">Documento de identidade</p>
        {urls.length === 0 ? (
          <p className="text-sm text-brand-warm-gray">Nao enviado</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {urls.map((path, idx) => {
              const signedUrl = pessoalSignedUrls[path]
              const isLoading = loadingPessoal === path
              return (
                <div key={path}>
                  {signedUrl ? (
                    <div>
                      <img src={signedUrl} alt={`Documento ${idx + 1}`} className="max-h-40 rounded-lg border border-white/10 w-full object-cover" />
                      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-brand-yellow text-xs hover:underline mt-1 inline-block">
                        Abrir em nova aba
                      </a>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleViewPessoal(path)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 bg-brand-dark border border-white/10 rounded-lg text-xs text-brand-gray-light hover:border-brand-yellow/30 transition cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "Carregando..." : `Ver foto ${idx + 1}`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
        <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">DOCUMENTOS</h2>

        {verified && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-md border border-green-500/30 bg-green-900/20 mb-4">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span className="text-green-400 text-sm font-medium">
                Verificados {verifiedAt ? `em ${new Date(verifiedAt).toLocaleDateString("pt-BR")}` : ""}
              </span>
            </div>
            <button
              onClick={handleRevertVerification}
              disabled={reverting}
              className="text-yellow-400 text-xs underline hover:text-yellow-300 disabled:opacity-50"
            >
              {reverting ? "..." : "Revisar de novo"}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {renderPessoalViewer()}
          {renderResidenciaViewer()}

          {docError && (
            <p className="text-red-400 text-sm">{docError}</p>
          )}

          {!verified && (
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={verifying}
              className="w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition cursor-pointer disabled:opacity-50"
            >
              {verifying ? "Verificando..." : "Verificar documentos"}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-brand-surface rounded-xl border border-white/10 p-6 max-w-sm w-full space-y-4"
            >
              <h3 className="font-display text-lg font-bold text-white">Confirmar verificacao</h3>
              <p className="text-sm text-brand-warm-gray">
                Tem certeza que deseja marcar os documentos como verificados? O pedido podera avancar apos esta acao.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2.5 border border-white/10 text-brand-gray-light rounded-lg text-sm hover:border-white/20 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleVerify}
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg text-sm hover:bg-green-700 transition cursor-pointer"
                >
                  Verificar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default DocumentSection
