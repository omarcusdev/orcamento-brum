import Header from "@/components/header"
import Hero from "@/components/hero"
import Storefront from "@/components/storefront"
import Features from "@/components/features"
import Faq from "@/components/faq"
import Footer from "@/components/footer"
import { getActiveProducts } from "@/lib/queries"

const HomePage = async () => {
  const produtos = await getActiveProducts()

  return (
    <>
      <Header />
      <main>
        <Storefront produtos={produtos} hero={<Hero />}>
          <Features />
          <Faq />
        </Storefront>
      </main>
      <Footer />
    </>
  )
}

export default HomePage
