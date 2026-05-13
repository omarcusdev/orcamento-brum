import type { PedidoEditLog } from "@/lib/types"

type Props = {
  entries: PedidoEditLog[]
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return "—"
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return JSON.stringify(v)
}

const EditLog = ({ entries }: Props) => {
  if (entries.length === 0) return null

  return (
    <details className="bg-brand-surface rounded-xl border border-white/10 p-5">
      <summary className="font-display text-lg font-bold text-white tracking-wide cursor-pointer">
        HISTORICO DE EDICOES ({entries.length})
      </summary>
      <ul className="mt-3 space-y-2 text-xs">
        {entries.map((entry) => (
          <li key={entry.id} className="border-l-2 border-white/10 pl-3 py-1">
            <p className="text-brand-warm-gray">
              {new Date(entry.changed_at).toLocaleString("pt-BR")}
            </p>
            <p className="text-brand-gray-light">
              <span className="text-brand-yellow">{entry.field}</span>
              {" "}
              <span className="text-brand-warm-gray">de</span>
              {" "}
              <code className="text-red-300">{formatValue(entry.old_value)}</code>
              {" "}
              <span className="text-brand-warm-gray">para</span>
              {" "}
              <code className="text-green-300">{formatValue(entry.new_value)}</code>
            </p>
          </li>
        ))}
      </ul>
    </details>
  )
}

export default EditLog
