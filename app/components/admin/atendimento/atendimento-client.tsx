"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button, Segmented, Textarea } from "@/components/ui"
import {
  enviarRespostaChat,
  getConversaMensagens,
  getConversas,
  markConversaRead,
  type ConversaResumo,
  type MensagemChat,
} from "@/lib/whatsapp/chat-actions"
import { isTransbordoNotice } from "@/lib/whatsapp/transbordo"
import ThreadContexto from "@/components/admin/atendimento/thread-contexto"

const formatContato = (c: ConversaResumo) => c.nome ?? `+${c.telefone}`
const formatHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""

// Conteúdo de uma mensagem: mídia inline quando há URL assinada (bucket privado), senão o
// texto — que pode ser uma legenda ou o placeholder rotulado do EC2 ("🎤 Áudio recebido" etc.)
// quando os bytes não vieram (mídia grande/tipo sem suporte, ou payload antigo sem mídia).
const MidiaConteudo = ({ mensagem }: { mensagem: MensagemChat }) => {
  const { midiaTipo, midiaUrl, corpo } = mensagem
  if (midiaUrl) {
    if (midiaTipo === "image" || midiaTipo === "sticker") {
      // eslint-disable-next-line @next/next/no-img-element -- URL assinada efêmera; next/image não agrega aqui
      return <img src={midiaUrl} alt={corpo || "Imagem recebida"} className="rounded-lg max-w-full max-h-64 object-contain" />
    }
    if (midiaTipo === "audio") {
      return <audio controls src={midiaUrl} className="max-w-full" />
    }
    if (midiaTipo === "video") {
      return <video controls src={midiaUrl} className="rounded-lg max-w-full max-h-64" />
    }
    if (midiaTipo === "document") {
      return (
        <a href={midiaUrl} target="_blank" rel="noreferrer" className="underline break-all">
          {corpo || "Baixar documento"}
        </a>
      )
    }
  }
  return <>{corpo}</>
}

