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
        <div className="w-3 h-3 rounded-full bg-brand-yellow mt-1.5 shrink-0" />
        <div>
          <p className="font-medium text-sm text-brand-black">
            {statusConfig[log.status_novo as PedidoStatus]?.label ?? log.status_novo}
          </p>
          <p className="text-xs text-gray-400">{formatDate(log.changed_at)}</p>
        </div>
      </div>
    ))}
  </div>
)

export default OrderTimeline
