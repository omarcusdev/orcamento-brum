# FRE-22 — Avisar status de entrega no WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar mensagem automática no WhatsApp do cliente quando um pedido entra em `em_rota`, `entregue`, `cancelado` ou `recolhido`, com feature master + toggle por status + mensagens editáveis pelo painel admin.

**Architecture:** Hook `after()` nas server actions de status (`advanceOrderStatus`, `cancelOrder`) chama `sendCustomerWhatsAppStatusUpdate`, que reaproveita o port `sendWhatsAppMessage` e o RPC `register_whatsapp_message` (mesmo padrão da confirmação FRE-12). A política de "enviar ou não + qual texto" fica num módulo puro testável (`status-messages.ts`); o I/O (gates, dedupe, envio, log) fica no wrapper. Flags e textos vivem em `configuracoes` (key-value); o painel é um client component isolado.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `after()`), React 19, Supabase (service client + RPC), vitest, Tailwind v4, primitivos `@/components/ui`.

**Spec:** `docs/superpowers/specs/2026-06-04-whatsapp-status-entrega-design.md`

**⚠️ Banco:** todas as migrações desta feature vão pro **STAGING** (`iwyijyxpkchibdryzkpn`), NUNCA prod (`rhuqttionnpfnftkmvmq`). A aplicação em prod é a FRE-21 (go-live). O Supabase MCP desconecta entre sessões — reconecte antes de operar o banco.

---

## File Structure

**Novos**
- `app/lib/whatsapp/status-messages.ts` — módulo PURO (sem I/O): statuses notificáveis, labels, defaults, helpers de chave, render de template, e a decisão pura `resolveStatusMessage`.
- `app/lib/whatsapp/status-messages.test.ts` — testes unitários do módulo puro.
- `app/components/admin/whatsapp-status-entrega-panel.tsx` — client component: master + 4 sub-toggles + 4 textareas (Salvar / Restaurar padrão).
- `supabase/migrations/024_whatsapp_status_entrega.sql` — seed das 9 configs + relax do CHECK `mensagens_whatsapp.tipo`.

