import Header from "@/components/header"
import Hero from "@/components/hero"
import Storefront from "@/components/storefront"
import Features from "@/components/features"
import Faq from "@/components/faq"
import Footer from "@/components/footer"
import { getActiveProducts, getConfig, getConteudo } from "@/lib/queries"
import type { HeroContent, FeaturesContent, FaqContent, FooterContent } from "@/lib/types"

const HomePage = async () => {
  const [produtos, whatsappNumber, heroContent, featuresContent, faqContent, footerContent] = await Promise.all([
    getActiveProducts(),
    getConfig("whatsapp_numero"),
    getConteudo("hero") as Promise<HeroContent | null>,
    getConteudo("features") as Promise<FeaturesContent | null>,
    getConteudo("faq") as Promise<FaqContent | null>,
    getConteudo("footer") as Promise<FooterContent | null>,
  ])

  const whatsapp = whatsappNumber ?? "5521999999999"

  return (
    <>
      <Header />
      <main>
        <Storefront produtos={produtos} hero={<Hero whatsappNumber={whatsapp} content={heroContent} />}>
          <Features content={featuresContent} />
          <Faq content={faqContent} />
        </Storefront>
      </main>
      <Footer whatsappNumber={whatsapp} content={footerContent} />
    </>
  )
}

export default HomePage
