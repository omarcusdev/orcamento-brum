import { createClient } from "@/lib/supabase/server"
import PromocoesList from "@/components/admin/promocoes-list"

const PromocoesAdminPage = async () => {
  const supabase = await createClient()

  const { data: produtos } = await supabase
    .from("produtos")
    .select("*")
    .eq("ativo", true)
    .order("volume_litros", { ascending: false })
    .order("ordem", { ascending: true })

  return <PromocoesList produtos={produtos ?? []} />
}

export default PromocoesAdminPage