**Modificados**
- `app/lib/whatsapp/features.ts` — adiciona o master key ao `WHATSAPP_FEATURE_KEYS`.
- `app/lib/whatsapp/notificacoes.ts` — adiciona `sendCustomerWhatsAppStatusUpdate`.
- `app/lib/admin-actions.ts` — `after()` em `advanceOrderStatus` e `cancelOrder` (+ import de `after`).
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappStatusEntregaConfig`, `setWhatsappStatusFlag`, `setWhatsappStatusMessage`.
- `app/components/admin/whatsapp-features-panel.tsx` — atualiza o copy `NAO_FAZ`.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — fetch da config + render do painel novo.

Todos os comandos rodam de `/Users/marcusgoncalves/projects/orcamento-brum/app` salvo indicado.

---

## Task 1: Módulo puro `status-messages.ts` (statuses, defaults, tokens, decisão)

**Files:**
- Create: `app/lib/whatsapp/status-messages.ts`
- Test: `app/lib/whatsapp/status-messages.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `app/lib/whatsapp/status-messages.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  STATUS_NOTIFY_STATUSES,
  STATUS_LABELS,
  DEFAULT_STATUS_MESSAGES,
  isNotifyStatus,
  statusFlagKey,
  statusMsgKey,
  renderStatusTemplate,
  resolveStatusMessage,
} from "./status-messages"

describe("isNotifyStatus", () => {
  it("aceita os 4 status notificaveis", () => {
    expect(STATUS_NOTIFY_STATUSES).toEqual(["em_rota", "entregue", "cancelado", "recolhido"])
    for (const s of STATUS_NOTIFY_STATUSES) expect(isNotifyStatus(s)).toBe(true)
  })
  it("rejeita status fora do escopo", () => {
    expect(isNotifyStatus("confirmado")).toBe(false)
    expect(isNotifyStatus("enviar_para_entregador")).toBe(false)
    expect(isNotifyStatus("pago")).toBe(false)
    expect(isNotifyStatus("qualquer_coisa")).toBe(false)
  })
})

describe("statusFlagKey / statusMsgKey", () => {
  it("derivam as chaves de configuracoes", () => {
    expect(statusFlagKey("em_rota")).toBe("whatsapp_status_em_rota_ativo")
    expect(statusMsgKey("recolhido")).toBe("whatsapp_status_recolhido_msg")
  })
})

describe("DEFAULT_STATUS_MESSAGES / STATUS_LABELS", () => {
  it("tem os 4 status com label e ao menos um token", () => {
    for (const s of STATUS_NOTIFY_STATUSES) {
      expect(typeof STATUS_LABELS[s]).toBe("string")
      expect(STATUS_LABELS[s].length).toBeGreaterThan(0)
      const msg = DEFAULT_STATUS_MESSAGES[s]
      expect(msg.length).toBeGreaterThan(0)
      expect(msg.includes("{nome}") || msg.includes("{pedido}")).toBe(true)
    }
  })
  it("em_rota usa {nome} e {pedido}; recolhido nao referencia numero de pedido", () => {
    expect(DEFAULT_STATUS_MESSAGES.em_rota).toContain("{nome}")
    expect(DEFAULT_STATUS_MESSAGES.em_rota).toContain("{pedido}")
    expect(DEFAULT_STATUS_MESSAGES.recolhido).toContain("{nome}")
    expect(DEFAULT_STATUS_MESSAGES.recolhido).not.toContain("{pedido}")
  })
})

describe("renderStatusTemplate", () => {
  it("substitui {nome} e {pedido}, inclusive multiplas ocorrencias", () => {
    expect(renderStatusTemplate("Oi {nome}, pedido #{pedido}", { nome: "Joao", pedido: "1a2b3c4d" }))
      .toBe("Oi Joao, pedido #1a2b3c4d")
    expect(renderStatusTemplate("{nome} {nome}", { nome: "Ana", pedido: "x" })).toBe("Ana Ana")
  })
  it("deixa intacto texto sem token", () => {
    expect(renderStatusTemplate("sem token", { nome: "X", pedido: "y" })).toBe("sem token")
  })
})

describe("resolveStatusMessage", () => {
  const vars = { nome: "Joao", pedido: "1a2b3c4d" }

  it("pula status nao notificavel", () => {
    expect(resolveStatusMessage("pago", { statusOn: true, template: null, ...vars }))
      .toEqual({ skip: true })
  })
  it("pula quando o status esta desligado", () => {
    expect(resolveStatusMessage("em_rota", { statusOn: false, template: null, ...vars }))
      .toEqual({ skip: true })
  })
  it("usa o default quando o template e nulo", () => {
    const r = resolveStatusMessage("em_rota", { statusOn: true, template: null, ...vars })
    expect(r.skip).toBe(false)
    if (!r.skip) expect(r.mensagem).toBe(renderStatusTemplate(DEFAULT_STATUS_MESSAGES.em_rota, vars))
  })
  it("usa o default quando o template e vazio/espaco", () => {
    const r = resolveStatusMessage("entregue", { statusOn: true, template: "   ", ...vars })
    if (!r.skip) expect(r.mensagem).toContain("entregue")
    else throw new Error("nao deveria pular")
  })
  it("usa o template custom e renderiza tokens", () => {
    const r = resolveStatusMessage("cancelado", { statusOn: true, template: "Ei {nome}! #{pedido}", ...vars })
    expect(r).toEqual({ skip: false, mensagem: "Ei Joao! #1a2b3c4d" })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test -- status-messages`
Expected: FAIL — `Failed to resolve import "./status-messages"` (módulo ainda não existe).

- [ ] **Step 3: Implementar o módulo**

Create `app/lib/whatsapp/status-messages.ts`:

```ts
// Modulo PURO (sem I/O): fonte da verdade dos status notificaveis, textos-padrao e
// da decisao "enviar ou nao + qual texto". Seguro pra importar em client component.

export const STATUS_NOTIFY_STATUSES = ["em_rota", "entregue", "cancelado", "recolhido"] as const
export type NotifyStatus = (typeof STATUS_NOTIFY_STATUSES)[number]

export const STATUS_LABELS: Record<NotifyStatus, string> = {
  em_rota: "A caminho (em rota)",
  entregue: "Entregue",
  cancelado: "Cancelado",
  recolhido: "Recolhido",
}

// Tokens suportados nas mensagens: {nome} (primeiro nome) e {pedido} (id curto).
export const DEFAULT_STATUS_MESSAGES: Record<NotifyStatus, string> = {
  em_rota:
    "Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚 — ALFA Chopp Delivery",
  entregue:
    "Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento! — ALFA Chopp Delivery",
  cancelado:
    "Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante. — ALFA Chopp Delivery",
  recolhido:
    "Recolhemos tudo certinho! 🍺 Valeu demais pela parceria, {nome}. Bora repetir! — ALFA Chopp Delivery",
}

export const isNotifyStatus = (s: string): s is NotifyStatus =>
  (STATUS_NOTIFY_STATUSES as readonly string[]).includes(s)

export const statusFlagKey = (s: NotifyStatus) => `whatsapp_status_${s}_ativo`
export const statusMsgKey = (s: NotifyStatus) => `whatsapp_status_${s}_msg`

export const renderStatusTemplate = (
  template: string,
  vars: { nome: string; pedido: string },
): string => template.replaceAll("{nome}", vars.nome).replaceAll("{pedido}", vars.pedido)

// Decisao pura: dado o status, se o sub-flag esta ligado e o template (config ou null),
// devolve skip ou a mensagem pronta. O gate master e o dedupe ficam no wrapper de I/O.
export const resolveStatusMessage = (
  status: string,
  opts: { statusOn: boolean; template: string | null; nome: string; pedido: string },
): { skip: true } | { skip: false; mensagem: string } => {
  if (!isNotifyStatus(status)) return { skip: true }
  if (!opts.statusOn) return { skip: true }
  const tpl = opts.template && opts.template.trim() ? opts.template : DEFAULT_STATUS_MESSAGES[status]
  return { skip: false, mensagem: renderStatusTemplate(tpl, { nome: opts.nome, pedido: opts.pedido }) }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test -- status-messages`
