# ALFA Chopp MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a chopp delivery MVP with visual catalog, order form, admin panel with realtime updates, and WhatsApp automation.

**Architecture:** Next.js 15 App Router with hybrid approach — Server Components for SEO landing page, Server Actions for mutations, Supabase client for reads with RLS. Baileys on VPS for WhatsApp. Monorepo with /app, /whatsapp-api, /supabase.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Supabase (PostgreSQL, Auth, Storage, Realtime, RLS), Node.js + Baileys + Fastify

**Design doc:** `docs/plans/2026-03-05-alfa-chopp-mvp-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `app/` (Next.js project root)
- Create: `whatsapp-api/` (Baileys server root)
- Create: `supabase/` (migrations and config)
- Create: `package.json` (root workspace)

**Step 1: Initialize monorepo with Next.js app**

```bash
cd /Users/marcusgoncalves/projects/orcamento-brum
npx create-next-app@latest app --ts --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --yes
```

**Step 2: Initialize whatsapp-api package**

```bash
mkdir -p whatsapp-api
cd whatsapp-api
npm init -y
npm install fastify @whiskeysockets/baileys qrcode-terminal pino
npm install -D typescript @types/node tsx
```

Create `whatsapp-api/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Initialize supabase directory**

```bash
mkdir -p supabase/migrations supabase/seed
```

**Step 4: Create root package.json for workspace scripts**

Create `package.json` at root:
```json
{
  "name": "alfa-chopp",
  "private": true,
  "scripts": {
    "dev": "npm run dev --prefix app",
    "dev:whatsapp": "npm run dev --prefix whatsapp-api",
    "build": "npm run build --prefix app"
  }
}
```

**Step 5: Configure Tailwind with brand colors**

Edit `app/app/globals.css` — replace content with:
```css
@import "tailwindcss";

@theme {
  --color-brand-yellow: #E8B912;
  --color-brand-black: #1A1A1A;
  --color-brand-dark: #111111;
  --color-brand-white: #FFFFFF;
}
```

**Step 6: Install Supabase client in Next.js app**

```bash
cd app
npm install @supabase/supabase-js @supabase/ssr
```

**Step 7: Add .env.local template**

Create `app/.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_API_URL=
WHATSAPP_API_KEY=
```

**Step 8: Update .gitignore**

Ensure root `.gitignore` includes:
```
node_modules/
.env.local
.env
dist/
.next/
```

**Step 9: Commit**

```bash
git add app/ whatsapp-api/ supabase/ package.json .gitignore
git commit -m "feat: scaffold monorepo with Next.js app, WhatsApp API, and Supabase"
```

---

## Task 2: Supabase Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed/products.sql`

**Step 1: Write the migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
create extension if not exists "pgcrypto";

-- Produtos
create table produtos (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  descricao text,
  volume_litros int not null check (volume_litros in (30, 50)),
  preco_avista numeric(10,2) not null,
  preco_cartao numeric(10,2),
  tipo text not null default 'chopp' check (tipo in ('chopp', 'vinho')),
  foto_url text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Clientes
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text not null unique,
  email text,
  created_at timestamptz not null default now()
);

-- Pedidos
create table pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  status text not null default 'novo' check (status in (
    'novo', 'aguardando_pagamento', 'confirmado', 'em_rota',
    'entregue', 'recolhido', 'finalizado', 'cancelado'
  )),
  endereco text not null,
  data_evento date not null,
  horario_evento time not null,
  observacoes text,
  tipo_chopeira text not null default 'gelo' check (tipo_chopeira in ('gelo', 'eletrica')),
  subtotal numeric(10,2) not null default 0,
  desconto numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  metodo_pagamento text check (metodo_pagamento in ('pix', 'cartao', 'dinheiro')),
  pago boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Itens do pedido
create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  produto_id uuid not null references produtos(id),
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

-- Log de mudanca de status
create table pedido_status_log (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

-- Mensagens WhatsApp
create table mensagens_whatsapp (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('confirmacao', 'lembrete')),
  enviada_em timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'enviada', 'falha'))
);

-- Indexes
create index idx_pedidos_status on pedidos(status);
create index idx_pedidos_data_evento on pedidos(data_evento);
create index idx_pedidos_cliente_id on pedidos(cliente_id);
create index idx_pedido_itens_pedido_id on pedido_itens(pedido_id);
create index idx_mensagens_whatsapp_pedido_id on mensagens_whatsapp(pedido_id);
create index idx_clientes_telefone on clientes(telefone);

-- updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pedidos_updated_at
  before update on pedidos
  for each row execute function update_updated_at();

-- Status log trigger
create or replace function log_pedido_status_change()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into pedido_status_log (pedido_id, status_anterior, status_novo)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger pedidos_status_log
  after update on pedidos
  for each row execute function log_pedido_status_change();

-- RLS
alter table produtos enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pedido_status_log enable row level security;
alter table mensagens_whatsapp enable row level security;

-- Produtos: leitura publica, escrita so admin
create policy "produtos_select_public" on produtos for select using (true);
create policy "produtos_all_admin" on produtos for all using (auth.role() = 'authenticated');

-- Clientes: so admin
create policy "clientes_all_admin" on clientes for all using (auth.role() = 'authenticated');

-- Pedidos: admin le tudo, cliente le pelo id
create policy "pedidos_select_admin" on pedidos for select using (auth.role() = 'authenticated');
create policy "pedidos_insert_anon" on pedidos for insert with check (true);
create policy "pedidos_update_admin" on pedidos for update using (auth.role() = 'authenticated');
create policy "pedidos_select_by_id" on pedidos for select using (true);

-- Pedido itens: mesma logica dos pedidos
create policy "pedido_itens_select" on pedido_itens for select using (true);
create policy "pedido_itens_insert_anon" on pedido_itens for insert with check (true);

-- Status log: so admin
create policy "pedido_status_log_select_admin" on pedido_status_log for select using (auth.role() = 'authenticated');

-- Mensagens WhatsApp: so admin
create policy "mensagens_whatsapp_all_admin" on mensagens_whatsapp for all using (auth.role() = 'authenticated');
```

**Step 2: Write seed data**

Create `supabase/seed/products.sql`:
```sql
insert into produtos (marca, descricao, volume_litros, preco_avista, tipo) values
  ('Donzela', 'Chopp Donzela', 30, 430.00, 'chopp'),
  ('Donzela', 'Chopp Donzela', 50, 550.00, 'chopp'),
  ('Vila Império', 'Chopp Vila Império', 30, 420.00, 'chopp'),
  ('Vila Império', 'Chopp Vila Império', 50, 475.00, 'chopp'),
  ('Chopp do Marquês', 'Chopp do Marquês', 50, 530.00, 'chopp'),
  ('Brahma', 'Chopp Brahma', 50, 850.00, 'chopp'),
  ('Ecobier', 'Chopp Ecobier', 50, 650.00, 'chopp'),
  ('Vila Império Vinho', 'Chopp de Vinho Vila Império', 30, 450.00, 'vinho'),
  ('Vila Império Vinho', 'Chopp de Vinho Vila Império', 50, 550.00, 'vinho');
```

**Step 3: Run migration on Supabase**

Go to Supabase dashboard → SQL Editor → paste and run `001_initial_schema.sql`, then `products.sql`.

**Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema migration and seed data"
```

---

## Task 3: Supabase Client Setup in Next.js

**Files:**
- Create: `app/lib/supabase/client.ts`
- Create: `app/lib/supabase/server.ts`
- Create: `app/lib/supabase/middleware.ts`
- Create: `app/middleware.ts`
- Create: `app/lib/types.ts`

**Step 1: Create database types**

Create `app/lib/types.ts`:
```ts
export type Produto = {
  id: string
  marca: string
  descricao: string | null
  volume_litros: number
  preco_avista: number
  preco_cartao: number | null
  tipo: "chopp" | "vinho"
  foto_url: string | null
  ativo: boolean
  created_at: string
}

export type Cliente = {
  id: string
  nome: string
  telefone: string
  email: string | null
  created_at: string
}

export type PedidoStatus =
  | "novo"
  | "aguardando_pagamento"
  | "confirmado"
  | "em_rota"
  | "entregue"
  | "recolhido"
  | "finalizado"
  | "cancelado"

export type Pedido = {
  id: string
  cliente_id: string
  status: PedidoStatus
  endereco: string
  data_evento: string
  horario_evento: string
  observacoes: string | null
  tipo_chopeira: "gelo" | "eletrica"
  subtotal: number
  desconto: number
  total: number
  metodo_pagamento: "pix" | "cartao" | "dinheiro" | null
  pago: boolean
  created_at: string
  updated_at: string
}

export type PedidoItem = {
  id: string
  pedido_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type PedidoStatusLog = {
  id: string
  pedido_id: string
  status_anterior: string | null
  status_novo: string
  changed_at: string
  changed_by: string | null
}

export type CartItem = {
  produto: Produto
  quantidade: number
}
```

