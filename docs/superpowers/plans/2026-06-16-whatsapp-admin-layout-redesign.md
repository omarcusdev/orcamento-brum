# Redesign do layout /admin/whatsapp — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o inbox (Conversas) o protagonista de `/admin/whatsapp` e mover toda a configuração para um drawer lateral animado (acordeão, 1 seção aberta por vez), sem mudar nenhuma server action.

**Architecture:** Um client component `WhatsappAdminShell` (renderizado pelo server `page.tsx`) segura o estado de UI (drawer aberto, seção do acordeão, poll de conexão). O header mostra um chip de status + botão ⚙ que abre `ConfigDrawer` (padrão slide-in do `edit-order-drawer`). Os painéis de config existentes ficam dentro do drawer, ganhando props opcionais `expanded`/`onToggleExpand` (com fallback pra estado local, pra cada commit ficar verde) e um `<Collapsible>` compartilhado pra animar o corpo. Lógica testável isolada em módulos puros (`connection-status.ts`, `accordion.ts`).

**Tech Stack:** Next.js 16 (App Router, server/client components), React 19, TypeScript, Tailwind v4, framer-motion ^12, lucide-react, Vitest (node env).

**Convenções do projeto:** componentes novos do WhatsApp em `app/components/admin/whatsapp/`; primitivos de `@/components/ui`; cores `brand-*`; server actions inalteradas em `app/lib/whatsapp/admin-actions.ts`.

---

## Estrutura de arquivos

**Novos (puros / testáveis):**
- `app/lib/whatsapp/connection-status.ts` — `connectionStatus(c)` + `formatPairedNumber(me)`.
- `app/lib/whatsapp/accordion.ts` — `SectionId` + `toggleSection(atual, alvo)`.

**Novos (client):**
- `app/components/admin/whatsapp/collapsible.tsx` — reveal animado (framer-motion).
- `app/components/admin/whatsapp/connection-chip.tsx` — chip de status no header.
- `app/components/admin/whatsapp/config-drawer.tsx` — drawer slide-in + acordeão das 7 seções.
- `app/components/admin/whatsapp/whatsapp-admin-shell.tsx` — casca: header + inbox + drawer + poll de conexão.

**Modificados:**
- `app/components/admin/whatsapp-bot-panel.tsx`, `whatsapp-lembrete-panel.tsx`, `whatsapp-status-entrega-panel.tsx`, `whatsapp-agente-panel.tsx` — collapse vira `expanded`/`onToggleExpand` + `<Collapsible>`.
- `app/components/admin/whatsapp-features-panel.tsx` — ganha header-com-chevron + `<Collapsible>` + callback `onFeaturesChange`.
- `app/components/admin/whatsapp-alert-email.tsx` — ganha header-com-chevron + `<Collapsible>`.
- `app/components/admin/whatsapp-connection.tsx` — vira controlado (`connection`/`refresh` por prop) + accordion-ready; usa `formatPairedNumber` compartilhado.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — passa a renderizar `<WhatsappAdminShell .../>`.

---

## Task 1: Módulo puro `connection-status.ts`

**Files:**
- Create: `app/lib/whatsapp/connection-status.ts`
- Test: `app/lib/whatsapp/connection-status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/lib/whatsapp/connection-status.test.ts
import { describe, it, expect } from "vitest"
import { connectionStatus, formatPairedNumber } from "./connection-status"
import type { WhatsappConnection } from "./admin-actions"

const base: WhatsappConnection = { status: "disconnected", paired: false, qrDataUrl: null, code: null, me: null }

describe("connectionStatus", () => {
  it("conectado quando connected + paired", () => {
    const r = connectionStatus({ ...base, status: "connected", paired: true, me: "5521999998888" })
    expect(r.estado).toBe("conectado")
    expect(r.tom).toBe("verde")
    expect(r.pulsar).toBe(false)
    expect(r.acionavel).toBe(false)
  })

  it("reconectando quando paired mas não connected", () => {
    const r = connectionStatus({ ...base, status: "connecting", paired: true })
    expect(r.estado).toBe("reconectando")
    expect(r.tom).toBe("amarelo")
    expect(r.pulsar).toBe(true)
  })

  it("conectando/pareando quando há QR ou code e não pareado", () => {
    const r = connectionStatus({ ...base, qrDataUrl: "data:image/png;base64,xxx" })
    expect(r.estado).toBe("conectando")
    expect(r.tom).toBe("cinza")
    expect(r.pulsar).toBe(true)
  })

  it("desconectado quando idle (não pareado, sem tentativa)", () => {
    const r = connectionStatus(base)
    expect(r.estado).toBe("desconectado")
    expect(r.tom).toBe("vermelho")
    expect(r.acionavel).toBe(true)
  })
})

describe("formatPairedNumber", () => {
  it("formata E.164 BR em +55 (DD) 9XXXX-XXXX", () => {
    expect(formatPairedNumber("5521999998888")).toBe("+55 (21) 99999-8888")
  })
  it("número curto cai no fallback +digits", () => {
    expect(formatPairedNumber("12345")).toBe("+12345")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run lib/whatsapp/connection-status.test.ts`