Expected: PASS (todos os describes verdes).

- [ ] **Step 5: Commit**

```bash
git add app/lib/whatsapp/status-messages.ts app/lib/whatsapp/status-messages.test.ts
git commit -m "feat(whatsapp): modulo puro de mensagens de status de entrega (FRE-22)"
```

---

## Task 2: Migração 024 (configs + relax do CHECK) e aplicar no STAGING

**Files:**
- Create: `supabase/migrations/024_whatsapp_status_entrega.sql`

- [ ] **Step 1: Criar o arquivo de migração**

Create `supabase/migrations/024_whatsapp_status_entrega.sql`:

```sql
-- FRE-22: avisar status de entrega no WhatsApp.
-- Feature master + flag por status + mensagens editaveis. Default LIGADO/preenchido.
insert into configuracoes (chave, valor) values
  ('whatsapp_status_entrega_ativo', 'true'),
  ('whatsapp_status_em_rota_ativo', 'true'),
  ('whatsapp_status_entregue_ativo', 'true'),
  ('whatsapp_status_cancelado_ativo', 'true'),
  ('whatsapp_status_recolhido_ativo', 'true'),
  ('whatsapp_status_em_rota_msg', 'Eba, {nome}! 🍻 Seu chopp tá a caminho! O pedido #{pedido} saiu pra entrega e logo chega aí. 🚚 — ALFA Chopp Delivery'),
  ('whatsapp_status_entregue_msg', 'Seu chopp chegou! 🎉 Pedido #{pedido} entregue. Caprichem na espuma e curtam o evento! — ALFA Chopp Delivery'),
  ('whatsapp_status_cancelado_msg', 'Olá {nome}, seu pedido #{pedido} foi cancelado. Se precisar, a gente refaz num instante. — ALFA Chopp Delivery'),
  ('whatsapp_status_recolhido_msg', 'Recolhemos tudo certinho! 🍺 Valeu demais pela parceria, {nome}. Bora repetir! — ALFA Chopp Delivery')
on conflict (chave) do nothing;

-- Permitir os novos tipos de mensagem de status no log mensagens_whatsapp.
alter table mensagens_whatsapp drop constraint mensagens_whatsapp_tipo_check;
alter table mensagens_whatsapp add constraint mensagens_whatsapp_tipo_check
  check (tipo in ('confirmacao', 'lembrete', 'status_em_rota', 'status_entregue', 'status_cancelado', 'status_recolhido'));
```

> Os textos-padrão aqui DEVEM ser idênticos a `DEFAULT_STATUS_MESSAGES` em `status-messages.ts` (mesmas strings). Se um divergir, o fallback do código e a seed do banco discordam.

- [ ] **Step 2: Aplicar no STAGING**

Reconectar o Supabase MCP se necessário (desconecta entre sessões). Aplicar **somente no projeto staging** `iwyijyxpkchibdryzkpn` (via `apply_migration` do Supabase MCP com esse project ref). **NÃO** rode `supabase db push` da CLI — ela está linkada ao prod `rhuqttionnpfnftkmvmq`.

- [ ] **Step 3: Verificar a aplicação no staging**

Rodar no SQL editor / MCP (staging):

