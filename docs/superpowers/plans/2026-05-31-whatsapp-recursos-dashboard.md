# WhatsApp — Dashboard de Recursos — Plano de Implementação

> **For agentic workers:** execute task-by-task. Cada task tem arquivos exatos e código completo. Sem placeholders.

**Goal:** Trocar o painel informativo do WhatsApp por um mini-dashboard de 3 interruptores (confirmação automática, atendimento, alerta) que controlam os recursos de verdade (server-side), com estado em `configuracoes` e fail-open.

**Architecture:** Flags booleanas (`'true'`/`'false'`) em `configuracoes`. Leitura admin via `requireAdmin` (página); gates server-to-server via `createServiceClient` (fail-open, default LIGADO). EC2 não muda.

**Tech Stack:** Next.js 15 App Router, Server Actions, Supabase (service + auth client), Tailwind v4, vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-whatsapp-recursos-dashboard-design.md`

---

## Task 1: Migração 023 — seed das flags

**Files:**
- Create: `supabase/migrations/023_whatsapp_feature_flags.sql`

- [ ] **Step 1: Escrever a migração (idempotente)**

```sql
-- WhatsApp feature flags (liga/desliga). Default LIGADO para preservar comportamento atual.
insert into configuracoes (chave, valor) values
  ('whatsapp_confirmacao_ativo', 'true'),
  ('whatsapp_atendimento_ativo', 'true'),
  ('whatsapp_alerta_ativo', 'true')
on conflict (chave) do nothing;
```

- [ ] **Step 2: Aplicar em STAGING** (`iwyijyxpkchibdryzkpn`) via Supabase MCP `apply_migration` (name: `whatsapp_feature_flags`). NÃO aplicar em prod.

- [ ] **Step 3: Verificar** — `select chave, valor from configuracoes where chave like 'whatsapp_%_ativo' order by chave;` → 3 linhas, todas `'true'`.

---

## Task 2: `features.ts` — chaves, parseFlag, leitura server-to-server

**Files:**
- Create: `app/lib/whatsapp/features.ts`
- Test: `app/lib/whatsapp/features.test.ts`

- [ ] **Step 1: Escrever o módulo**

```ts
import { createServiceClient } from "@/lib/supabase/service"

export const WHATSAPP_FEATURE_KEYS = [
  "whatsapp_confirmacao_ativo",
  "whatsapp_atendimento_ativo",
  "whatsapp_alerta_ativo",
] as const

export type WhatsappFeatureKey = (typeof WHATSAPP_FEATURE_KEYS)[number]

// Fail-open: só o literal "false" desliga; null/ausente/qualquer outra coisa = LIGADO.
export const parseFlag = (valor: string | null | undefined): boolean =>
  valor?.trim().toLowerCase() !== "false"

// Leitura para gates que rodam sem sessão de admin (webhook/notificações/alerta).
export const isWhatsappFeatureEnabled = async (chave: WhatsappFeatureKey): Promise<boolean> => {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", chave)
      .single()
    return parseFlag(data?.valor)
  } catch {
    return true // fail-open: nunca quebra o comportamento por causa de leitura de flag
  }
}
```

- [ ] **Step 2: Teste unit de `parseFlag`**

```ts
import { describe, it, expect } from "vitest"
import { parseFlag } from "./features"

describe("parseFlag", () => {
  it("'true' => true", () => expect(parseFlag("true")).toBe(true))
  it("'false' => false", () => expect(parseFlag("false")).toBe(false))
  it("'FALSE' (case) => false", () => expect(parseFlag("FALSE")).toBe(false))
  it("null => true (fail-open)", () => expect(parseFlag(null)).toBe(true))
  it("undefined => true (fail-open)", () => expect(parseFlag(undefined)).toBe(true))
  it("valor inesperado => true (fail-open)", () => expect(parseFlag("xyz")).toBe(true))
})
```

- [ ] **Step 3: Rodar** — `cd app && npx vitest run lib/whatsapp/features.test.ts` → 6 passam.

---

## Task 3: Primitivo `Switch` em `@/components/ui`

**Files:**
- Create: `app/components/ui/switch.tsx`
- Modify: `app/components/ui/index.ts`

- [ ] **Step 1: Criar o Switch** (espelha o padrão peer/acessível do `Checkbox`; trilho + bolinha, `brand-yellow` quando ligado)

```tsx
import type { InputHTMLAttributes } from "react"

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "onChange"> & {
  checked: boolean
  onChange: (checked: boolean) => void
}