**Step 2: Create browser Supabase client**

Create `app/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr"

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

**Step 3: Create server Supabase client**

Create `app/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Step 4: Create middleware Supabase client**

Create `app/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export const updateSession = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin") {
    const url = request.nextUrl.clone()
    url.pathname = "/admin"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Step 5: Create middleware**

Create `app/middleware.ts`:
```ts
import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export const middleware = async (request: NextRequest) => updateSession(request)

export const config = {
  matcher: ["/admin/:path*"],
}
```

**Step 6: Commit**

```bash
git add app/lib/ app/middleware.ts
git commit -m "feat: add Supabase client setup with auth middleware"
```

---

## Task 4: Landing Page — Layout and Hero

**Files:**
- Modify: `app/app/layout.tsx`
- Create: `app/app/page.tsx`
- Create: `app/components/header.tsx`
- Create: `app/components/hero.tsx`
- Copy logos to: `app/public/`

**Step 1: Copy brand logos to public directory**

```bash
cp logos/LOGO_4_PNG.png app/public/logo-color.png
cp "logos/LOGO_4 SEM TAG.png" app/public/logo-icon.png
cp logos/LOGO_3_PNG.png app/public/logo-white.png
```

**Step 2: Update layout with Inter font and brand metadata**

Modify `app/app/layout.tsx`:
```tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ALFA Chopp Delivery — Chopp para seu evento",
  description: "Delivery e locacao de chopp para eventos no Rio de Janeiro e Baixada Fluminense. Chopeira inclusa, sem taxa de instalacao.",
  openGraph: {
    title: "ALFA Chopp Delivery",
    description: "Chopp gelado para seu evento com entrega e chopeira inclusa.",
    type: "website",
  },
}

const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="pt-BR">
    <body className={`${inter.className} antialiased`}>{children}</body>
  </html>
)

export default RootLayout
```

**Step 3: Create header component**

Create `app/components/header.tsx`:
```tsx
import Image from "next/image"
import Link from "next/link"

const Header = () => (
  <header className="sticky top-0 z-50 bg-brand-dark/95 backdrop-blur-sm border-b border-brand-yellow/20">
    <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      <Link href="/">
        <Image src="/logo-color.png" alt="ALFA Chopp Delivery" width={48} height={48} />
      </Link>
      <a
        href="#catalogo"
        className="bg-brand-yellow text-brand-black font-semibold px-6 py-2 rounded-lg hover:brightness-110 transition"
      >
        Fazer Pedido
      </a>
    </nav>
  </header>
)

export default Header
```

**Step 4: Create hero component**

Create `app/components/hero.tsx`:
```tsx
import Image from "next/image"

const Hero = () => (
  <section className="bg-brand-dark text-white py-20 px-4">
    <div className="max-w-6xl mx-auto text-center">
      <Image
        src="/logo-color.png"
        alt="ALFA Chopp Delivery"
        width={120}
        height={120}
        className="mx-auto mb-8"
        priority
      />
      <h1 className="text-4xl md:text-6xl font-bold mb-4">
        Chopp gelado no seu <span className="text-brand-yellow">evento</span>
      </h1>
      <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
        Delivery de chopp com chopeira inclusa para festas, confraternizacoes e eventos
        no Rio de Janeiro e Baixada Fluminense.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="#catalogo"
          className="bg-brand-yellow text-brand-black font-bold px-8 py-4 rounded-lg text-lg hover:brightness-110 transition"
        >
          Ver Catalogo
        </a>
        <a
          href="https://wa.me/5521999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-brand-yellow text-brand-yellow font-bold px-8 py-4 rounded-lg text-lg hover:bg-brand-yellow/10 transition"
        >
          Falar no WhatsApp
        </a>
      </div>
    </div>
  </section>
)

export default Hero
```

**Step 5: Wire up the landing page**

Modify `app/app/page.tsx`:
```tsx
import Header from "@/components/header"
import Hero from "@/components/hero"

