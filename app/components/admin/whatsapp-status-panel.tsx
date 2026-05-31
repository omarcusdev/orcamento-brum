const ATIVO = [
  "Envia a confirmação automática quando entra um pedido novo",
  "Recebe aqui as mensagens que os clientes mandarem pro número",
  "Você responde os clientes por aqui (em Conversas)",
]

const NAO_FAZ = [
  "Não responde os clientes sozinho — não há robô nem resposta automática",
  "Não traz o histórico antigo: só conversas novas, a partir de agora",
  "Não avisa status de entrega (saiu / entregue) — só a confirmação inicial do pedido",
]

const formatNumero = (me: string | null): string | null => {
  if (!me) return null
  const d = me.replace(/\D/g, "")
  if (d.length >= 12) {
    const ddd = d.slice(2, 4)
    const resto = d.slice(4)
    const meio = resto.length === 9 ? `${resto.slice(0, 5)}-${resto.slice(5)}` : `${resto.slice(0, 4)}-${resto.slice(4)}`
    return `+55 (${ddd}) ${meio}`
  }
  return `+${d}`
}

type WhatsappStatusPanelProps = {
  me: string | null
}

const WhatsappStatusPanel = ({ me }: WhatsappStatusPanelProps) => {
  const numero = formatNumero(me)

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-green-300 font-semibold mb-3">O que está ativo</p>
          <ul className="space-y-2">
            {ATIVO.map((texto) => (
              <li key={texto} className="flex gap-2 text-sm text-white">
                <span className="text-green-400 shrink-0">✓</span>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-red-300 font-semibold mb-3">O que NÃO faz</p>
          <ul className="space-y-2">
            {NAO_FAZ.map((texto) => (
              <li key={texto} className="flex gap-2 text-sm text-brand-warm-gray">
                <span className="text-red-400 shrink-0">✕</span>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
        ℹ️ As mensagens dos clientes aparecem em <strong className="text-white">Conversas</strong> assim que alguém mandar
        algo pro número{numero ? ` ${numero}` : " conectado"}. Pra testar agora, peça pra outra pessoa mandar um “oi”.
      </p>
    </div>
  )
}

export default WhatsappStatusPanel
