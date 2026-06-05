# FRE-23 — Lembrete véspera (D-1) no WhatsApp (design)

**Data:** 2026-06-04
**Issue:** FRE-23 (Freelas, projeto "WhatsApp Integration — ALFA Chopp")
**Status:** desenho aprovado nas decisões-chave; pendente revisão do spec escrito.
**Depende de:** FRE-22 (reaproveita camada de envio, flags, padrão de painel e `register_whatsapp_message`).

## Goal

Na **véspera da entrega** (D-1), enviar automaticamente uma mensagem no WhatsApp do cliente lembrando que o chopp chega amanhã — reaproveitando a mesma camada de envio da confirmação (FRE-12) e do status de entrega (FRE-22). O dono liga/desliga a feature, **escolhe o horário** do disparo e **edita o texto** da mensagem pelo painel admin.

## Escopo

**Quando dispara:** uma vez por dia, no horário configurado (default **9h BRT**), para todo pedido com `data_evento = amanhã` (no fuso `America/Sao_Paulo`) que ainda esteja em `confirmado` **ou** `enviar_para_entregador` e que **ainda não recebeu** um lembrete.

**Status que recebem** (decisão do usuário): `confirmado` + `enviar_para_entregador`. Os demais (`em_rota`, `entregue`, `pago`, `recolhido`, `cancelado`) não fazem sentido lembrar e ficam de fora. Isso corrige o bug da RPC original, que filtrava só `confirmado`.

**Não colide com a FRE-22:** a FRE-22 só dispara em transições para `em_rota`/`entregue`/`cancelado`/`recolhido`; entrar em `confirmado`/`enviar_para_entregador` não dispara nada (`isNotifyStatus` retorna `false`). O lembrete tem `tipo = 'lembrete'` (≠ dos `status_*`), e o dedupe é por `(pedido, tipo)` — um `lembrete` e um `status_em_rota` nunca se atropelam. Linha do tempo natural: `confirmacao` (criação) → `lembrete` (véspera) → `status_em_rota` (no dia) → `status_entregue`.

**YAGNI / fora desta feature:** granularidade de minuto (só hora); retry com backoff; preview com dados reais no painel; múltiplas mensagens/segmentação; reagendar o pg_cron pela UI (o horário é só um valor lido pela rota — ver Arquitetura).

## Arquitetura

### Disparo — pg_cron + pg_net acordam uma rota Next (decisão aprovada)

`pg_cron` agenda um job **de hora em hora** (`0 * * * *`) que usa `pg_net` para fazer **um** `POST` em `/api/whatsapp/lembrete` (rota protegida por header-segredo). **Toda a lógica fica em TS**, na rota — `pg_net` só "acorda" a rota. Roda no Postgres do **staging e do prod**, independente de deploy Vercel (resolve o ponto fraco do Vercel cron, que só rodaria em prod).

**Por que de hora em hora + gate no TS, em vez de reagendar o pg_cron pela UI:** deixar o horário configurável sem mexer em `cron.job` pela aplicação (que exigiria uma RPC mutando o agendador). O job é **estático** (commitável); o horário vira só um valor em `configuracoes`. A rota lê a hora configurada (default 9) e **só envia quando a hora atual em São Paulo `>=` a hora configurada**. O `>=` é proposital: se o `pg_net` atrasar, ou um pedido for criado depois da hora no próprio dia D-1, o próximo tick horário ainda pega — e o dedupe garante 1 envio por pedido. Os ~23 ticks restantes do dia são no-ops baratos (uma leitura de config + RPC que volta vazia). Trocar o horário no painel tem efeito imediato, sem cirurgia no cron.