Expected: FAIL — "Failed to resolve import ./connection-status".

- [ ] **Step 3: Write minimal implementation**

```ts
// app/lib/whatsapp/connection-status.ts
import type { WhatsappConnection } from "./admin-actions"

export type ChipEstado = "conectado" | "reconectando" | "conectando" | "desconectado"
export type ChipTom = "verde" | "amarelo" | "cinza" | "vermelho"

export type ChipStatus = {
  estado: ChipEstado
  label: string
  tom: ChipTom
  pulsar: boolean
  acionavel: boolean
}

// Espelha os ramos do WhatsAppConnection (status connected/paired/qr/code/idle).
export const connectionStatus = (c: WhatsappConnection): ChipStatus => {
  if (c.status === "connected" && c.paired) {
    return { estado: "conectado", label: "Conectado", tom: "verde", pulsar: false, acionavel: false }
  }
  if (c.paired) {
    return { estado: "reconectando", label: "Reconectando…", tom: "amarelo", pulsar: true, acionavel: false }
  }
  if (c.qrDataUrl !== null || c.code !== null || c.status === "connecting") {
    return { estado: "conectando", label: "Conectando…", tom: "cinza", pulsar: true, acionavel: false }
  }
  return { estado: "desconectado", label: "Desconectado", tom: "vermelho", pulsar: false, acionavel: true }
}

// Movido de whatsapp-connection.tsx pra ser reusado pelo chip (DRY).
export const formatPairedNumber = (me: string): string => {
  const digits = me.replace(/\D/g, "")
  if (digits.length >= 12) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const meio = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`
    return `+55 (${ddd}) ${meio}`
  }
  return `+${digits}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run lib/whatsapp/connection-status.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp/connection-status.ts app/lib/whatsapp/connection-status.test.ts
git commit -m "feat(whatsapp): connectionStatus puro p/ o chip de conexão"
```

---

## Task 2: Módulo puro `accordion.ts`

**Files:**
- Create: `app/lib/whatsapp/accordion.ts`
- Test: `app/lib/whatsapp/accordion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/lib/whatsapp/accordion.test.ts
import { describe, it, expect } from "vitest"
import { toggleSection } from "./accordion"

describe("toggleSection", () => {
  it("abre uma seção a partir de nada", () => {
    expect(toggleSection(null, "bot")).toBe("bot")
  })
  it("abrir outra fecha a anterior (1 aberta por vez)", () => {
    expect(toggleSection("recursos", "bot")).toBe("bot")
  })
  it("clicar na seção já aberta fecha (toggle)", () => {
    expect(toggleSection("bot", "bot")).toBe(null)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run lib/whatsapp/accordion.test.ts`
Expected: FAIL — "Failed to resolve import ./accordion".

- [ ] **Step 3: Write minimal implementation**

```ts
// app/lib/whatsapp/accordion.ts
export type SectionId = "recursos" | "conexao" | "status" | "lembrete" | "bot" | "agente" | "alerta"

// Acordeão: abrir uma fecha a anterior; clicar na aberta fecha.
export const toggleSection = (atual: SectionId | null, alvo: SectionId): SectionId | null =>
  atual === alvo ? null : alvo
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run lib/whatsapp/accordion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp/accordion.ts app/lib/whatsapp/accordion.test.ts
git commit -m "feat(whatsapp): reducer puro do acordeão (1 aberta por vez)"
```

---

## Task 3: `<Collapsible>` animado