const AtendimentoClient = ({ initial }: { initial: ConversaResumo[] }) => {
  const searchParams = useSearchParams()
  const [conversas, setConversas] = useState(initial)
  const [selId, setSelId] = useState<string | null>(() => {
    const alvo = searchParams.get("conversa")
    if (alvo && initial.some((c) => c.id === alvo)) return alvo
    // Prioriza a primeira conversa de cliente; só cai numa de sistema se não houver nenhuma outra.
    const primeiraCliente = initial.find((c) => !c.sistema)
    return (primeiraCliente ?? initial[0])?.id ?? null
  })
  const [filtro, setFiltro] = useState<"clientes" | "sistema">(() => {
    const alvo = searchParams.get("conversa")
    const conversaAlvo = alvo ? initial.find((c) => c.id === alvo) : undefined
    if (conversaAlvo) return conversaAlvo.sistema ? "sistema" : "clientes"
    return initial.some((c) => !c.sistema) ? "clientes" : "sistema"
  })
  const [mensagens, setMensagens] = useState<MensagemChat[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(false)

  const sel = conversas.find((c) => c.id === selId) ?? null
  const conversasClientes = conversas.filter((c) => !c.sistema)
  const conversasSistema = conversas.filter((c) => c.sistema)
  const listaExibida = filtro === "sistema" ? conversasSistema : conversasClientes

  // A seleção atual lida dentro do handler do Realtime sem recriar a subscription.
  const selIdRef = useRef(selId)
  useEffect(() => {
    selIdRef.current = selId
  }, [selId])

  const threadRef = useRef<HTMLDivElement>(null)

  const refetchConversas = useCallback(async () => setConversas(await getConversas()), [])
  const refetchSelecionada = useCallback(async () => {
    const id = selIdRef.current
    if (id) setMensagens(await getConversaMensagens(id))
  }, [])

  // Uma única subscription estável pro ciclo de vida do componente (padrão de orders-list.tsx).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-atendimento")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas_whatsapp" }, () => {
        refetchConversas()
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_conversa_whatsapp" }, () => {
        refetchSelecionada()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetchConversas, refetchSelecionada])

  // Ao selecionar: carrega a thread e zera não-lidas (sem mandar "visto" pro WhatsApp).
  useEffect(() => {
    if (!selId) return
    getConversaMensagens(selId).then(setMensagens)
    markConversaRead(selId).then(refetchConversas)
  }, [selId, refetchConversas])

  // Mantém a thread rolada na última mensagem (no load e a cada nova).
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [mensagens])

  const handleSend = async () => {
    if (!selId || !texto.trim()) return
    setEnviando(true)
    setErroEnvio(false)
    try {
      const r = await enviarRespostaChat(selId, texto)
      if (r.ok) setTexto("")
      else setErroEnvio(true)
    } catch {
      setErroEnvio(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex gap-3 h-[70vh]">
      {/* Lista */}
      <div className="w-2/5 flex flex-col bg-brand-surface rounded-xl border border-white/10 overflow-hidden">
        <div className="p-2 border-b border-white/10 shrink-0">
          <Segmented
            value={filtro}
            onChange={setFiltro}
            ariaLabel="Filtrar conversas"
            size="sm"
            options={[
              { value: "clientes", label: `Clientes (${conversasClientes.length})` },
              { value: "sistema", label: `Sistema (${conversasSistema.length})` },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {listaExibida.length === 0 && (
            <p className="p-4 text-sm text-brand-warm-gray">
              {filtro === "sistema" ? "Nenhum aviso do sistema." : "Nenhuma conversa ainda."}
            </p>
          )}
          {listaExibida.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelId(c.id)}
              className={`w-full text-left p-3 transition cursor-pointer ${c.id === selId ? "bg-white/5" : "hover:bg-white/5"}`}
            >
              <div className="flex justify-between items-start">
                <span className="font-medium text-white">
                  {formatContato(c)} {c.nome === null && <span className="text-xs text-brand-warm-gray">· sem cadastro</span>}
                </span>
                <span className="text-xs text-brand-warm-gray">{formatHora(c.ultimaEm)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-brand-warm-gray truncate">{c.preview}</span>
                {c.naoLidas > 0 && (
                  <span className="ml-2 shrink-0 bg-brand-yellow text-brand-black text-xs font-bold rounded-full px-2">
                    {c.naoLidas}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col bg-brand-surface rounded-xl border border-white/10 p-4">
        {selId ? (
          <>
            {sel && <ThreadContexto conversa={sel} onVinculo={refetchConversas} />}
            <div ref={threadRef} className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3">
              {mensagens.map((m) => {
                // Avisos de transbordo (automação externa ecoada pro nosso número) não são
                // respostas nossas ao cliente — mostra como card neutro, não balão amarelo.
                if (m.direcao === "saida" && isTransbordoNotice(m.corpo)) {
                  return (
                    <div
                      key={m.id}
                      className="self-center max-w-[85%] px-3 py-2 rounded-lg text-xs text-center bg-white/5 border border-dashed border-white/15 text-brand-warm-gray"
                    >
                      <span className="block text-[10px] uppercase tracking-wider font-semibold text-brand-warm-gray/80 mb-1">
                        Aviso do sistema
                      </span>
                      <span className="whitespace-pre-wrap">{m.corpo}</span>
                      <span className="block text-[10px] opacity-60 mt-1">{formatHora(m.ocorridaEm)}</span>
                    </div>
                  )
                }
                return (
                  <div
                    key={m.id}
                    className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                      m.direcao === "saida"
                        ? "self-end bg-brand-yellow text-brand-black"
                        : "self-start bg-white/10 text-white"
                    }`}
                  >
                    <MidiaConteudo mensagem={m} />
                    <span className="block text-[10px] opacity-60 mt-1">{formatHora(m.ocorridaEm)}</span>
                  </div>
                )
              })}
            </div>
            {sel?.sistema ? (
              <p className="text-xs text-brand-warm-gray italic py-2">
                Aviso do sistema — conversa sem opção de resposta.
              </p>
            ) : (
              <>
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Responder…"
                    rows={2}
                    className="flex-1"
                  />
                  <Button variant="primary" onClick={handleSend} disabled={enviando || !texto.trim()}>
                    {enviando ? "Enviando…" : "Enviar"}
                  </Button>
                </div>
                {erroEnvio && (
                  <p className="text-xs text-red-400 mt-1">Falha ao enviar — verifique a conexão do WhatsApp e tente de novo.</p>
                )}
              </>
            )}
          </>
        ) : (
          <p className="m-auto text-brand-warm-gray">Selecione uma conversa.</p>
        )}
      </div>
    </div>
  )
}

export default AtendimentoClient
