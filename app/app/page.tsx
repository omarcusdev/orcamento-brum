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