**Files:**
- Create: `app/components/admin/whatsapp/collapsible.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/admin/whatsapp/collapsible.tsx
"use client"

import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"

type Props = { open: boolean; children: ReactNode }

// Reveal animado (altura + opacidade). overflow-hidden evita vazar conteúdo durante a animação.
const Collapsible = ({ open, children }: Props) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        key="content"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{ overflow: "hidden" }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)

export default Collapsible
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS (sem erros).

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp/collapsible.tsx
git commit -m "feat(whatsapp): <Collapsible> animado (framer-motion)"
```

---

## Task 4: `<ConnectionChip>` no header

**Files:**
- Create: `app/components/admin/whatsapp/connection-chip.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/admin/whatsapp/connection-chip.tsx
"use client"

import type { WhatsappConnection } from "@/lib/whatsapp/admin-actions"
import { connectionStatus, formatPairedNumber, type ChipTom } from "@/lib/whatsapp/connection-status"

type Props = { connection: WhatsappConnection; onClick: () => void }

const DOT: Record<ChipTom, string> = {
  verde: "bg-green-400",
  amarelo: "bg-brand-yellow",
  cinza: "bg-brand-warm-gray",
  vermelho: "bg-red-400",
}

const TEXTO: Record<ChipTom, string> = {
  verde: "text-green-300",
  amarelo: "text-brand-yellow",
  cinza: "text-brand-gray-light",
  vermelho: "text-red-300",
}

const ConnectionChip = ({ connection, onClick }: Props) => {
  const s = connectionStatus(connection)
  const numero = s.estado === "conectado" && connection.me ? formatPairedNumber(connection.me) : null
  const label = s.acionavel ? `${s.label} — Conectar` : s.label

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-brand-surface px-3 py-1.5 text-sm hover:border-white/20 transition-colors"
      aria-label={`Status da conexão: ${s.label}. Abrir configurações de conexão.`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {s.pulsar && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${DOT[s.tom]} opacity-60`} />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[s.tom]}`} />
      </span>
      <span className={`font-medium ${TEXTO[s.tom]}`}>{label}</span>
      {numero && <span className="text-brand-warm-gray hidden sm:inline">· {numero}</span>}
    </button>
  )
}

export default ConnectionChip
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp/connection-chip.tsx
git commit -m "feat(whatsapp): ConnectionChip de status no header"
```

---

## Task 5: Accordion-ready nos 4 painéis com collapse (bot, lembrete, status, agente)

Os 4 painéis já têm `const [aberto, setAberto] = useState(false)`, um botão com `onClick={() => setAberto((v) => !v)}` + `aria-expanded={aberto}`, e um bloco `{aberto && (<div…fields…>)}`. A transformação é idêntica nos 4.

**Files:**
- Modify: `app/components/admin/whatsapp-bot-panel.tsx`
- Modify: `app/components/admin/whatsapp-lembrete-panel.tsx`
- Modify: `app/components/admin/whatsapp-status-entrega-panel.tsx`
- Modify: `app/components/admin/whatsapp-agente-panel.tsx`

- [ ] **Step 1: Aplicar a transformação em cada um dos 4 arquivos**

Em **cada** arquivo, faça exatamente estas 5 mudanças:

(a) Importar o Collapsible (logo após os imports de `@/components/ui`):
```tsx
import Collapsible from "@/components/admin/whatsapp/collapsible"
```

(b) Estender o `type Props` com os controles opcionais do acordeão. Ex. no bot-panel:
```tsx
type Props = { initial: BotSaudacaoConfig; expanded?: boolean; onToggleExpand?: () => void }
```
(lembrete: `LembreteConfig`; status: `StatusEntregaConfig`; agente: `AgenteConfig`.)
E receber as props: `const WhatsappBotPanel = ({ initial, expanded, onToggleExpand }: Props) => {`

(c) Trocar o estado local por controle com fallback. Substituir a linha `const [aberto, setAberto] = useState(false)` por:
```tsx
const [abertoLocal, setAbertoLocal] = useState(false)
const aberto = expanded ?? abertoLocal
const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))
```

(d) No botão do collapse, trocar `onClick={() => setAberto((v) => !v)}` por `onClick={toggleAberto}`. (`aria-expanded={aberto}` e o `aberto ? <ChevronDown/> : <ChevronRight/>` continuam usando `aberto`.)