```sql
select chave from configuracoes where chave like 'whatsapp_status_%' order by chave;
-- Esperado: 9 linhas (1 master + 4 *_ativo + 4 *_msg)

select pg_get_constraintdef(oid) from pg_constraint where conname = 'mensagens_whatsapp_tipo_check';
-- Esperado: CHECK contendo 'status_em_rota','status_entregue','status_cancelado','status_recolhido'
```

Expected: 9 linhas de config + a definição do CHECK já com os 4 novos tipos.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/024_whatsapp_status_entrega.sql
git commit -m "feat(db): migration 024 - configs e tipos de status de entrega WhatsApp (FRE-22)"
```

---

## Task 3: Registrar o feature key master em `features.ts`

**Files:**
- Modify: `app/lib/whatsapp/features.ts:5-9`

- [ ] **Step 1: Adicionar a chave master ao union de features**

Em `app/lib/whatsapp/features.ts`, trocar o array `WHATSAPP_FEATURE_KEYS`:

```ts
export const WHATSAPP_FEATURE_KEYS = [
  "whatsapp_confirmacao_ativo",
  "whatsapp_atendimento_ativo",
  "whatsapp_alerta_ativo",
  "whatsapp_status_entrega_ativo",
] as const
```

(Nada mais muda em `features.ts`. `parseFlag` e `isWhatsappFeatureEnabled` já existem; o gate master vai usar `isWhatsappFeatureEnabled("whatsapp_status_entrega_ativo")`, agora válido pelo tipo. Os sub-flags são lidos via query + `parseFlag`, não precisam estar nesse union.)

- [ ] **Step 2: Confirmar typecheck**

Run: `npm run typecheck`
Expected: PASS (sem erros novos). `getWhatsappFeatures` continua mapeando só confirmacao/atendimento/alerta — a chave extra no `.in()` só retorna uma linha ignorada.

- [ ] **Step 3: Commit**

```bash
git add app/lib/whatsapp/features.ts
git commit -m "feat(whatsapp): registra flag master de status de entrega (FRE-22)"
```

---

## Task 4: `sendCustomerWhatsAppStatusUpdate` em `notificacoes.ts`

**Files:**
- Modify: `app/lib/whatsapp/notificacoes.ts` (adicionar imports no topo + a função nova no fim)

- [ ] **Step 1: Ajustar os imports do topo**

Em `app/lib/whatsapp/notificacoes.ts`, trocar as 3 linhas de import iniciais por:

```ts
import { createServiceClient } from "@/lib/supabase/service"
import { sendWhatsAppMessage } from "."
import { isWhatsappFeatureEnabled, parseFlag } from "./features"
import {
  isNotifyStatus,
  resolveStatusMessage,
  statusFlagKey,
  statusMsgKey,
} from "./status-messages"
```

- [ ] **Step 2: Adicionar a função no fim do arquivo**

Append em `app/lib/whatsapp/notificacoes.ts`:

```ts
// Mensagem automatica quando o pedido entra em em_rota/entregue/cancelado/recolhido.
// Roda via after() nas server actions de status — nunca bloqueia a mudanca de status.
export const sendCustomerWhatsAppStatusUpdate = async (pedidoId: string, novoStatus: string) => {
  if (!isNotifyStatus(novoStatus)) return
  if (!(await isWhatsappFeatureEnabled("whatsapp_status_entrega_ativo"))) return
  try {
    const supabase = createServiceClient()

    const { data: cfgRows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", [statusFlagKey(novoStatus), statusMsgKey(novoStatus)])

    const statusOn = parseFlag(cfgRows?.find((r) => r.chave === statusFlagKey(novoStatus))?.valor)
    const template = cfgRows?.find((r) => r.chave === statusMsgKey(novoStatus))?.valor ?? null

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .select("clientes(nome, telefone)")
      .eq("id", pedidoId)
      .single()

    if (pedidoErr || !pedido) {
      console.error("[whatsapp] pedido não encontrado (status):", pedidoId, pedidoErr)
      return
    }

    const cliente = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes
    const telefone = cliente?.telefone
    if (!telefone) {
      console.error("[whatsapp] cliente sem telefone (status):", pedidoId)
      return
    }

    const decision = resolveStatusMessage(novoStatus, {
      statusOn,
      template,
      nome: (cliente?.nome ?? "Cliente").split(" ")[0],
      pedido: pedidoId.slice(0, 8),
    })
    if (decision.skip) return

    const tipo = `status_${novoStatus}`

    // Dedupe: nao reenvia o mesmo status pro mesmo pedido (ex.: admin volta e avanca de novo).
    const { data: existing } = await supabase
      .from("mensagens_whatsapp")
      .select("id")
      .eq("pedido_id", pedidoId)
      .eq("tipo", tipo)
      .eq("status", "enviada")
      .limit(1)

    if (existing && existing.length > 0) return

    const result = await sendWhatsAppMessage(telefone, decision.mensagem)

    await supabase.rpc("register_whatsapp_message", {
      p_pedido_id: pedidoId,
      p_tipo: tipo,
      p_status: result.ok ? "enviada" : "falha",
    })
  } catch (err) {
    console.error("[whatsapp] erro inesperado no status de entrega:", err)
  }
}
```

- [ ] **Step 3: Confirmar typecheck**

Run: `npm run typecheck`
Expected: PASS. (`parseFlag` já é exportado de `features.ts`; `register_whatsapp_message` aceita `p_tipo` string.)

- [ ] **Step 4: Commit**

```bash
git add app/lib/whatsapp/notificacoes.ts
git commit -m "feat(whatsapp): envio de status de entrega com gate+dedupe (FRE-22)"
```

---

## Task 5: Disparar via `after()` nas server actions de status

**Files:**
- Modify: `app/lib/admin-actions.ts:1-9` (imports) e `advanceOrderStatus` / `cancelOrder`

- [ ] **Step 1: Importar `after` e a função de envio**

No topo de `app/lib/admin-actions.ts`, adicionar duas linhas de import (depois dos imports existentes, antes do `const statusOrder`):

```ts
import { after } from "next/server"
import { sendCustomerWhatsAppStatusUpdate } from "@/lib/whatsapp/notificacoes"
```

- [ ] **Step 2: Disparar em `advanceOrderStatus`**

Em `advanceOrderStatus`, logo antes do `return { status: nextStatus }` (depois dos `revalidatePath`), inserir:

```ts
  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, nextStatus))

  return { status: nextStatus }