**Segredos via Supabase Vault.** A rota é pública na internet (Vercel) e **precisa** de segredo, senão qualquer um dispararia o lote. A `configuracoes` tem **leitura pública** (RLS) — então o segredo **não pode** morar lá. O segredo e a URL ficam no **Supabase Vault** (`vault.decrypted_secrets`, não exposto via PostgREST). O comando do `cron.schedule` lê os dois por nome:

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_route_url'),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_cron_secret')
  ),
  body := '{}'::jsonb
);
```

Assim a **migration fica sem segredo nenhum** (commitável). Os dois secrets do Vault são inseridos **manualmente por ambiente** (`select vault.create_secret('<valor>', '<nome>')`): staging agora, prod no go-live (FRE-21). A rota valida `x-cron-secret` contra `process.env.LEMBRETE_CRON_SECRET` (env na Vercel, por ambiente).

Rejeitadas: Vercel Cron (só roda em prod, não dá pra testar agendado em staging); tudo em SQL com `pg_net` direto no EC2 (duplica template/flag/dedupe em SQL, põe URL/segredo do EC2 no banco, edição da mensagem fica clunky); segredo em `configuracoes` (leitura pública vaza o segredo).

### Módulo puro — `app/lib/whatsapp/lembrete-message.ts` (novo, NÃO `"use server"`)

Unidade isolada e testável, sem I/O. Fonte da verdade do default, das chaves e da lógica de horário/tokens. Importável pelo painel (client) — por isso `import type` na chave de feature.

```ts
import type { WhatsappFeatureKey } from "./features"

// Tipado como WhatsappFeatureKey: garante (compile-time) que continua igual ao gate da rota.
export const LEMBRETE_FLAG_KEY: WhatsappFeatureKey = "whatsapp_lembrete_vespera_ativo"
export const LEMBRETE_HORA_KEY = "whatsapp_lembrete_vespera_hora" as const
export const LEMBRETE_MSG_KEY = "whatsapp_lembrete_vespera_msg" as const

export const DEFAULT_LEMBRETE_HORA = 9
export const DEFAULT_LEMBRETE_MSG =
  "Oi {nome}! 🍻 Passando pra lembrar: amanhã ({data}) às {horario} entregamos seu chopp do pedido #{pedido}. Qualquer coisa, é só chamar por aqui!"

// tokens: {nome} (1º nome), {pedido} (id curto 8 chars), {data} (DD/MM), {horario} (HH:MM)
export const renderLembreteTemplate = (
  template: string,
  vars: { nome: string; pedido: string; data: string; horario: string },
): string =>
  template
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{pedido}", vars.pedido)
    .replaceAll("{data}", vars.data)
    .replaceAll("{horario}", vars.horario)

// data_evento vem como 'YYYY-MM-DD' (string) → 'DD/MM' sem depender de fuso
export const formatDataBR = (iso: string): string => {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}
// horario_evento vem como 'HH:MM:SS' → 'HH:MM'
export const formatHorario = (t: string): string => t.slice(0, 5)

// hora atual no fuso de São Paulo (0–23), robusto a meia-noite (hourCycle h23)
export const horaEmSaoPaulo = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  )

// gate do horário: envia no horário configurado ou em qualquer hora seguinte do mesmo dia
export const deveEnviarAgora = (horaConfigurada: number, now: Date): boolean =>
  horaEmSaoPaulo(now) >= horaConfigurada

// normaliza a hora lida da config (string) para 0–23, caindo no default se inválida
export const parseHora = (valor: string | null | undefined): number => {
  const n = Number(valor)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : DEFAULT_LEMBRETE_HORA
}
```

### Orquestrador do lote — `app/lib/whatsapp/lembrete.ts` (novo, server-side)

Responsabilidade única: rodar o lote do dia. Separado de `notificacoes.ts` (que é envio por-pedido) porque é uma responsabilidade distinta (batch agendado).

`runLembreteVespera(): Promise<LembreteRunResult>` — fluxo:

1. Gate **master**: `if (!(await isWhatsappFeatureEnabled(LEMBRETE_FLAG_KEY))) return { skipped: true, reason: "feature_off" }` (fail-open, igual FRE-22).
2. `createServiceClient()` → lê config `whatsapp_lembrete_vespera_hora` e `whatsapp_lembrete_vespera_msg` numa query (`.in([LEMBRETE_HORA_KEY, LEMBRETE_MSG_KEY])`). `hora = parseHora(valor)`; `template = valor?.trim() ? valor : DEFAULT_LEMBRETE_MSG`.
3. Gate **horário**: `if (!deveEnviarAgora(hora, new Date())) return { skipped: true, reason: "fora_da_hora" }`.
4. `supabase.rpc("get_orders_needing_reminder")` → linhas `{ pedido_id, nome, telefone, data_evento, horario_evento }` (a RPC já filtra D-1 + status + dedupe).
5. Para cada linha (loop sequencial — volume pequeno):
   - sem `telefone` → loga, conta como falha, segue.
   - `mensagem = renderLembreteTemplate(template, { nome: primeiroNome(nome), pedido: pedido_id.slice(0,8), data: formatDataBR(data_evento), horario: formatHorario(horario_evento) })`.
   - `result = await sendWhatsAppMessage(telefone, mensagem)`.
   - `register_whatsapp_message({ p_pedido_id, p_tipo: "lembrete", p_status: result.ok ? "enviada" : "falha" })`.
   - conta `enviados` / `falhas`.
6. Retorna `{ skipped: false, total, enviados, falhas }`.
7. Corpo dentro de try/catch que loga; em erro inesperado retorna `{ skipped: true, reason: "erro" }` (nunca lança — a rota sempre responde 200).

```ts
export type LembreteRunResult =
  | { skipped: true; reason: "feature_off" | "fora_da_hora" | "erro" }
  | { skipped: false; total: number; enviados: number; falhas: number }