(e) Trocar o reveal `{aberto && (` … `)}` por `<Collapsible open={aberto}>` … `</Collapsible>`. Ex. no bot-panel, o bloco que hoje é:
```tsx
          {aberto && (
            <div className="mt-4 space-y-4">
              {/* …campos… */}
            </div>
          )}
```
vira:
```tsx
          <Collapsible open={aberto}>
            <div className="mt-4 space-y-4">
              {/* …campos… (inalterados) */}
            </div>
          </Collapsible>
```

> Nada da lógica de save/optimistic/rollback muda. O Switch master continua no header (visível sem expandir).

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Rodar os testes existentes desses painéis (regressão)**

Run: `cd app && npx vitest run`
Expected: PASS (suíte verde — a lógica testada não mudou).

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/whatsapp-bot-panel.tsx app/components/admin/whatsapp-lembrete-panel.tsx app/components/admin/whatsapp-status-entrega-panel.tsx app/components/admin/whatsapp-agente-panel.tsx
git commit -m "refactor(whatsapp): painéis com collapse viram accordion-ready (expanded/onToggleExpand + Collapsible)"
```

---

## Task 6: Accordion-ready em Recursos + Alerta (sem collapse hoje)

Esses dois não têm collapse. Vamos envolver o conteúdo num header-com-chevron + `<Collapsible>`, com as mesmas props opcionais (fallback local). O Recursos também ganha o callback `onFeaturesChange` pra o shell sincronizar a visibilidade do inbox quando o Atendimento liga/desliga.

**Files:**
- Modify: `app/components/admin/whatsapp-features-panel.tsx`
- Modify: `app/components/admin/whatsapp-alert-email.tsx`

- [ ] **Step 1: `whatsapp-features-panel.tsx`**

(a) Imports — adicionar:
```tsx
import { useState, useTransition, useEffect } from "react"
import { MessageSquare, BellRing, Send, ChevronDown, ChevronRight } from "lucide-react"
import Collapsible from "@/components/admin/whatsapp/collapsible"
```

(b) Props:
```tsx
type Props = {
  initial: WhatsappFeatures
  me: string | null
  expanded?: boolean
  onToggleExpand?: () => void
  onFeaturesChange?: (features: WhatsappFeatures) => void
}

const WhatsappFeaturesPanel = ({ initial, me, expanded, onToggleExpand, onFeaturesChange }: Props) => {
  const [features, setFeatures] = useState(initial)
  const [erro, setErro] = useState<keyof WhatsappFeatures | null>(null)
  const [, startTransition] = useTransition()
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))
  const numero = formatNumero(me)

  // Mantém o shell em sincronia (visibilidade do inbox depende de features.atendimento).
  useEffect(() => {
    onFeaturesChange?.(features)
  }, [features, onFeaturesChange])
```
(o `toggle(row, next)` interno fica inalterado.)

(c) Envolver o card num header + Collapsible. Trocar o `return (...)` por:
```tsx
  return (
    <div className="bg-brand-surface rounded-xl border border-white/10">
      <button
        type="button"
        onClick={toggleAberto}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <MessageSquare className="h-5 w-5 shrink-0 text-brand-yellow" />
        <span className="flex-1 font-medium text-white">Recursos</span>
        {aberto ? <ChevronDown className="h-4 w-4 text-brand-warm-gray" /> : <ChevronRight className="h-4 w-4 text-brand-warm-gray" />}
      </button>
      <Collapsible open={aberto}>
        <div className="px-6 pb-6">
          <ul className="divide-y divide-white/5">
            {/* …os <li> dos ROWS, inalterados… */}
          </ul>
          <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
            {NAO_FAZ}
            {numero ? ` Pra testar o atendimento, peça pra alguém mandar um "oi" pro ${numero}.` : ""}
          </p>
        </div>
      </Collapsible>
    </div>
  )
```
(O `<ul>…</ul>` com os `ROWS.map(...)` é exatamente o atual; só migrou pra dentro do `<Collapsible>` com o wrapper `px-6 pb-6`.)

- [ ] **Step 2: `whatsapp-alert-email.tsx`**

(a) Imports:
```tsx
import { useState } from "react"
import { Mail, ChevronDown, ChevronRight } from "lucide-react"
import { setWhatsappAlertEmail } from "@/lib/whatsapp/admin-actions"
import { Button, Input } from "@/components/ui"
import Collapsible from "@/components/admin/whatsapp/collapsible"
```

(b) Props + estado do collapse:
```tsx
type WhatsappAlertEmailProps = {
  initialEmail: string
  disabled?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}