const HomePage = () => (
  <>
    <Header />
    <main>
      <Hero />
    </main>
  </>
)

export default HomePage
```

**Step 6: Verify it runs**

```bash
cd app && npm run dev
```

Open http://localhost:3000 — should see hero with ALFA branding.

**Step 7: Commit**

```bash
git add app/
git commit -m "feat: add landing page layout with hero section and brand assets"
```

---

## Task 5: Landing Page — Product Catalog

**Files:**
- Create: `app/components/catalog.tsx`
- Create: `app/components/product-card.tsx`
- Create: `app/lib/queries.ts`
- Modify: `app/app/page.tsx`

**Step 1: Create server queries**

Create `app/lib/queries.ts`:
```ts
import { createClient } from "@/lib/supabase/server"

export const getActiveProducts = async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("preco_avista", { ascending: true })

  if (error) throw error
  return data
}
```

**Step 2: Create product card component**

Create `app/components/product-card.tsx`:
```tsx
"use client"

import Image from "next/image"
import type { Produto } from "@/lib/types"

type ProductCardProps = {
  produto: Produto
  onAdd: (produto: Produto) => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const ProductCard = ({ produto, onAdd }: ProductCardProps) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 flex flex-col">
    {produto.foto_url ? (
      <div className="relative h-48 bg-gray-100">
        <Image src={produto.foto_url} alt={produto.marca} fill className="object-cover" />
      </div>
    ) : (
      <div className="h-48 bg-gradient-to-br from-brand-yellow/20 to-brand-yellow/5 flex items-center justify-center">
        <span className="text-4xl">🍺</span>
      </div>
    )}
    <div className="p-4 flex flex-col flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-yellow/20 text-brand-black">
          {produto.volume_litros}L
        </span>
        {produto.tipo === "vinho" && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            Vinho
          </span>
        )}
      </div>
      <h3 className="font-bold text-brand-black text-lg">{produto.marca}</h3>
      <p className="text-sm text-gray-500 mb-3">Barril {produto.volume_litros}L com chopeira</p>
      <div className="mt-auto">
        <p className="text-2xl font-bold text-brand-black">{formatPrice(produto.preco_avista)}</p>
        <p className="text-xs text-gray-400">no pix/dinheiro</p>
      </div>
      <button
        onClick={() => onAdd(produto)}
        className="mt-3 w-full bg-brand-yellow text-brand-black font-semibold py-3 rounded-lg hover:brightness-110 transition cursor-pointer"
      >
        Adicionar
      </button>
    </div>
  </div>
)

export default ProductCard
```

**Step 3: Create catalog component**

Create `app/components/catalog.tsx`:
```tsx
"use client"

import { useState } from "react"
import type { Produto } from "@/lib/types"
import ProductCard from "@/components/product-card"

type CatalogProps = {
  produtos: Produto[]
  onAddToCart: (produto: Produto) => void
}

