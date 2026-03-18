import type { PedidoStatusLog } from "@/lib/types"
import type { PedidoStatus } from "@/lib/types"
import { statusConfig } from "@/components/order-status-badge"

type OrderTimelineProps = {
  logs: PedidoStatusLog[]
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

const OrderTimeline = ({ logs }: OrderTimelineProps) => (
  <div className="space-y-4">
    {logs.map((log) => (
      <div key={log.id} className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-amber mt-1.5 shrink-0" />
        <div>
          <p className="font-medium text-sm text-white">
            {statusConfig[log.status_novo as PedidoStatus]?.label ?? log.status_novo}
          </p>
          <p className="text-xs text-brand-warm-gray">{formatDate(log.changed_at)}</p>
        </div>
      </div>
    ))}
  </div>
)

export default OrderTimeline