```

(`nextStatus` pode ser `pago`/`recolhido`/`em_rota`/`entregue`; `sendCustomerWhatsAppStatusUpdate` ignora `pago` sozinho via `isNotifyStatus`.)

- [ ] **Step 3: Disparar em `cancelOrder`**

Em `cancelOrder`, depois dos dois `revalidatePath`, no fim da função, inserir:

```ts
  after(() => sendCustomerWhatsAppStatusUpdate(pedidoId, "cancelado"))
```

(`revertOrderStatus` e `dispatchToEntregador` NÃO recebem hook — reverter nunca envia; `enviar_para_entregador` está fora do escopo.)

- [ ] **Step 4: Confirmar typecheck e build**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run build`
Expected: build conclui sem erro (server action + `after()` OK no Next 16).

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin-actions.ts
git commit -m "feat(admin): dispara WhatsApp de status em advance/cancel via after() (FRE-22)"
```

---

## Task 6: Server actions do painel em `whatsapp/admin-actions.ts`

**Files:**
- Modify: `app/lib/whatsapp/admin-actions.ts` (imports do topo + 3 funções novas no fim)

- [ ] **Step 1: Ampliar os imports do topo**

Em `app/lib/whatsapp/admin-actions.ts`, trocar o bloco de import de `./features` e adicionar o de `./status-messages`:

```ts
import {
  WHATSAPP_FEATURE_KEYS,
  parseFlag,
  type WhatsappFeatureKey,
} from "./features"
import {
  STATUS_NOTIFY_STATUSES,
  DEFAULT_STATUS_MESSAGES,
  isNotifyStatus,
  statusFlagKey,
  statusMsgKey,
  type NotifyStatus,
} from "./status-messages"
```

- [ ] **Step 2: Adicionar as 3 funções no fim do arquivo**

Append em `app/lib/whatsapp/admin-actions.ts`:

```ts
export type StatusEntregaItem = { ativo: boolean; mensagem: string }
export type StatusEntregaConfig = {
  master: boolean
  porStatus: Record<NotifyStatus, StatusEntregaItem>
}

const STATUS_MASTER_KEY = "whatsapp_status_entrega_ativo"

export const getWhatsappStatusEntregaConfig = async (): Promise<StatusEntregaConfig> => {
  const { supabase } = await requireAdmin()

  const chaves = [
    STATUS_MASTER_KEY,
    ...STATUS_NOTIFY_STATUSES.flatMap((s) => [statusFlagKey(s), statusMsgKey(s)]),
  ]

  const { data } = await supabase.from("configuracoes").select("chave, valor").in("chave", chaves)
  const valorDe = (chave: string) => data?.find((row) => row.chave === chave)?.valor

  const porStatus = Object.fromEntries(
    STATUS_NOTIFY_STATUSES.map((s) => {
      const raw = valorDe(statusMsgKey(s))
      return [
        s,
        {
          ativo: parseFlag(valorDe(statusFlagKey(s))),
          mensagem: raw && raw.trim() ? raw : DEFAULT_STATUS_MESSAGES[s],
        },
      ]
    }),
  ) as Record<NotifyStatus, StatusEntregaItem>

  return { master: parseFlag(valorDe(STATUS_MASTER_KEY)), porStatus }
}