const WhatsappAlertEmail = ({ initialEmail, disabled = false, expanded, onToggleExpand }: WhatsappAlertEmailProps) => {
  const [email, setEmail] = useState(initialEmail)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<"saved" | "erro" | null>(null)
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))
```
(o `handleSubmit` fica inalterado.)

(c) Trocar o `return (...)` (a `<form>` externa) por um wrapper com header + Collapsible:
```tsx
  return (
    <div className="bg-brand-surface rounded-xl border border-white/10">
      <button
        type="button"
        onClick={toggleAberto}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <Mail className={`h-5 w-5 shrink-0 ${disabled ? "text-brand-warm-gray" : "text-brand-yellow"}`} />
        <span className="flex-1 font-medium text-white">Alerta por e-mail</span>
        {aberto ? <ChevronDown className="h-4 w-4 text-brand-warm-gray" /> : <ChevronRight className="h-4 w-4 text-brand-warm-gray" />}
      </button>
      <Collapsible open={aberto}>
        <form onSubmit={handleSubmit} className={`px-6 pb-6 ${disabled ? "opacity-50 pointer-events-none" : ""}`} aria-disabled={disabled}>
          <div className="space-y-4">
            {disabled && (
              <p className="text-xs text-brand-warm-gray">Alerta desligado — ligue o recurso em Recursos para editar.</p>
            )}
            <p className="text-sm text-brand-warm-gray">
              Email que recebe o aviso quando a conexão do WhatsApp cair, para reconectar pelo painel.
            </p>
            {/* …o <Input> e os botões/feedbacks, inalterados… */}
          </div>
        </form>
      </Collapsible>
    </div>
  )
```
(O `<Input>` e o bloco de botões/feedback são exatamente os atuais.)

- [ ] **Step 3: Typecheck + testes**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/admin/whatsapp-features-panel.tsx app/components/admin/whatsapp-alert-email.tsx
git commit -m "refactor(whatsapp): Recursos e Alerta viram accordion-ready (header + Collapsible)"
```

---

## Task 7: `WhatsAppConnection` controlado + accordion-ready

Hoje o `WhatsAppConnection` faz o próprio poll (`useEffect` 3s) e tem `formatPairedNumber` local. Vamos: (1) usar o `formatPairedNumber` compartilhado; (2) aceitar `connection`/`refresh` por prop (com fallback ao poll próprio, pra não quebrar uso standalone); (3) adicionar header-com-chevron + `<Collapsible>`.

**Files:**
- Modify: `app/components/admin/whatsapp-connection.tsx`

- [ ] **Step 1: Imports + props controladas com fallback**

(a) Imports — remover o `formatPairedNumber` local e importar o compartilhado + Collapsible + ícones:
```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button, Input, Segmented, fieldLabelClass } from "@/components/ui"
import {
  connectWhatsapp,
  disconnectWhatsapp,
  getWhatsappConnection,
  type WhatsappConnection,
} from "@/lib/whatsapp/admin-actions"
import { formatPairedNumber } from "@/lib/whatsapp/connection-status"
import Collapsible from "@/components/admin/whatsapp/collapsible"
```
(apagar a função `const formatPairedNumber = (me: string) => {…}` local.)

(b) Props — receber estado opcional do shell:
```tsx
type WhatsAppConnectionProps = {
  initial: WhatsappConnection
  connection?: WhatsappConnection
  refresh?: () => Promise<void> | void
  expanded?: boolean
  onToggleExpand?: () => void
}

const WhatsAppConnection = ({ initial, connection: controlled, refresh: refreshProp, expanded, onToggleExpand }: WhatsAppConnectionProps) => {
  const [local, setLocal] = useState(initial)
  const connection = controlled ?? local
  const [busy, setBusy] = useState(false)
  const [method, setMethod] = useState<PairingMethod>("qr")
  const [phone, setPhone] = useState("")
  const [phoneError, setPhoneError] = useState(false)
  const [abertoLocal, setAbertoLocal] = useState(true)
  const aberto = expanded ?? abertoLocal
  const toggleAberto = onToggleExpand ?? (() => setAbertoLocal((v) => !v))

  const refresh = useCallback(async () => {
    if (refreshProp) return void refreshProp()
    setLocal(await getWhatsappConnection())
  }, [refreshProp])

  // Só pollar sozinho quando NÃO controlado (o shell cuida do poll no modo drawer).
  useEffect(() => {
    if (controlled) return
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [controlled, refresh])
```
(O resto — `handleConnect`/`handleDisconnect` e os ramos de render — continua, mas usando a variável `connection` derivada acima.)