const Catalog = ({ produtos, onAddToCart }: CatalogProps) => {
  const [filter, setFilter] = useState<"todos" | "chopp" | "vinho">("todos")

  const filtered = filter === "todos"
    ? produtos
    : produtos.filter((p) => p.tipo === filter)

  return (
    <section id="catalogo" className="py-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-brand-black text-center mb-2">
          Nossos Chopps
        </h2>
        <p className="text-gray-500 text-center mb-8">
          Escolha seus chopps e monte seu pedido
        </p>
        <div className="flex justify-center gap-2 mb-8">
          {(["todos", "chopp", "vinho"] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFilter(tipo)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer ${
                filter === tipo
                  ? "bg-brand-yellow text-brand-black"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-brand-yellow"
              }`}
            >
              {tipo === "todos" ? "Todos" : tipo === "chopp" ? "Chopp" : "Vinho"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((produto) => (
            <ProductCard key={produto.id} produto={produto} onAdd={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Catalog
```

**Step 4: Update page.tsx to fetch products and wire catalog**

This requires a client wrapper for cart state. Create `app/components/storefront.tsx`:
```tsx
"use client"

import { useState } from "react"
import type { Produto, CartItem } from "@/lib/types"
import Catalog from "@/components/catalog"

type StorefrontProps = {
  produtos: Produto[]
}

const Storefront = ({ produtos }: StorefrontProps) => {
  const [cart, setCart] = useState<CartItem[]>([])

  const addToCart = (produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id)
      if (existing) {
        return prev.map((item) =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }

  return (
    <>
      <Catalog produtos={produtos} onAddToCart={addToCart} />
      {/* Cart and Checkout components will be added in Tasks 6 and 7 */}
    </>
  )
}

export default Storefront
```

Update `app/app/page.tsx`:
```tsx
import Header from "@/components/header"
import Hero from "@/components/hero"
import Storefront from "@/components/storefront"
import { getActiveProducts } from "@/lib/queries"

const HomePage = async () => {
  const produtos = await getActiveProducts()

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Storefront produtos={produtos} />
      </main>
    </>
  )
}

export default HomePage
```

**Step 5: Verify catalog renders with seed data**

```bash
cd app && npm run dev
```

Open http://localhost:3000 — should see product cards.

**Step 6: Commit**

```bash
git add app/
git commit -m "feat: add product catalog with cards, filters, and cart state"
```

---

## Task 6: Cart (Bottom Sheet / Sidebar)

**Files:**
- Create: `app/components/cart.tsx`
- Create: `app/components/cart-item.tsx`
- Modify: `app/components/storefront.tsx`

**Step 1: Create cart item component**

Create `app/components/cart-item.tsx`:
```tsx
import type { CartItem } from "@/lib/types"

type CartItemRowProps = {
  item: CartItem
  onIncrease: () => void
  onDecrease: () => void
  onRemove: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const CartItemRow = ({ item, onIncrease, onDecrease, onRemove }: CartItemRowProps) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-brand-black truncate">{item.produto.marca}</p>
      <p className="text-xs text-gray-400">{item.produto.volume_litros}L</p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrease}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
      >
        −
      </button>
      <span className="text-sm font-medium w-5 text-center">{item.quantidade}</span>
      <button
        onClick={onIncrease}
        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
      >
        +
      </button>
    </div>
    <p className="font-semibold text-sm w-20 text-right">
      {formatPrice(item.produto.preco_avista * item.quantidade)}
    </p>
    <button onClick={onRemove} className="text-gray-300 hover:text-red-500 text-lg cursor-pointer">
      ×
    </button>
  </div>
)

export default CartItemRow
```

**Step 2: Create cart component (bottom sheet mobile, sidebar desktop)**

Create `app/components/cart.tsx`:
```tsx
import type { CartItem } from "@/lib/types"
import CartItemRow from "@/components/cart-item"

type CartProps = {
  items: CartItem[]
  open: boolean
  onClose: () => void
  onIncrease: (produtoId: string) => void
  onDecrease: (produtoId: string) => void
  onRemove: (produtoId: string) => void
  onCheckout: () => void
}

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const Cart = ({ items, open, onClose, onIncrease, onDecrease, onRemove, onCheckout }: CartProps) => {
  const total = items.reduce((sum, item) => sum + item.produto.preco_avista * item.quantidade, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantidade, 0)

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 md:right-0 md:left-auto md:top-0 md:w-96 bg-white z-50 rounded-t-2xl md:rounded-none shadow-2xl flex flex-col max-h-[85vh] md:max-h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-brand-black">
            Carrinho ({totalItems})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-brand-black text-2xl cursor-pointer">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Carrinho vazio</p>
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.produto.id}
                item={item}
                onIncrease={() => onIncrease(item.produto.id)}
                onDecrease={() => onDecrease(item.produto.id)}
                onRemove={() => onRemove(item.produto.id)}
              />
            ))
          )}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex justify-between mb-4">
              <span className="font-medium text-gray-600">Total</span>
              <span className="font-bold text-xl text-brand-black">{formatPrice(total)}</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Chopeira inclusa. Gelo nao incluso.</p>
            <button
              onClick={onCheckout}
              className="w-full bg-brand-yellow text-brand-black font-bold py-4 rounded-lg text-lg hover:brightness-110 transition cursor-pointer"
            >
              Finalizar Pedido
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default Cart
```

**Step 3: Update storefront to wire cart open/close and actions**

Update `app/components/storefront.tsx` to include Cart component and a floating cart button.

**Step 4: Commit**

```bash
git add app/components/
git commit -m "feat: add cart with bottom sheet (mobile) and sidebar (desktop)"
```

---

## Task 7: Checkout Form

**Files:**
- Create: `app/components/checkout-form.tsx`
- Create: `app/lib/actions.ts`
- Modify: `app/components/storefront.tsx`

**Step 1: Create the checkout Server Action**

Create `app/lib/actions.ts`:
```ts
"use server"

import { createClient } from "@/lib/supabase/server"

type CreateOrderInput = {
  nome: string
  telefone: string
  email?: string
  data_evento: string
  horario_evento: string
  endereco: string
  observacoes?: string
  tipo_chopeira: "gelo" | "eletrica"
  metodo_pagamento: "pix" | "cartao" | "dinheiro"
  items: { produto_id: string; quantidade: number; preco_unitario: number }[]
}

export const createOrder = async (input: CreateOrderInput) => {
  const supabase = await createClient()

  const { data: existingClient } = await supabase
    .from("clientes")
    .select("id")
    .eq("telefone", input.telefone)
    .single()

  const clienteId = existingClient?.id ?? (
    await supabase
      .from("clientes")
      .insert({ nome: input.nome, telefone: input.telefone, email: input.email || null })
      .select("id")
      .single()
      .then(({ data }) => data!.id)
  )

  const subtotal = input.items.reduce((sum, item) => sum + item.preco_unitario * item.quantidade, 0)

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      endereco: input.endereco,
      data_evento: input.data_evento,
      horario_evento: input.horario_evento,
      observacoes: input.observacoes || null,
      tipo_chopeira: input.tipo_chopeira,
      metodo_pagamento: input.metodo_pagamento,
      subtotal,
      total: subtotal,
    })
    .select("id")
    .single()

  if (error) throw error

  const itemsToInsert = input.items.map((item) => ({
    pedido_id: pedido.id,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
    subtotal: item.preco_unitario * item.quantidade,
  }))

  await supabase.from("pedido_itens").insert(itemsToInsert)

  return { pedidoId: pedido.id }
}
```

**Step 2: Create checkout form component**

Create `app/components/checkout-form.tsx` with fields: nome, telefone, email, data_evento, horario_evento, endereco, observacoes, tipo_chopeira, metodo_pagamento. On submit, calls `createOrder` Server Action and redirects to `/pedido/[id]/confirmacao`.

**Step 3: Wire checkout into storefront flow**

Update storefront to show checkout form when cart checkout is clicked.

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: add checkout form with server action for order creation"
```

---

## Task 8: Order Confirmation and Tracking Pages

**Files:**
- Create: `app/app/pedido/[id]/page.tsx`
- Create: `app/app/pedido/[id]/confirmacao/page.tsx`
- Create: `app/components/order-status-badge.tsx`
- Create: `app/components/order-timeline.tsx`

**Step 1: Create status badge component**

**Step 2: Create order timeline component**

Shows visual timeline of status changes from `pedido_status_log`.

**Step 3: Create confirmation page**

`/pedido/[id]/confirmacao` — "Pedido recebido!" with order summary and link to tracking.

**Step 4: Create tracking page**

`/pedido/[id]` — shows current status, order details, timeline. Auto-refreshes with Supabase Realtime.

**Step 5: Commit**

```bash
git add app/
git commit -m "feat: add order confirmation and realtime tracking pages"
```

---

## Task 9: Admin — Login Page

**Files:**
- Create: `app/app/admin/page.tsx`
- Create: `app/app/admin/layout.tsx`
- Create: `app/components/admin/login-form.tsx`

**Step 1: Create admin layout with auth check**

**Step 2: Create login form using Supabase Auth**

Email + password form. On success, redirect to `/admin/pedidos`.

**Step 3: Commit**

```bash
git add app/
git commit -m "feat: add admin login page with Supabase Auth"
```

---

## Task 10: Admin — Orders List

**Files:**
- Create: `app/app/admin/pedidos/page.tsx`
- Create: `app/components/admin/order-card.tsx`
- Create: `app/components/admin/status-filter.tsx`

**Step 1: Create status filter chips component**

**Step 2: Create order card component**

Card showing: client name, items summary, event date/time, location, total, payment method, status badge.

**Step 3: Create orders list page with Realtime**

Server component fetches initial data, client component subscribes to Realtime for live updates. New orders animate in at the top.

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: add admin orders list with realtime updates and status filters"
```

---

## Task 11: Admin — Order Detail

**Files:**
- Create: `app/app/admin/pedidos/[id]/page.tsx`
- Create: `app/components/admin/order-detail.tsx`
- Create: `app/components/admin/status-actions.tsx`
- Create: `app/lib/admin-actions.ts`

**Step 1: Create admin Server Actions**

`updateOrderStatus`, `cancelOrder` — update pedidos.status.

**Step 2: Create status action buttons**

Show "next status" button based on current status + cancel button.

**Step 3: Create order detail page**

Full order view: client info (with WhatsApp link), items, event details, status timeline, action buttons.

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: add admin order detail page with status management"
```

---

## Task 12: Admin — Catalog Management

**Files:**
- Create: `app/app/admin/catalogo/page.tsx`
- Create: `app/components/admin/product-form.tsx`
- Create: `app/lib/admin-actions.ts` (add product CRUD actions)

**Step 1: Create product CRUD Server Actions**

`createProduct`, `updateProduct`, `toggleProductActive`.

**Step 2: Create product form (create/edit)**

**Step 3: Create catalog page with product list and toggle**

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: add admin catalog management with CRUD"
```

---

## Task 13: WhatsApp API Server (Baileys)

**Files:**
- Create: `whatsapp-api/src/server.ts`
- Create: `whatsapp-api/src/baileys.ts`
- Create: `whatsapp-api/src/routes.ts`
- Create: `whatsapp-api/package.json` (update scripts)

**Step 1: Create Baileys connection manager**

Handles QR code auth, reconnection, session persistence.

**Step 2: Create Fastify server with routes**

`POST /send-message` — sends WhatsApp message via Baileys.
`GET /status` — health check + connection status.
API key auth middleware.

**Step 3: Add PM2 ecosystem config**

Create `whatsapp-api/ecosystem.config.js` for PM2.

**Step 4: Test locally**

```bash
cd whatsapp-api && npx tsx src/server.ts
```

Scan QR code, test sending a message.

**Step 5: Commit**

```bash
git add whatsapp-api/
git commit -m "feat: add WhatsApp API server with Baileys"
```

---

## Task 14: WhatsApp Integration — Confirmation + Reminder

**Files:**
- Create: `supabase/migrations/002_whatsapp_webhook.sql`
- Modify: `whatsapp-api/src/routes.ts`

**Step 1: Create Supabase Database Webhook**

Configure webhook on `pedidos` INSERT → calls VPS `/send-message` with confirmation template.

**Step 2: Create pg_cron job for reminders**

SQL function that finds confirmed orders with events in next 24h that haven't received a reminder, inserts into `mensagens_whatsapp` with status `pendente`, then calls VPS.

**Step 3: Add retry logic**

Cron also retries messages with status `falha`.

**Step 4: Commit**

```bash
git add supabase/ whatsapp-api/
git commit -m "feat: add WhatsApp confirmation webhook and reminder cron"
```

---

## Task 15: Landing Page — Footer, Info Sections, SEO

**Files:**
- Create: `app/components/features.tsx`
- Create: `app/components/faq.tsx`
- Create: `app/components/footer.tsx`
- Modify: `app/app/page.tsx`

**Step 1: Create features/differentials section**

Cards: chopeira inclusa, sem taxa de instalacao, assistencia no evento, entrega em RJ e Baixada.

**Step 2: Create FAQ section**

Common questions: area de entrega, gelo, pagamento, cancelamento.

**Step 3: Create footer**

Logo, WhatsApp link, copyright.

**Step 4: Commit**

```bash
git add app/
git commit -m "feat: add features, FAQ, and footer sections to landing page"
```

---

## Task 16: Deploy

**Step 1: Create Supabase project**

Create project on supabase.com, run migration and seed.

**Step 2: Configure Vercel**

```bash
cd app && npx vercel link
```

Set environment variables on Vercel dashboard.

**Step 3: Deploy to Vercel**

```bash
npx vercel --prod --yes
```

**Step 4: Deploy WhatsApp API to VPS**

SSH into VPS, clone repo, install deps, configure PM2 + Nginx.

**Step 5: Configure Supabase webhook to point to VPS URL**

**Step 6: End-to-end test**

Place a test order, verify WhatsApp confirmation, check admin panel.

**Step 7: Commit any final fixes**

```bash
git add -A && git commit -m "chore: deployment configuration and final adjustments"
```
