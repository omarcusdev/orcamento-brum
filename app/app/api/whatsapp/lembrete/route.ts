import { NextResponse } from "next/server"
import { runLembreteVespera } from "@/lib/whatsapp/lembrete"

// Acordada 1x/hora pelo pg_cron via pg_net. Protegida por segredo (header x-cron-secret).
// O gate de horario e a flag ficam dentro de runLembreteVespera.
export const POST = async (request: Request) => {
  const secret = process.env.LEMBRETE_CRON_SECRET

  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const result = await runLembreteVespera()
  return NextResponse.json({ ok: true, ...result })
}