(c) Envolver o conteúdo num header + Collapsible. O componente hoje retorna direto vários ramos (`if connected return …`); para acomodar o acordeão, extraia o conteúdo atual numa variável `corpo` (o JSX que já existe, sem o wrapper externo `max-w-lg`) e retorne:
```tsx
  return (
    <div className="bg-brand-surface rounded-xl border border-white/10">
      <button
        type="button"
        onClick={toggleAberto}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <span className="flex-1 font-medium text-white">Conexão</span>
        {aberto ? <ChevronDown className="h-4 w-4 text-brand-warm-gray" /> : <ChevronRight className="h-4 w-4 text-brand-warm-gray" />}
      </button>
      <Collapsible open={aberto}>
        <div className="px-6 pb-6">{corpo}</div>
      </Collapsible>
    </div>
  )
```
onde `corpo` é definido por uma função interna `renderCorpo()` que contém a árvore de ramos atual (connected / reconnecting / pairing / connecting / idle), **trocando** cada wrapper externo `<div className="max-w-lg"><div className="bg-brand-surface rounded-xl border border-white/10 p-6 …">…</div></div>` pelo conteúdo interno direto (sem o card duplo, já que o card agora é o wrapper do acordeão). Mantenha todo o comportamento (QR, código, conectar, desconectar).

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp-connection.tsx
git commit -m "refactor(whatsapp): WhatsAppConnection controlado + accordion-ready"
```

---

## Task 8: `ConfigDrawer`

**Files:**
- Create: `app/components/admin/whatsapp/config-drawer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/admin/whatsapp/config-drawer.tsx
"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { toggleSection, type SectionId } from "@/lib/whatsapp/accordion"
import type {
  WhatsappConnection,
  WhatsappFeatures,
  StatusEntregaConfig,
  LembreteConfig,
  BotSaudacaoConfig,
  AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import WhatsappFeaturesPanel from "@/components/admin/whatsapp-features-panel"
import WhatsAppConnection from "@/components/admin/whatsapp-connection"
import WhatsappStatusEntregaPanel from "@/components/admin/whatsapp-status-entrega-panel"
import WhatsappLembretePanel from "@/components/admin/whatsapp-lembrete-panel"
import WhatsappBotPanel from "@/components/admin/whatsapp-bot-panel"
import WhatsappAgentePanel from "@/components/admin/whatsapp-agente-panel"
import WhatsappAlertEmail from "@/components/admin/whatsapp-alert-email"

type Props = {
  open: boolean
  onClose: () => void
  openSection: SectionId | null
  onOpenSection: (next: SectionId | null) => void
  connection: WhatsappConnection
  initialConnection: WhatsappConnection
  refresh: () => Promise<void> | void
  features: WhatsappFeatures
  onFeaturesChange: (f: WhatsappFeatures) => void
  statusEntrega: StatusEntregaConfig
  lembrete: LembreteConfig
  botSaudacao: BotSaudacaoConfig
  agente: AgenteConfig
  alertEmail: string
}

const ConfigDrawer = ({
  open, onClose, openSection, onOpenSection,
  connection, initialConnection, refresh,
  features, onFeaturesChange, statusEntrega, lembrete, botSaudacao, agente, alertEmail,
}: Props) => {
  // Esc fecha; trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  const toggle = (id: SectionId) => onOpenSection(toggleSection(openSection, id))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-xl bg-brand-dark border-l border-white/10 flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="font-display text-lg font-bold text-white tracking-wide">CONFIGURAÇÕES</h2>
              <button type="button" onClick={onClose} aria-label="Fechar configurações" className="text-brand-warm-gray hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <WhatsappFeaturesPanel
                initial={features} me={connection.me}
                expanded={openSection === "recursos"} onToggleExpand={() => toggle("recursos")}
                onFeaturesChange={onFeaturesChange}
              />
              <WhatsAppConnection
                initial={initialConnection} connection={connection} refresh={refresh}
                expanded={openSection === "conexao"} onToggleExpand={() => toggle("conexao")}
              />
              <WhatsappStatusEntregaPanel
                initial={statusEntrega}
                expanded={openSection === "status"} onToggleExpand={() => toggle("status")}
              />
              <WhatsappLembretePanel
                initial={lembrete}
                expanded={openSection === "lembrete"} onToggleExpand={() => toggle("lembrete")}
              />
              <WhatsappBotPanel
                initial={botSaudacao}
                expanded={openSection === "bot"} onToggleExpand={() => toggle("bot")}
              />
              <WhatsappAgentePanel
                initial={agente}
                expanded={openSection === "agente"} onToggleExpand={() => toggle("agente")}
              />
              <WhatsappAlertEmail
                initialEmail={alertEmail} disabled={!features.alerta}
                expanded={openSection === "alerta"} onToggleExpand={() => toggle("alerta")}
              />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConfigDrawer
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp/config-drawer.tsx
git commit -m "feat(whatsapp): ConfigDrawer slide-in com acordeão das 7 seções"
```

---

## Task 9: `WhatsappAdminShell`

**Files:**
- Create: `app/components/admin/whatsapp/whatsapp-admin-shell.tsx`

- [ ] **Step 1: Write the component**

```tsx
// app/components/admin/whatsapp/whatsapp-admin-shell.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Settings } from "lucide-react"
import {
  getWhatsappConnection,
  type WhatsappConnection,
  type WhatsappFeatures,
  type StatusEntregaConfig,
  type LembreteConfig,
  type BotSaudacaoConfig,
  type AgenteConfig,
} from "@/lib/whatsapp/admin-actions"
import type { getConversas } from "@/lib/whatsapp/chat-actions"
import type { SectionId } from "@/lib/whatsapp/accordion"
import { Button } from "@/components/ui"
import AtendimentoClient from "@/components/admin/atendimento/atendimento-client"
import ConnectionChip from "./connection-chip"
import ConfigDrawer from "./config-drawer"

const POLL_INTERVAL_MS = 3_000

type Props = {
  initialConnection: WhatsappConnection
  features: WhatsappFeatures
  statusEntrega: StatusEntregaConfig
  lembrete: LembreteConfig
  botSaudacao: BotSaudacaoConfig
  agente: AgenteConfig
  alertEmail: string
  conversas: Awaited<ReturnType<typeof getConversas>>
}

const WhatsappAdminShell = (props: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openSection, setOpenSection] = useState<SectionId | null>(null)
  const [connection, setConnection] = useState(props.initialConnection)
  const [features, setFeatures] = useState(props.features)

  const refresh = useCallback(async () => {
    setConnection(await getWhatsappConnection())
  }, [])

  useEffect(() => {
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  const abrirConfig = (section: SectionId | null = null) => {
    setOpenSection(section)
    setDrawerOpen(true)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="font-display text-2xl font-bold text-white mr-auto">WhatsApp</h1>
        <ConnectionChip connection={connection} onClick={() => abrirConfig("conexao")} />
        <Button variant="secondary" onClick={() => abrirConfig(null)}>
          <Settings className="h-4 w-4" /> Configurar
        </Button>
      </div>

      <section>
        {features.atendimento ? (
          <>
            <p className="text-sm text-brand-warm-gray mb-4">
              As conversas aparecem a partir de quando o atendimento foi ligado — o histórico anterior continua no celular.
            </p>
            <AtendimentoClient initial={props.conversas} />
          </>
        ) : (
          <div className="bg-brand-surface rounded-xl border border-white/10 p-6 text-sm text-brand-warm-gray">
            <p className="mb-4">
              Atendimento desligado — ligue o recurso <strong className="text-white">Atendimento</strong> para receber e ver mensagens.
            </p>
            <Button variant="secondary" onClick={() => abrirConfig("recursos")}>
              <Settings className="h-4 w-4" /> Abrir configurações
            </Button>
          </div>
        )}
      </section>

      <ConfigDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        openSection={openSection}
        onOpenSection={setOpenSection}
        connection={connection}
        initialConnection={props.initialConnection}
        refresh={refresh}
        features={features}
        onFeaturesChange={setFeatures}
        statusEntrega={props.statusEntrega}
        lembrete={props.lembrete}
        botSaudacao={props.botSaudacao}
        agente={props.agente}
        alertEmail={props.alertEmail}
      />
    </div>
  )
}

export default WhatsappAdminShell
```

> Se `Button` não aceitar `variant="secondary"` ou não renderizar ícone+texto, ajuste para as variantes reais de `@/components/ui` (checar `button.tsx`); o resto não muda.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/components/admin/whatsapp/whatsapp-admin-shell.tsx
git commit -m "feat(whatsapp): WhatsappAdminShell (inbox protagonista + chip + drawer)"
```

---

## Task 10: Trocar `page.tsx` para renderizar o shell

**Files:**
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`

- [ ] **Step 1: Reescrever o `page.tsx`**

```tsx
import {
  getWhatsappAlertEmail,
  getWhatsappAgenteConfig,
  getWhatsappBotSaudacaoConfig,
  getWhatsappConnection,
  getWhatsappFeatures,
  getWhatsappLembreteConfig,
  getWhatsappStatusEntregaConfig,
} from "@/lib/whatsapp/admin-actions"
import { getConversas } from "@/lib/whatsapp/chat-actions"
import WhatsappAdminShell from "@/components/admin/whatsapp/whatsapp-admin-shell"

export const dynamic = "force-dynamic"

const WhatsappPage = async () => {
  const [connection, features, statusEntrega, lembrete, botSaudacao, agente, alertEmail, conversas] = await Promise.all([
    getWhatsappConnection(),
    getWhatsappFeatures(),
    getWhatsappStatusEntregaConfig(),
    getWhatsappLembreteConfig(),
    getWhatsappBotSaudacaoConfig(),
    getWhatsappAgenteConfig(),
    getWhatsappAlertEmail(),
    getConversas(),
  ])

  return (
    <WhatsappAdminShell
      initialConnection={connection}
      features={features}
      statusEntrega={statusEntrega}
      lembrete={lembrete}
      botSaudacao={botSaudacao}
      agente={agente}
      alertEmail={alertEmail}
      conversas={conversas}
    />
  )
}

export default WhatsappPage
```

- [ ] **Step 2: Typecheck + suíte completa**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/app/admin/(authenticated)/whatsapp/page.tsx"
git commit -m "feat(whatsapp): página WhatsApp inbox-first via WhatsappAdminShell"
```

---

## Task 11: Verificação final

- [ ] **Step 1: Typecheck + testes completos**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: PASS (toda a suíte verde; `connection-status` + `accordion` novos).

- [ ] **Step 2: Verificação manual (staging) — checklist**

Subir em staging (push pra `staging`) e conferir em `app-git-staging-…/admin/whatsapp` (login do dono):
- Página abre com **inbox em destaque**, chip de status no header, botão ⚙ Configurar.
- ⚙ → drawer desliza da direita + backdrop; Esc / clique no backdrop / ✕ fecham.
- Acordeão: abrir uma seção fecha a anterior; corpo anima.
- Cada toggle/save dos painéis continua funcionando (sem regressão).
- Ligar **Atendimento** no drawer → inbox aparece sem reload (via `onFeaturesChange`).
- Chip vermelho quando desconectado → clicar abre o drawer na **Conexão**.
- Mobile: header quebra, drawer ocupa a largura.

> Sem step de commit aqui (verificação). Bugs viram correções nas tasks correspondentes.

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** main page inbox-first (T9/T10) ✓; chip de status + lógica pura (T1/T4) ✓; drawer slide-in padrão edit-order + Esc/backdrop/✕ (T8) ✓; acordeão 1-aberto-por-vez (T2 + props nas T5/T6/T7 + wiring T8) ✓; `<Collapsible>` animado (T3) ✓; Conexão controlada/poll único (T7+T9) ✓; placeholder de atendimento com CTA (T9) ✓; sem mudança de server action ✓.
- **Placeholders:** nenhum "TBD"; cada step tem código/commando. As únicas instruções "envolver o conteúdo atual" (T6/T7) referenciam JSX já existente e inalterado, com o wrapper exato mostrado.
- **Consistência de tipos:** `WhatsappConnection`, `WhatsappFeatures`, `StatusEntregaConfig`, `LembreteConfig`, `BotSaudacaoConfig`, `AgenteConfig` vêm de `admin-actions.ts` (verificados). `SectionId`/`toggleSection` (T2) usados igualmente em T8. Props `expanded?`/`onToggleExpand?` idênticas nos painéis. `ChipTom` consistente entre T1 e T4.
- **Risco principal:** T7 (WhatsAppConnection tem múltiplos ramos de render) — por isso é tarefa isolada; o fallback `connection ?? local` mantém o standalone funcionando se algo escapar.
