import { createClient } from "@/lib/supabase/server"
import ProductList from "@/components/admin/product-list"

const CatalogoAdminPage = async () => {
  const supabase = await createClient()

  const { data: produtos } = await supabase
    .from("produtos")
    .select("*")
    .order("volume_litros", { ascending: false })
    .order("ordem", { ascending: true })

  return <ProductList produtos={produtos ?? []} />
}

export default CatalogoAdminPage