export const setWhatsappStatusFlag = async (
  alvo: "master" | NotifyStatus,
  ativo: boolean,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (alvo !== "master" && !isNotifyStatus(alvo)) return { ok: false }
  const chave = alvo === "master" ? STATUS_MASTER_KEY : statusFlagKey(alvo)

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave, valor: String(ativo), updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}

export const setWhatsappStatusMessage = async (
  status: NotifyStatus,
  texto: string,
): Promise<{ ok: boolean }> => {
  const { supabase } = await requireAdmin()

  if (!isNotifyStatus(status)) return { ok: false }
  // texto vazio = restaurar padrao
  const valor = texto.trim() ? texto : DEFAULT_STATUS_MESSAGES[status]

  const { data, error } = await supabase
    .from("configuracoes")
    .upsert(
      { chave: statusMsgKey(status), valor, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    )
    .select("chave")

  if (error || !data?.length) return { ok: false }

  revalidatePath("/admin/whatsapp")
  return { ok: true }
}
```

- [ ] **Step 3: Confirmar typecheck**

Run: `npm run typecheck`
Expected: PASS. (Arquivo é `"use server"` e só exporta funções async + `export type` — tipos são elididos, ok.)

- [ ] **Step 4: Commit**

```bash
git add app/lib/whatsapp/admin-actions.ts
git commit -m "feat(whatsapp): actions do painel de status de entrega (get/set flag/msg) (FRE-22)"
```

---

## Task 7: Painel `whatsapp-status-entrega-panel.tsx`, copy e página

**Files:**
- Create: `app/components/admin/whatsapp-status-entrega-panel.tsx`
- Modify: `app/components/admin/whatsapp-features-panel.tsx:9-10`
- Modify: `app/app/admin/(authenticated)/whatsapp/page.tsx`

- [ ] **Step 1: Criar o painel**

Create `app/components/admin/whatsapp-status-entrega-panel.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { Truck } from "lucide-react"
import { Switch, Textarea, Button } from "@/components/ui"
import {
  setWhatsappStatusFlag,
  setWhatsappStatusMessage,
  type StatusEntregaConfig,
} from "@/lib/whatsapp/admin-actions"
import {
  STATUS_NOTIFY_STATUSES,
  STATUS_LABELS,
  DEFAULT_STATUS_MESSAGES,
  type NotifyStatus,
} from "@/lib/whatsapp/status-messages"

type Props = { initial: StatusEntregaConfig }

const WhatsappStatusEntregaPanel = ({ initial }: Props) => {
  const [master, setMaster] = useState(initial.master)
  const [porStatus, setPorStatus] = useState(initial.porStatus)
  const [rascunho, setRascunho] = useState<Record<NotifyStatus, string>>(
    () =>
      Object.fromEntries(
        STATUS_NOTIFY_STATUSES.map((s) => [s, initial.porStatus[s].mensagem]),
      ) as Record<NotifyStatus, string>,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState<NotifyStatus | null>(null)
  const [, startTransition] = useTransition()

  const toggleMaster = (next: boolean) => {
    setErro(null)
    setMaster(next)
    startTransition(async () => {
      const { ok } = await setWhatsappStatusFlag("master", next)
      if (!ok) {
        setMaster(!next)
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const toggleStatus = (s: NotifyStatus, next: boolean) => {
    setErro(null)
    setPorStatus((p) => ({ ...p, [s]: { ...p[s], ativo: next } }))
    startTransition(async () => {
      const { ok } = await setWhatsappStatusFlag(s, next)
      if (!ok) {
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], ativo: !next } }))
        setErro("Não consegui salvar. Tente de novo.")
      }
    })
  }

  const salvarMsg = (s: NotifyStatus) => {
    setErro(null)
    setSalvo(null)
    startTransition(async () => {
      const { ok } = await setWhatsappStatusMessage(s, rascunho[s])
      if (ok) {
        const final = rascunho[s].trim() ? rascunho[s] : DEFAULT_STATUS_MESSAGES[s]
        setRascunho((r) => ({ ...r, [s]: final }))
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], mensagem: final } }))
        setSalvo(s)
      } else {
        setErro("Não consegui salvar a mensagem.")
      }
    })
  }

  const restaurar = (s: NotifyStatus) => {
    setErro(null)
    setSalvo(null)
    setRascunho((r) => ({ ...r, [s]: DEFAULT_STATUS_MESSAGES[s] }))
    startTransition(async () => {
      const { ok } = await setWhatsappStatusMessage(s, DEFAULT_STATUS_MESSAGES[s])
      if (ok) {
        setPorStatus((p) => ({ ...p, [s]: { ...p[s], mensagem: DEFAULT_STATUS_MESSAGES[s] } }))
        setSalvo(s)
      } else {
        setErro("Não consegui restaurar.")
      }
    })
  }

  return (
    <div className="bg-brand-surface rounded-xl border border-white/10 p-6">
      <div className="flex items-start gap-4">
        <Truck className={`h-5 w-5 mt-0.5 shrink-0 ${master ? "text-brand-yellow" : "text-brand-warm-gray"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Avisar status de entrega</p>
          <p className="text-xs text-brand-warm-gray mt-0.5">
            Manda mensagem automática quando o pedido muda de status. Escolha em quais status e edite cada texto.
          </p>
        </div>
        <Switch
          id="whatsapp_status_entrega_ativo"
          checked={master}
          onChange={toggleMaster}
          aria-label="Avisar status de entrega"
        />
      </div>

      {master && (
        <ul className="mt-5 space-y-5 border-t border-white/5 pt-5">
          {STATUS_NOTIFY_STATUSES.map((s) => (
            <li key={s} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className={`text-sm font-medium ${porStatus[s].ativo ? "text-white" : "text-brand-warm-gray"}`}>
                  {STATUS_LABELS[s]}
                </span>
                <Switch
                  id={`whatsapp_status_${s}`}
                  checked={porStatus[s].ativo}
                  onChange={(next) => toggleStatus(s, next)}
                  aria-label={STATUS_LABELS[s]}
                />
              </div>
              <Textarea
                rows={3}
                value={rascunho[s]}
                onChange={(e) => {
                  const v = e.target.value
                  setRascunho((r) => ({ ...r, [s]: v }))
                  setSalvo(null)
                }}
                disabled={!porStatus[s].ativo}
                aria-label={`Mensagem ${STATUS_LABELS[s]}`}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => salvarMsg(s)}
                  disabled={!porStatus[s].ativo || rascunho[s] === porStatus[s].mensagem}
                >
                  Salvar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restaurar(s)}
                  disabled={!porStatus[s].ativo}
                >
                  Restaurar padrão
                </Button>
                {salvo === s && <span className="text-xs text-green-300">Salvo ✓</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {erro && <p className="text-xs text-red-300 mt-3">{erro}</p>}

      <p className="text-xs text-brand-warm-gray mt-5 border-t border-white/5 pt-3">
        Use <code className="text-brand-yellow">{"{nome}"}</code> (primeiro nome) e{" "}
        <code className="text-brand-yellow">{"{pedido}"}</code> (nº do pedido) nas mensagens.
      </p>
    </div>
  )
}

export default WhatsappStatusEntregaPanel
```

- [ ] **Step 2: Atualizar o copy `NAO_FAZ`**

Em `app/components/admin/whatsapp-features-panel.tsx`, trocar a constante (linhas 9-10):

```tsx
const NAO_FAZ =
  "Ele NÃO responde sozinho (sem robô) e NÃO traz o histórico antigo de conversas."
```

- [ ] **Step 3: Plugar na página**

Ler `app/app/admin/(authenticated)/whatsapp/page.tsx`. Fazer 3 edições:

(a) importar a action e o painel (junto dos imports existentes):

```tsx
import { getWhatsappStatusEntregaConfig } from "@/lib/whatsapp/admin-actions"
import WhatsappStatusEntregaPanel from "@/components/admin/whatsapp-status-entrega-panel"
```

(b) adicionar `getWhatsappStatusEntregaConfig()` ao `Promise.all` e capturar o resultado:

```tsx
const [connection, features, statusEntrega, alertEmail, conversas] = await Promise.all([
  getWhatsappConnection(),
  getWhatsappFeatures(),
  getWhatsappStatusEntregaConfig(),
  getWhatsappAlertEmail(),
  getConversas(),
])
```

(c) na seção `RECURSOS`, renderizar o painel novo logo abaixo do `WhatsappFeaturesPanel`:

```tsx
<section>
  <h2 className="font-display text-lg font-bold text-white tracking-wide mb-3">RECURSOS</h2>
  <WhatsappFeaturesPanel initial={features} me={connection.me} />
  <div className="mt-4">
    <WhatsappStatusEntregaPanel initial={statusEntrega} />
  </div>
</section>
```

(Preservar a ordem/nome das outras variáveis do `Promise.all` e o resto da página exatamente como está; só inserir o item novo.)

- [ ] **Step 4: Verificar typecheck, lint e build**

Run: `npm run typecheck`
Expected: PASS.
Run: `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 5: Commit**

```bash
git add app/components/admin/whatsapp-status-entrega-panel.tsx app/components/admin/whatsapp-features-panel.tsx "app/app/admin/(authenticated)/whatsapp/page.tsx"
git commit -m "feat(admin): painel de status de entrega + atualiza copy NAO_FAZ (FRE-22)"
```

---

## Task 8: Verificação final + handoff

**Files:** nenhum (só checagens + atualização de tracking).

- [ ] **Step 1: Suite completa**

Run (de `app/`): `npm test`
Expected: todos verdes, incluindo `status-messages.test.ts`.

Run: `npm run typecheck && npm run build`
Expected: ambos PASS.

- [ ] **Step 2: Checklist de teste manual em staging (anotar pra FRE-4)**

O E2E real é a FRE-4 (teste geral final, fora desta feature). Registrar como roteiro:
- Avançar um pedido até `em_rota` → cliente recebe "a caminho"; `mensagens_whatsapp` tem linha `tipo=status_em_rota`, `status=enviada`.
- Avançar até `entregue`/`recolhido` → mensagens chegam; `pago` NÃO envia.
- Cancelar outro pedido → mensagem de cancelado.
- Voltar status e avançar de novo → dedupe segura (não reenvia).
- Editar uma mensagem no painel → próximo envio usa o texto novo; "Restaurar padrão" volta ao default.
- Desligar um sub-status → aquele status não envia; desligar o master → nada envia.

- [ ] **Step 3: Atualizar Linear + memória**

- `linear-zap` (FRE-22): comentar que implementação + plano foram entregues (commits desta branch), mover pra In Progress/Done conforme política do executor. Lembrar: FRE-22 desbloqueia parte da cadeia da FRE-4.
- Memória `project_whatsapp_atendimento_inbox.md`: anotar feature entregue (migration 024, flags master+4 sub + msgs editáveis, painel novo) na seção de roadmap.

- [ ] **Step 4: (NÃO agora) Deploy**

Não promover pra prod — isso é a FRE-21 (go-live), última na fila. A migration 024 só foi aplicada no STAGING.

---

## Self-Review

**Spec coverage:**
- Status em_rota/entregue/cancelado/recolhido → Task 1 (defaults/labels) + Task 4 (envio) + Task 5 (hooks). ✅
- Hook via `after()` em advance/cancel, revert/dispatch não enviam → Task 5. ✅
- Master + 4 sub-flags + 4 msgs, default ligado/preenchido → Task 2 (seed) + Task 3 (master key) + Task 6 (actions) + Task 7 (painel). ✅
- Mensagens editáveis + tokens {nome}/{pedido} + restaurar padrão → Task 1 (render) + Task 6 (setWhatsappStatusMessage, vazio=padrão) + Task 7 (textareas/botões). ✅
- Dedupe por (pedido, tipo, enviada) → Task 4. ✅
- Migration relax do CHECK `mensagens_whatsapp.tipo` → Task 2. ✅
- Atualizar copy "NÃO avisa status de entrega" → Task 7 Step 2. ✅
- Fallback default robusto (config vazia) → Task 1 (resolveStatusMessage) + Task 6 (get/set). ✅
- Erro nunca quebra a mudança de status (after + try/catch) → Task 4 + Task 5. ✅

**Placeholder scan:** sem TODO/TBD; todo step com código real e comandos exatos. ✅

**Type consistency:** `NotifyStatus`, `STATUS_NOTIFY_STATUSES`, `statusFlagKey`/`statusMsgKey`, `resolveStatusMessage` (assinatura `{statusOn, template, nome, pedido}`), `StatusEntregaConfig`/`StatusEntregaItem`, `setWhatsappStatusFlag("master"|NotifyStatus, boolean)`, `setWhatsappStatusMessage(NotifyStatus, string)` — usados de forma idêntica entre Tasks 1/4/6/7. Os textos-padrão em `DEFAULT_STATUS_MESSAGES` (Task 1) e na seed SQL (Task 2) são as mesmas strings. ✅