```

> **Dedupe + retry de graça:** a RPC só devolve pedidos sem `lembrete` com `status='enviada'`. Um envio que falhou é registrado `'falha'` → continua elegível e é **retentado no próximo tick horário** (ou no dia seguinte se ainda for D-1). Sucesso registra `'enviada'` → sai da fila. Sem lógica de retry explícita.

### Rota — `app/app/api/whatsapp/lembrete/route.ts` (novo, POST)

Fina, no padrão de `/api/whatsapp/alert`:

```ts
export const POST = async (request: Request) => {
  const secret = process.env.LEMBRETE_CRON_SECRET
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const result = await runLembreteVespera()
  return NextResponse.json({ ok: true, ...result })
}
```

Auth → delega → JSON. Sem corpo de request relevante (`body := '{}'`).

### RPC — `get_orders_needing_reminder()` redefinida (migração 025)

Hoje (migração 002) retorna `(pedido_id, telefone, mensagem)` com a mensagem **hardcoded** em SQL e filtra só `status='confirmado'`. Redefinir para **retornar linhas** (a mensagem é montada em TS, com template editável) e corrigir o filtro + fuso:

```sql
drop function if exists get_orders_needing_reminder();

create or replace function get_orders_needing_reminder()
returns table(pedido_id uuid, nome text, telefone text, data_evento date, horario_evento time) as $$
begin
  return query
  select p.id, c.nome, c.telefone, p.data_evento, p.horario_evento
  from pedidos p
  join clientes c on c.id = p.cliente_id
  where p.status in ('confirmado', 'enviar_para_entregador')
    and p.data_evento = (now() at time zone 'America/Sao_Paulo')::date + 1
    and not exists (
      select 1 from mensagens_whatsapp mw
      where mw.pedido_id = p.id and mw.tipo = 'lembrete' and mw.status = 'enviada'
    );
end;
$$ language plpgsql security definer;

-- drop+create reseta grants → re-revoga (a migração 004 já revogava)
revoke execute on function get_orders_needing_reminder() from anon, authenticated;
```

Nada no app chama essa RPC hoje (só a migração 002 a define e a 004 revoga) — mudar a assinatura é seguro. A rota chama via service client (service role ignora o revoke). `tipo='lembrete'` já é permitido no CHECK de `mensagens_whatsapp` (migração 001/024).

### Migração 025 — `supabase/migrations/025_whatsapp_lembrete_vespera.sql`

1. `create extension if not exists pg_cron;` e `create extension if not exists pg_net;`
2. `drop function … / create … / revoke …` da RPC (acima).
3. Seed das configs (`on conflict (chave) do nothing`):
   ```sql
   insert into configuracoes (chave, valor) values
     ('whatsapp_lembrete_vespera_ativo', 'true'),
     ('whatsapp_lembrete_vespera_hora',  '9'),
     ('whatsapp_lembrete_vespera_msg',   '<DEFAULT_LEMBRETE_MSG>')
   on conflict (chave) do nothing;
   ```
4. Agenda o cron de forma idempotente (re-aplicável):
   ```sql
   select cron.unschedule('lembrete-vespera-d1')
   where exists (select 1 from cron.job where jobname = 'lembrete-vespera-d1');

   select cron.schedule('lembrete-vespera-d1', '0 * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_route_url'),
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'lembrete_cron_secret')
       ),
       body := '{}'::jsonb
     );
   $$);
   ```

> **Pré-checagem na execução:** confirmar via `list_extensions` que `pg_cron`, `pg_net` e `supabase_vault` estão disponíveis no projeto staging antes de aplicar. (São padrão no Supabase.) Se o cron não encontrar os secrets do Vault em runtime, o `net.http_post` simplesmente não dispara — sem quebrar nada; basta inserir os secrets.

### Feature flag — `app/lib/whatsapp/features.ts`

Adiciona `"whatsapp_lembrete_vespera_ativo"` ao `WHATSAPP_FEATURE_KEYS` (feature de 1ª classe, junto de confirmação/atendimento/alerta/status). As chaves `_hora` e `_msg` **não** entram nesse union — são acessadas pelas consts do módulo puro.

### Server actions admin — `app/lib/whatsapp/admin-actions.ts`

Mesmo padrão `requireAdmin` + upsert+select da FRE-22:

```ts
export type LembreteConfig = { ativo: boolean; hora: number; mensagem: string }

