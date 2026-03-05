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
        <Hero />
        <Storefront produtos={produtos} />
        <Features />
        <Faq />
      </main>
      <Footer />
    </>
  )
}

export default HomePage