export const Switch = ({ checked, onChange, disabled, className, id, ...rest }: SwitchProps) => (
  <label
    htmlFor={id}
    className={`relative inline-flex items-center ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className ?? ""}`}
  >
    <input
      {...rest}
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="peer sr-only"
    />
    <span className="h-6 w-11 rounded-full bg-white/15 peer-checked:bg-brand-yellow peer-focus-visible:ring-2 peer-focus-visible:ring-brand-yellow/50 transition-colors" />
    <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
  </label>
)
```

- [ ] **Step 2: Exportar no barrel** — em `app/components/ui/index.ts`, adicionar após a linha do Checkbox:

```ts
export { Switch } from "./switch"
```

---

## Task 4: Server actions — `getWhatsappFeatures` + `setWhatsappFeature`

**Files:**
- Modify: `app/lib/whatsapp/admin-actions.ts`

- [ ] **Step 1: Imports** — no topo, adicionar ao bloco de imports:

```ts
import {
  WHATSAPP_FEATURE_KEYS,
  parseFlag,
  type WhatsappFeatureKey,
} from "./features"
```

- [ ] **Step 2: Adicionar ao final do arquivo**

```ts
export type WhatsappFeatures = {
  confirmacao: boolean
  atendimento: boolean
  alerta: boolean
}

export const getWhatsappFeatures = async (): Promise<WhatsappFeatures> => {
  const { supabase } = await requireAdmin()

  const { data } = await supabase
    .from("configuracoes")
    .select("chave, valor")
    .in("chave", [...WHATSAPP_FEATURE_KEYS])

  const valorDe = (chave: WhatsappFeatureKey) =>
    parseFlag(data?.find((row) => row.chave === chave)?.valor)

  return {
    confirmacao: valorDe("whatsapp_confirmacao_ativo"),
    atendimento: valorDe("whatsapp_atendimento_ativo"),
    alerta: valorDe("whatsapp_alerta_ativo"),
  }
}

export const setWhatsappFeature = async (
  chave: WhatsappFeatureKey,
  ativo: boolean,
): Promise<{ ok: boolean }> => {
  if (!WHATSAPP_FEATURE_KEYS.includes(chave)) return { ok: false }

  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from("configuracoes")
    .update({ valor: String(ativo), updated_at: new Date().toISOString() })
    .eq("chave", chave)

  if (error) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}