export const getWhatsappLembreteConfig = async (): Promise<LembreteConfig>
// lê as 3 chaves numa query; fallbacks: ativo=parseFlag, hora=parseHora, mensagem=valor||DEFAULT

export const setWhatsappLembreteFlag = async (ativo: boolean): Promise<{ ok: boolean }>
// upsert LEMBRETE_FLAG_KEY = String(ativo)

export const setWhatsappLembreteHora = async (hora: number): Promise<{ ok: boolean }>
// valida Number.isInteger(hora) && 0..23; upsert LEMBRETE_HORA_KEY = String(hora)

export const setWhatsappLembreteMessage = async (texto: string): Promise<{ ok: boolean }>
// texto vazio (trim) = restaurar padrão → grava DEFAULT_LEMBRETE_MSG; upsert LEMBRETE_MSG_KEY
```

Todas `revalidatePath("/admin/whatsapp")`.

### Painel — `app/components/admin/whatsapp-lembrete-panel.tsx` (novo client component)

Espelha o `WhatsappStatusEntregaPanel`: linha master sempre visível (ícone `BellRing`/`CalendarClock` + `Switch`); quando ligado, um **collapse fechado por default** com: um `Select` de horário (00:00–23:00), o `Textarea` da mensagem, `Salvar` + `Restaurar padrão`, e a dica dos tokens. Update otimista + rollback em erro; indicador "Salvo ✓".

```
🔔 Lembrete na véspera                                    [master ON/OFF]
   (quando ON, collapse fechado:)
   ▸ Mensagem e horário
     (aberto:)
     Enviar às:  [09:00 ▼]
     [textarea editável…]
     Salvar · Restaurar padrão        Salvo ✓
     dica: use {nome} {pedido} {data} {horario}
```

- `Select` de hora: opções `0..23` rotuladas `HH:00` (`String(h).padStart(2,"0") + ":00"`); `value` = `String(hora)`; onChange → `setWhatsappLembreteHora(Number(value))` (otimista + rollback).
- `Textarea` + `Salvar` (disabled enquanto `rascunho === salvo`) + `Restaurar padrão` (seta o default e salva), igual ao painel de status.
- Render na seção RECURSOS do `page.tsx`, abaixo do `WhatsappStatusEntregaPanel`.

### Página — `app/app/admin/(authenticated)/whatsapp/page.tsx`

Adiciona `getWhatsappLembreteConfig()` ao `Promise.all` e renderiza `<WhatsappLembretePanel initial={lembrete} />` dentro de RECURSOS, abaixo do painel de status.

## Fluxo de dados

```
pg_cron (0 * * * *)
  → net.http_post(url+secret do Vault)  →  POST /api/whatsapp/lembrete  (x-cron-secret)
       → valida segredo (401 se errado)
       → runLembreteVespera():
            master flag ON?            (fail-open)        → senão {skipped: feature_off}
            hora atual SP >= hora cfg?  (deveEnviarAgora)  → senão {skipped: fora_da_hora}
            get_orders_needing_reminder()  [RPC: D-1 + status + dedupe]
            p/ cada pedido:
              render(template, {nome,pedido,data,horario})
              sendWhatsAppMessage(telefone, mensagem)      [port → baileys/EC2]
              register_whatsapp_message(tipo='lembrete', status=enviada|falha)
       → 200 { ok, skipped|total, enviados, falhas }
