import { createClient } from "@/lib/supabase/server"
import FadeIn from "@/components/admin/fade-in"
import EntregadoresList from "@/components/admin/entregadores-list"
import type { Entregador } from "@/lib/types"

const EntregadoresPage = async () => {
  const supabase = await createClient()

  const { data } = await supabase
    .from("entregadores")
    .select("*")
    .order("ativo", { ascending: false })
    .order("nome")

  const entregadores = (data ?? []) as Entregador[]

  return (
    <div>
      <FadeIn>
        <h1 className="font-display text-3xl font-bold text-white tracking-wide mb-6">ENTREGADORES</h1>
      </FadeIn>
      <FadeIn delay={0.05}>
        <EntregadoresList initialEntregadores={entregadores} />
      </FadeIn>
    </div>
  )
}

export default EntregadoresPage
