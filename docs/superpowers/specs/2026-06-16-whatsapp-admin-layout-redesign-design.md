# Redesign do layout `/admin/whatsapp` — inbox protagonista + drawer de config

**Data:** 2026-06-16
**Status:** Design aprovado (direção) — aguardando review do spec
**Escopo:** Reorganização de layout/UX da página `/admin/whatsapp`. **Não muda o que cada painel de config faz** nem nenhuma server action; é reposicionamento + animação.

## Problema

Hoje `page.tsx` empilha verticalmente, na seção RECURSOS, **5 painéis de configuração** (Recursos/features, Status de entrega, Lembrete D-1, Bot saudação, Atendente IA), depois Conexão + Alerta lado a lado, e só **no fim** as Conversas (o inbox). O inbox — que é a tela de uso diário — fica soterrado embaixo de config que se mexe raramente. É "uma tela de WhatsApp com o WhatsApp lá no fim".

## Abordagem escolhida

**Inbox como protagonista + configuração num drawer lateral** (decidido entre 3 opções: página separada, drawer/modal, abas → escolhido **drawer**, por manter o inbox sempre no centro e ser o que melhor aproveita "abre/fecha" + animação).

### Tela principal (drawer fechado) — uso diário
- **Header da página:** título "WhatsApp" + **chip de status de conexão** (sempre visível) + botão **⚙ Configurar** (à direita).
- **Corpo:** o inbox (`AtendimentoClient`) ocupa o resto da tela como protagonista.
  - Se `atendimento` estiver OFF: placeholder atual ("ligue o Atendimento"), agora com um botão **"Abrir configurações"** que abre o drawer já na seção Recursos.

### Chip de status de conexão (header)
- Reflete o estado da conexão de forma glanceável:
  - **Conectado** → verde `● Conectado · <número formatado>`
  - **Reconectando** → amarelo pulsando `● Reconectando…`
  - **Conectando/pareando** → cinza `● Conectando…`
  - **Desconectado** → vermelho, clicável: `● Desconectado — Conectar`
- Clicar no chip abre o drawer já na seção **Conexão**.
- A lógica de "connection → {estado, label, tom, pulsar}" vive num módulo **puro** testável (`app/lib/whatsapp/connection-status.ts`), sem React.

### Drawer de configuração (drawer aberto)
- Desliza da **direita** sobre um backdrop que escurece o inbox. **Reusa exatamente o padrão do `edit-order-drawer.tsx`** (`AnimatePresence` → `motion.div` backdrop fade `bg-black/60 backdrop-blur-sm z-50` → `motion.aside initial x:"100%" animate x:0 exit x:"100%" transition tween 0.25s`, `max-w-xl`, `bg-brand-surface`, coluna com `overflow-y-auto`).
- **Fecha** por: botão ✕ no header, clique no backdrop, **tecla Esc** (adição de a11y sobre o padrão atual). `body` com scroll travado enquanto aberto.
- **Conteúdo = acordeão** das seções de config, **1 aberta por vez**, na ordem:
  1. **Recursos** (3 toggles master: confirmação / atendimento / alerta) — primeiro, é o gatekeeper do inbox
  2. **Conexão** (parear / trocar / desconectar — o `WhatsAppConnection` atual)
  3. **Status de entrega**
  4. **Lembrete D-1**
  5. **Bot — saudação**
  6. **Atendente IA**
  7. **Alerta por email**

### Acordeão — como os painéis existentes encaixam
Cada painel atual já é **cabeçalho (ícone + título + Switch master) + corpo** (ex.: `whatsapp-bot-panel.tsx` tem `useState(aberto)` controlando o reveal do corpo). Modelo: **cada painel mantém seu próprio cabeçalho** (incluindo o `Switch` master, que continua visível sem expandir → glanceabilidade de on/off preservada) e a **expansão do corpo é coordenada pelo drawer**, 1 por vez:
- Cada painel passa a receber `expanded`/`onToggleExpand` por prop **em vez** do seu `aberto` local. O cabeçalho ganha um chevron e fica clicável pra expandir.
- O corpo é revelado por um helper compartilhado **`<Collapsible open>`** (framer-motion: altura + opacidade) — DRY entre os painéis, em vez de cada um reimplementar.
- O drawer guarda `openSection` (string | null) e garante que abrir uma fecha a anterior (reducer puro testável).
- Painéis que **hoje não têm collapse** (Recursos, Conexão, Alerta por email) ganham o mesmo cabeçalho-com-chevron + `<Collapsible>` em volta do conteúdo, pra ficarem uniformes no acordeão.
- **Sem hoisting de toggle**: o `Switch` master não migra pro componente do acordeão; ele permanece dentro do cabeçalho do próprio painel. Isso evita levantar estado de toggle e mantém o refactor mecânico.
- Comportamento de "corpo de detalhe só aparece com master ON" é preservado por painel (não regredir).

