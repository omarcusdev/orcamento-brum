import { NextResponse } from "next/server"
import { runLembreteVespera } from "@/lib/whatsapp/lembrete"
import { runStatusRetry } from "@/lib/whatsapp/status-retry"

// Acordada 1x/hora pelo pg_cron via pg_net. Protegida por segredo (header x-cron-secret).
// O gate de horario e a flag do lembrete ficam dentro de runLembreteVespera. statusRetry
// piggyback no mesmo heartbeat horario — reusa o cron/secret existentes, sem infra nova.
export const POST = async (request: Request) => {
  const secret = process.env.LEMBRETE_CRON_SECRET

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const [lembrete, statusRetry] = await Promise.all([runLembreteVespera(), runStatusRetry()])
  return NextResponse.json({ ok: true, lembrete, statusRetry })
}