```

## Tratamento de erro

- Rota sempre responde 200 (exceto 401 de segredo inválido); `runLembreteVespera` nunca lança (try/catch que loga).
- Sem `telefone` / pedido sem template → conta falha/pula, segue o lote.
- Falha no `sendWhatsAppMessage` → registra `'falha'` (auditoria + reentra na fila no próximo tick).
- Leitura do flag master fail-open (consistente com FRE-22). Leitura de hora/msg com fallback pros defaults.
- Cron sem secrets no Vault → `net.http_post` não dispara, sem erro de aplicação.

## Testes

- **Unit (módulo puro `lembrete-message.ts`):** `renderLembreteTemplate` substitui os 4 tokens (incl. múltiplas ocorrências e token ausente); `formatDataBR('2026-06-10') === '10/06'`; `formatHorario('14:30:00') === '14:30'`; `parseHora` ("9"→9, ""/null→9, "25"→9, "abc"→9); `deveEnviarAgora`/`horaEmSaoPaulo` com `Date`s fixos (ex.: 12:00Z → SP 9 → `>=9` true; 11:00Z → SP 8 → `>=9` false).
- **Orquestrador (`runLembreteVespera`, mockando service client + `sendWhatsAppMessage`):** master off → `{skipped: feature_off}`; fora da hora → `{skipped: fora_da_hora}`; RPC com N linhas → N envios + N `register('lembrete')`; pedido sem telefone → conta falha e segue; envio que falha → registra `'falha'`.
- **Server actions:** `setWhatsappLembreteHora` rejeita fora de 0–23; `setWhatsappLembreteMessage` vazio grava default; upserts corretos.
- **RPC (staging, manual):** inserir pedido `data_evento=amanhã` em `confirmado`, `enviar_para_entregador`, `em_rota` (não deve voltar) e um já lembrado (dedupe) → conferir o conjunto retornado e o cálculo de fuso.
- **E2E (staging, manual — fora desta feature, entra na FRE-4 final):** semear pedido D-1 → `POST` na rota com o segredo → mensagem chega, log `enviada`, 2ª chamada não reenvia (dedupe); editar texto/hora no painel → próximo disparo usa os novos; desligar master → `{skipped}`; (opcional) `select cron.schedule_in_database`/disparo manual do job pra validar o caminho do pg_cron.

## Arquivos

**Novos**
- `app/lib/whatsapp/lembrete-message.ts` — módulo puro (chaves, default, render, format, helpers de hora).
- `app/lib/whatsapp/lembrete.ts` — orquestrador `runLembreteVespera`.
- `app/app/api/whatsapp/lembrete/route.ts` — rota POST protegida por segredo.
- `app/components/admin/whatsapp-lembrete-panel.tsx` — painel master + collapse (hora + textarea).
- `supabase/migrations/025_whatsapp_lembrete_vespera.sql` — extensões, redefinição da RPC, seed das 3 configs, agendamento do cron (segredos via Vault).
- Testes: `app/lib/whatsapp/lembrete-message.test.ts` (+ teste do `runLembreteVespera`).

**Modificados**
- `app/lib/whatsapp/features.ts` — `whatsapp_lembrete_vespera_ativo` em `WHATSAPP_FEATURE_KEYS`.
- `app/lib/whatsapp/admin-actions.ts` — `getWhatsappLembreteConfig`, `setWhatsappLembreteFlag`, `setWhatsappLembreteHora`, `setWhatsappLembreteMessage`.
- `app/app/admin/(authenticated)/whatsapp/page.tsx` — fetch + render do novo painel.

**Manual por ambiente (não commitável)**
- Vercel env `LEMBRETE_CRON_SECRET` (staging + prod).
- Supabase Vault: `vault.create_secret('<url da rota>', 'lembrete_route_url')` e `vault.create_secret('<segredo>', 'lembrete_cron_secret')` (staging agora, prod no go-live).

## Decisões travadas

1. Disparo via **pg_cron + pg_net → rota Next**; lógica em TS. ✅
2. Cron **horário fixo** (`0 * * * *`) + gate `horaSP >= horaConfigurada`; horário configurável é só um valor em `configuracoes` (sem reagendar o cron pela UI). ✅
3. Status que recebem: **`confirmado` + `enviar_para_entregador`**; D-1 no fuso `America/Sao_Paulo`. ✅
4. Mensagem **editável com default**; tokens `{nome}` `{pedido}` `{data}` `{horario}`. ✅
5. Segredos via **Supabase Vault** (migração sem segredo; `configuracoes` é leitura pública, não serve). ✅
6. Dedupe por `(pedido, tipo='lembrete', status='enviada')` na RPC; falha reentra na fila. ✅
</content>
</invoke>
