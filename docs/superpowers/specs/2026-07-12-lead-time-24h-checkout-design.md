# Antecedência mínima de 24h no checkout do cliente

**Data:** 2026-07-12
**Autor:** Marcus + Claude
**Status:** Aprovado (design), aguardando plano de implementação

## Problema

Hoje o site não tem antecedência mínima para pedir chopp. A única trava de data é
"não pode no passado", comparada em granularidade de **dia** (`checkout-validation.ts`
+ `createOrderSchema` em `schemas.ts`). Um cliente entrando direto no site consegue
marcar um evento para o mesmo dia, daqui a poucas horas — inviável para a operação
(logística de chopeira, gelo, entregador).

Jean pediu uma trava de 24h, **mas com possibilidade de inserção manual** quando
necessário (evento de última hora combinado por fora).

## Objetivo

Exigir que pedidos feitos pelo **cliente no site** tenham o evento com no mínimo
**24h de antecedência** (rolling, contando data + horário do evento). O caminho de
**pedido manual do admin** continua **sem** essa trava — é o escape hatch para casos
combinados manualmente.

## Decisões (confirmadas)

1. **Regra 24h = rolling.** A data+horário do evento deve ser ≥ agora + 24h.
   Ex.: agora sábado 15h → só aceita eventos a partir de domingo 15h.
   (Não é por calendário; a hora do evento conta.)
2. **Bypass = só admin.** A trava vale apenas no fluxo público (`createOrder` /
   `createOrderSchema`). O drawer de pedido manual (`manualOrderInputSchema` /
   `create_manual_order`) e a edição de pedido (`updatePedidoSchema`) continuam
   sem restrição de data — como já são hoje. **Nada a construir no bypass; apenas
   não introduzir a trava nesses caminhos.**
3. **UX = bloqueio no envio.** Mesma tática do "data no passado" que já existe:
   o seletor de data/hora continua deixando escolher qualquer valor, e o pedido é
   barrado no submit com mensagem clara. **Sem** desabilitar horários no dropdown.

## Escopo

### Muda (fluxo do cliente)

**1. Helper puro compartilhado — `app/lib/checkout-validation.ts`**

O arquivo já é um módulo puro (sem `"use server"`), então pode ser importado tanto
pelo componente client (`checkout-form.tsx`) quanto pelo schema server (`schemas.ts`).
Adicionar:

```ts
export const MIN_LEAD_TIME_HOURS = 24

// Brasil não tem horário de verão desde 2019, então o offset é fixo -03:00.
// Fixá-lo torna o cálculo determinístico independente do timezone do runtime
// (o browser do cliente roda em BRT; o server na Vercel roda em UTC).
const BRAZIL_UTC_OFFSET = "-03:00"

export const isBeforeMinLeadTime = (
  dataEvento: string,      // "YYYY-MM-DD"
  horarioEvento: string,   // "HH:MM"
  now: Date = new Date(),
): boolean => {
  const eventAt = new Date(`${dataEvento}T${horarioEvento}:00${BRAZIL_UTC_OFFSET}`)
  return eventAt.getTime() - now.getTime() < MIN_LEAD_TIME_HOURS * 3_600_000
}
```

**Por que o offset fixo importa (correção de bug de timezone):** o check de data-passado
atual faz `new Date(val + "T00:00:00")`, que é interpretado no timezone **local do
runtime**. Na Vercel (UTC), "15h" do evento seria lido como 15h UTC = 12h BRT, e o
cálculo de 24h rejeitaria erroneamente eventos que estão a 24–27h de distância.
Ancorar em `-03:00` resolve: o instante do evento é sempre o horário de parede
brasileiro, e `now.getTime()` já é um instante absoluto (env-agnóstico).

**2. `validateCheckout` — `app/lib/checkout-validation.ts`**

Ganha o parâmetro `horarioEvento`. Depois do check de data-passado existente,
adiciona (só quando o horário está preenchido — o campo é `required` no form, isto é
belt-and-suspenders):