```

---

## Task 5: Gate — confirmação automática

**Files:**
- Modify: `app/lib/whatsapp/notificacoes.ts`

- [ ] **Step 1: Import** — adicionar abaixo dos imports existentes:

```ts
import { isWhatsappFeatureEnabled } from "./features"
```

- [ ] **Step 2: Gate no topo de `sendCustomerWhatsAppConfirmation`** — a função hoje começa com `export const sendCustomerWhatsAppConfirmation = async (pedidoId: string) => {` seguido de `  try {`. Inserir ANTES do `try`:

```ts
export const sendCustomerWhatsAppConfirmation = async (pedidoId: string) => {
  if (!(await isWhatsappFeatureEnabled("whatsapp_confirmacao_ativo"))) return
  try {
```

---

## Task 6: Gate — atendimento (webhook inbound)

**Files:**
- Modify: `app/app/api/whatsapp/inbound/route.ts`

- [ ] **Step 1: Import** — adicionar:

```ts
import { isWhatsappFeatureEnabled } from "@/lib/whatsapp/features"
```

- [ ] **Step 2: Gate após validar o payload** (depois do bloco `if (!payload) {...}`, antes de `const supabase = createServiceClient()`):

```ts
  if (!(await isWhatsappFeatureEnabled("whatsapp_atendimento_ativo"))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = createServiceClient()
```

Retorna 200 (EC2 não re-tenta) e nada é gravado.

---

## Task 7: Gate — alerta por e-mail

**Files:**
- Modify: `app/app/api/whatsapp/alert/route.ts`

- [ ] **Step 1: Import** — adicionar:

```ts
import { isWhatsappFeatureEnabled } from "@/lib/whatsapp/features"
```

- [ ] **Step 2: Gate logo após a checagem do secret** (depois do bloco `if (!secret || ...) {...}`):

```ts
  if (!(await isWhatsappFeatureEnabled("whatsapp_alerta_ativo"))) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  try {
```

---

## Task 8: Componente do dashboard `WhatsappFeaturesPanel`

**Files:**
- Create: `app/components/admin/whatsapp-features-panel.tsx`

- [ ] **Step 1: Criar o componente** (client; switches otimistas com rollback; rodapé "o que NÃO faz" migrado do status-panel)

```tsx
"use client"

import { useState, useTransition } from "react"
import { MessageSquare, BellRing, Send } from "lucide-react"
import { Switch } from "@/components/ui"
import { setWhatsappFeature, type WhatsappFeatures } from "@/lib/whatsapp/admin-actions"
import type { WhatsappFeatureKey } from "@/lib/whatsapp/features"

const NAO_FAZ =
  "Ele NÃO responde sozinho (sem robô), NÃO traz o histórico antigo e NÃO avisa status de entrega."

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

type Row = {
  key: WhatsappFeatureKey
  field: keyof WhatsappFeatures
  icon: typeof MessageSquare
  titulo: string
  descricao: string
}

const ROWS: Row[] = [
  {
    key: "whatsapp_confirmacao_ativo",
    field: "confirmacao",
    icon: Send,
    titulo: "Confirmação automática de pedido",
    descricao: "Envia a mensagem de confirmação quando entra um pedido novo.",
  },
  {
    key: "whatsapp_atendimento_ativo",
    field: "atendimento",
    icon: MessageSquare,
    titulo: "Atendimento (receber e exibir mensagens)",
    descricao: "Captura as mensagens dos clientes e mostra o painel Conversas abaixo.",
  },
  {
    key: "whatsapp_alerta_ativo",
    field: "alerta",
    icon: BellRing,
    titulo: "Alerta por e-mail se a conexão cair",
    descricao: "Avisa por e-mail o endereço configurado quando o número desconectar.",
  },
]

type Props = {
  initial: WhatsappFeatures
  me: string | null
}

const WhatsappFeaturesPanel = ({ initial, me }: Props) => {
  const [features, setFeatures] = useState(initial)
  const [erro, setErro] = useState<keyof WhatsappFeatures | null>(null)
  const [, startTransition] = useTransition()
  const numero = formatNumero(me)

  const toggle = (row: Row, next: boolean) => {
    setErro(null)
    setFeatures((f) => ({ ...f, [row.field]: next })) // otimista
    startTransition(async () => {
      const { ok } = await setWhatsappFeature(row.key, next)
      if (!ok) {
        setFeatures((f) => ({ ...f, [row.field]: !next })) // rollback
        setErro(row.field)
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <ul className="divide-y divide-white/5">
        {ROWS.map((row) => {
          const Icon = row.icon
          const on = features[row.field]
          return (
            <li key={row.key} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${on ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{row.titulo}</p>
                <p className="text-xs text-brand-warm-gray mt-0.5">{row.descricao}</p>
                {erro === row.field && (
                  <p className="text-xs text-red-300 mt-1">Não consegui salvar. Tente de novo.</p>
                )}
              </div>
              <Switch
                id={row.key}
                checked={on}
                onChange={(next) => toggle(row, next)}
                aria-label={row.titulo}
              />
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
        {NAO_FAZ}
        {numero ? ` Pra testar o atendimento, peça pra alguém mandar um "oi" pro ${numero}.` : ""}
      </p>
    </div>
  )
}

export default WhatsappFeaturesPanel
```

---

## Task 9: `WhatsappAlertEmail` — prop `disabled`

**Files:**
- Modify: `app/components/admin/whatsapp-alert-email.tsx`

- [ ] **Step 1: Tipo + assinatura** — trocar:

```ts
type WhatsappAlertEmailProps = {
  initialEmail: string
}
```
por:
```ts
type WhatsappAlertEmailProps = {
  initialEmail: string
  disabled?: boolean
}
```
e a assinatura `const WhatsappAlertEmail = ({ initialEmail }: WhatsappAlertEmailProps) => {` por `({ initialEmail, disabled = false }: WhatsappAlertEmailProps) => {`.

- [ ] **Step 2: Esmaecer quando desligado** — trocar a abertura do form/card:

```tsx
    <form onSubmit={handleSubmit} className="max-w-lg">
      <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
```
por:
```tsx
    <form onSubmit={handleSubmit} className={`max-w-lg ${disabled ? "opacity-50 pointer-events-none" : ""}`} aria-disabled={disabled}>
      <div className="bg-brand-surface rounded-xl border border-white/10 p-6 space-y-4">
        {disabled && (
          <p className="text-xs text-brand-warm-gray">Alerta desligado — ligue o recurso em Recursos para editar.</p>
        )}
```
E no `<Input ... disabled={disabled} />` e `<Button type="submit" loading={saving} disabled={disabled}>`.

---

## Task 10: Wiring da página + gates de render

**Files:**
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`
- Delete: `app/components/admin/whatsapp-status-panel.tsx`

- [ ] **Step 1: Reescrever a página**

```tsx
import { getWhatsappAlertEmail, getWhatsappConnection, getWhatsappFeatures } from "@/lib/whatsapp/admin-actions"
import { getConversas } from "@/lib/whatsapp/chat-actions"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"
import WhatsappFeaturesPanel from "@/components/admin/whatsapp-features-panel"

export const dynamic = "force-dynamic"

const WhatsappPage = async () => {
  const [connection, features, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">WhatsApp</h1>

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">RECURSOS</h2>
          <WhatsappFeaturesPanel initial={features} me={connection.me} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
          <section>
            <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">CONEXAO</h2>
            <WhatsAppConnection initial={connection} />
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">ALERTA POR EMAIL</h2>
            <WhatsappAlertEmail initialEmail={alertEmail} disabled={!features.alerta} />
          </section>
        </div>

        <section>
          <h2 className="font-display text-lg font-bold text-white tracking-wide mb-1">CONVERSAS</h2>
          {features.atendimento ? (
            <>
              <p className="text-sm text-brand-warm-gray mb-4">
                As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
              </p>
              <AtendimentoClient initial={conversas} />
            </>
          ) : (
            <div className="bg-brand-surface rounded-xl border border-white/10 p-6 text-sm text-brand-warm-gray">
              Atendimento desligado — ligue o recurso <strong className="text-white">Atendimento</strong> acima para receber e ver mensagens.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default WhatsappPage
```

- [ ] **Step 2: Remover** `app/components/admin/whatsapp-status-panel.tsx` (substituído). Garantir que nada mais importa (`grep -r whatsapp-status-panel app/` deve voltar vazio).

---

## Task 11: Typecheck, deploy staging, E2E

- [ ] **Step 1: Typecheck** — `cd app && npx tsc --noEmit` → sem erros. (Evitar `next build` local: disco ~94% cheio.)
- [ ] **Step 2: Vitest** — `cd app && npx vitest run` → tudo verde.
- [ ] **Step 3: Commit + push** (gatilho do deploy de staging na Vercel). Incluir spec + plano + migração + código.
- [ ] **Step 4: E2E em staging** (browser MCP + Supabase MCP `iwyijyxpkchibdryzkpn`):
  - Abrir `/admin/whatsapp` → ver 3 switches LIGADOS, Conversas visível (com a conversa fixture `555192194386`), card de Alerta ativo.
  - Desligar **Atendimento** → Conversas vira placeholder; POST sintético no `/api/whatsapp/inbound` → `{skipped:true}`, `count(conversas_whatsapp)` inalterado. Religar → captura volta.
  - Desligar **Alerta** → card de e-mail esmaece; POST sintético no `/api/whatsapp/alert` → `{skipped:true}`, sem e-mail. Religar.
  - Desligar **Confirmação** → conferir `configuracoes.valor='false'`. (Envio real testado só se houver pedido de teste.)
  - Conferir persistência (reload mantém estado) e fail-open (apagar flag temporariamente → gate segue LIGADO → re-seed).

---

## Self-review
- Spec coverage: 3 toggles ✓, gates server-side ✓, fail-open ✓, atendimento OFF = drop+hide ✓, Switch novo ✓, rodapé "não faz" ✓, migração seed ✓.
- Sem placeholders; tipos consistentes (`WhatsappFeatureKey`, `WhatsappFeatures` usados igual em todos os pontos).
- EC2 intocado ✓.