### Animações no escopo
- Drawer: slide-in da direita (~250ms tween) + backdrop fade — via o padrão framer-motion existente.
- Acordeão: expand/collapse suave (altura + fade) ao trocar de seção.
- Switches: transição que o primitivo `Switch` já tem.
- Chip de conexão: pulsa no estado "reconectando" (o `WhatsAppConnection` já tem o ping animado; reusar o mesmo efeito).

## Arquitetura de componentes

- **`app/app/admin/(authenticated)/whatsapp/page.tsx`** (MODIFICAR) — continua server component, continua o `Promise.all` das 8 server actions, mas renderiza um único `<WhatsappAdminShell initial={...} />` passando todos os dados.
- **`app/components/admin/whatsapp/whatsapp-admin-shell.tsx`** (NOVO, client) — dono do estado de UI: `drawerOpen`, `openSection`, e o polling de conexão (hook `useWhatsappConnection(initial)` que faz o GET a cada ~3s — **um único poll**, alimentando o chip e a seção Conexão). Renderiza header (título + `<ConnectionChip>` + botão ⚙) + área do inbox (`AtendimentoClient` ou placeholder) + `<ConfigDrawer>`.
- **`app/components/admin/whatsapp/connection-chip.tsx`** (NOVO, client) — consome `connection`, usa `connectionStatus()` puro pra renderizar o chip; `onClick` abre o drawer na Conexão.
- **`app/components/admin/whatsapp/config-drawer.tsx`** (NOVO, client) — a casca slide-in (padrão `edit-order-drawer`), Esc/backdrop/✕, recebe `open`, `onClose`, `openSection`, `onOpenSection`, e todos os `initial` de config + `connection`/`refresh`. Monta os `AccordionSection`s com os painéis dentro.
- **`app/components/admin/whatsapp/collapsible.tsx`** (NOVO, client) — `<Collapsible open>` que anima altura+opacidade do corpo (framer-motion). Usado por todos os painéis pra o reveal.
- **`app/lib/whatsapp/connection-status.ts`** (NOVO, puro) — `connectionStatus(connection) → { estado, label, tom, pulsar }`. Testável.
- **`app/lib/whatsapp/accordion.ts`** (NOVO, puro) — reducer/função `toggleSection(atual, alvo) → próximo` (abrir fecha a anterior; clicar na aberta fecha). Testável.
- **Painéis existentes** (`whatsapp-features-panel`, `whatsapp-status-entrega-panel`, `whatsapp-lembrete-panel`, `whatsapp-bot-panel`, `whatsapp-agente-panel`, `whatsapp-connection`, `whatsapp-alert-email`) (MODIFICAR, moderado e mecânico) — trocam o `aberto` local por `expanded`/`onToggleExpand` via prop e usam `<Collapsible>`; os 3 sem collapse ganham cabeçalho-com-chevron. `WhatsAppConnection` vira controlado (recebe `connection`/`refresh` do shell em vez de manter o próprio poll). Lógica de save/optimistic/rollback **intacta**.

### Fluxo de dados
Server (`page.tsx`) busca tudo → passa `initial` pro `WhatsappAdminShell` (client) → shell distribui pros painéis (sem mudança no contrato `initial` de cada painel) + controla `openSection`/`drawerOpen` + poll de conexão. Mutations continuam pelas mesmas server actions de cada painel.

## Estados e edge cases
- **Atendimento OFF:** inbox vira placeholder com CTA "Abrir configurações" → drawer na seção Recursos.
- **Desconectado:** chip vermelho clicável → drawer na seção Conexão.
- **Mobile:** header (chip + ⚙) quebra/encolhe; drawer ocupa largura cheia (`w-full max-w-xl` já cobre). Inbox responsivo (comportamento atual do `AtendimentoClient`).
- **Sem JS / SSR:** o server component entrega os dados; o shell hidrata. Sem estado de loading novo (dados já vêm prontos, como hoje).
- **Drawer aberto + navegação:** fechar no Esc/backdrop; sem persistir estado entre reloads (YAGNI).

## Testes
- **Puro, unit (vitest):** `connectionStatus()` — mapeia cada combinação (connected+paired, paired-só=reconectando, connecting, idle=desconectado) pro `{estado,label,tom,pulsar}` certo.
- **Reducer do acordeão:** abrir seção fecha a anterior; clicar na aberta fecha (toggle). Extrair como função pura se ajudar o teste.
- **Componentes** ficam finos (apresentação); a lógica testável sai pros módulos puros — segue o padrão do projeto (módulos puros testados + componentes finos).
- **Regressão:** os testes existentes dos painéis continuam válidos (lógica de save inalterada). Rodar `tsc` + suíte completa.

## Fora de escopo (não-objetivos)
- Mudar o que cada painel configura, textos de FAQ, regras do bot, ou qualquer server action.
- Reagrupar/renomear funções de config (ex.: juntar saudação + agente). Pode virar follow-up.
- Persistência do estado do drawer entre sessões.
- Backup/runbook de conexão (coberto pelo produto; FRE-5 cancelada).

## Decisões em aberto
Nenhuma — premissas confirmadas no companion visual (direção drawer + inbox protagonista aprovada).