```ts
if (input.horarioEvento && isBeforeMinLeadTime(input.dataEvento, input.horarioEvento, input.now))
  return `Pedidos exigem no mínimo ${MIN_LEAD_TIME_HOURS}h de antecedência`
```

**3. `checkout-form.tsx` — `app/components/checkout-form.tsx`**

Na chamada de `validateCheckout` (handleSubmit), passar `horarioEvento` (a variável
já existe, linha ~66). Nenhuma outra mudança de UI — botão e dropdown ficam iguais.

**4. `createOrderSchema` — `app/lib/schemas.ts`**

O `.refine` atual está preso ao campo `data_evento` e não enxerga `horario_evento`.
Adicionar um `.superRefine` **no nível do objeto** que combina os dois campos:

```ts
export const createOrderSchema = z.object({ /* ...campos... */ })
  .superRefine((val, ctx) => {
    if (isBeforeMinLeadTime(val.data_evento, val.horario_evento)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horario_evento"],
        message: `Pedidos exigem no mínimo ${MIN_LEAD_TIME_HOURS}h de antecedência`,
      })
    }
  })
```

O refine de data-passado por-campo continua como está (mensagem mais clara para datas
obviamente erradas; o check de 24h cobre o resto do futuro próximo).

### Não muda (o bypass — verificar explicitamente que continua livre)

- `manualOrderInputSchema` (`schemas.ts`) — `data_evento` segue só com regex.
- `create_manual_order` (RPC) — sem trava.
- `updatePedidoSchema` (`schemas.ts`) — admin edita para qualquer data/hora.

Não há outro ponto de entrada público que crie pedido (o bot de WhatsApp só confirma,
não cria).

## Fluxo de dados

```
Cliente (browser, BRT)
  checkout-form.handleSubmit
    → validateCheckout({ dataEvento, horarioEvento, now })   [guard client]
        → isBeforeMinLeadTime(...) usando -03:00
    → createOrder(payload)                                   [server action]
        → createOrderSchema.parse(payload)                   [guard server, UTC]
            → superRefine → isBeforeMinLeadTime(...) usando -03:00
```

Dois guards, mesma função pura, mesmo resultado nos dois ambientes graças ao offset
ancorado.

## Tratamento de erro

- Client: `validateCheckout` retorna a string de erro → `setError` já existente exibe
  em vermelho abaixo do form (mesmo caminho do "data no passado").
- Server: `createOrderSchema` falha → `createOrder` já trata `ZodError` e retorna
  `{ error }` (mesmo caminho dos outros erros de validação). Confirmar no plano que
  a mensagem do superRefine chega ao usuário.

## Testes

- **`checkout-validation.test.ts`** (existe): novos casos para `validateCheckout` —
  evento < 24h → mensagem de erro; evento ≥ 24h → `null`; fronteira exata (== 24h) →
  `null`; `horarioEvento` vazio → pula o check de 24h; data no passado → mantém a
  mensagem antiga. Todos passando `now` explícito.
- **`isBeforeMinLeadTime`** (unit, em `checkout-validation.test.ts` ou
  `checkout-datetime.test.ts`): fronteira (23h59 → true, 24h00 → false, 24h01 → false),
  e um caso que prova a correção de tz (mesmo `dataEvento`/`horarioEvento`/`now`
  produz o mesmo booleano independentemente do `TZ` do processo).
- **`createOrderSchema`** (server): payload com evento < 24h falha no `horario_evento`;
  ≥ 24h passa. Verificar se já existe suite de schemas; se não, criar uma mínima só
  para esse caso.

## YAGNI (fora de escopo)

- Número de horas configurável no banco → fica constante `MIN_LEAD_TIME_HOURS = 24`.
- Desabilitar horários "cedo demais" no dropdown do seletor.
- Qualquer override no site público.

## Riscos / notas

- **Timezone**: a decisão de `-03:00` fixo depende de o Brasil continuar sem horário
  de verão. Se voltar, revisar. Documentado inline no código.
- **Consistência client/server**: a mesma função pura roda nos dois lados; o teste de
  tz é o que garante que não divergem.
- **Regressão do check de data-passado**: manter os testes antigos verdes garante que
  a mensagem antiga não sumiu.
