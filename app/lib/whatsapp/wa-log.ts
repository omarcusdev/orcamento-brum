import { CloudWatchLogsClient, PutLogEventsCommand, CreateLogStreamCommand } from "@aws-sdk/client-cloudwatch-logs"

// Centraliza os logs do agente IA (que roda no Vercel) no MESMO log group do EC2, pra ver tudo
// num lugar só no CloudWatch (/alfachopp/whatsapp-api). Estratégia:
//   - console.info SEMPRE (continua aparecendo nos Runtime Logs do Vercel);
//   - envia pro CloudWatch best-effort: NUNCA lança e NUNCA bloqueia o agente (fire-and-forget).
// Sem credenciais AWS (ex.: dev local) cai só no console. Usa as mesmas chaves já presentes em
// prod (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_REGION) — perfil com permissão de PutLogEvents.
const LOG_GROUP = "/alfachopp/whatsapp-api"
// Um stream por processo (sufixo aleatório) evita conflito de escrita concorrente entre instâncias.
const LOG_STREAM = `app-agente-${crypto.randomUUID().slice(0, 8)}`

let client: CloudWatchLogsClient | null | undefined
let streamReady: Promise<void> | null = null

const getClient = (): CloudWatchLogsClient | null => {
  if (client !== undefined) return client
  client = process.env.AWS_ACCESS_KEY_ID
    ? new CloudWatchLogsClient({ region: process.env.AWS_REGION ?? "us-east-1" })
    : null
  return client
}

const ensureStream = (c: CloudWatchLogsClient): Promise<void> => {
  streamReady ??= c
    .send(new CreateLogStreamCommand({ logGroupName: LOG_GROUP, logStreamName: LOG_STREAM }))
    .then(() => undefined)
    .catch(() => undefined) // já existe / erro -> segue (best-effort)
  return streamReady
}

// Envio best-effort pro CloudWatch: NUNCA lança e NUNCA bloqueia (fire-and-forget). Sem credencial
// AWS (dev local) é no-op. O `level` ("info"/"error") entra no JSON p/ filtrar no CloudWatch.
const ship = (level: "info" | "error", event: string, fields: Record<string, unknown>): void => {
  const c = getClient()
  if (!c) return
  void (async () => {
    try {
      await ensureStream(c)
      await c.send(
        new PutLogEventsCommand({
          logGroupName: LOG_GROUP,
          logStreamName: LOG_STREAM,
          logEvents: [{ timestamp: Date.now(), message: JSON.stringify({ level, event, ...fields }) }],
        }),
      )
    } catch {
      // best-effort: nunca quebra o agente por causa de log
    }
  })()
}

// Loga um evento do agente: prefixo [whatsapp] no console (continua nos Runtime Logs do Vercel) +
// envio best-effort pro CloudWatch. Use p/ eventos normais (decisões, latência, fluxo).
export const logWa = (event: string, fields: Record<string, unknown> = {}): void => {
  console.info(`[whatsapp] ${event}`, JSON.stringify(fields))
  ship("info", event, fields)
}

// Igual ao logWa, mas no nível de erro (console.error + level:"error" no CloudWatch).
export const logWaError = (event: string, fields: Record<string, unknown> = {}): void => {
  console.error(`[whatsapp] ${event}`, JSON.stringify(fields))
  ship("error", event, fields)
}

// Normaliza um erro qualquer (Error nativo, erro do Supabase `{ message }`, ou valor solto) num
// objeto de campos p/ o log estruturado — evita "[object Object]" e captura o nome quando há.
export const errInfo = (err: unknown): Record<string, unknown> => {
  if (err instanceof Error) return { erro: err.message, erroNome: err.name }
  if (err && typeof err === "object" && "message" in err) {
    return { erro: String((err as { message: unknown }).message) }
  }
  return { erro: String(err) }
}
