import HeaderLanding from "@/components/landing/header-landing"
import HeroLanding from "@/components/landing/hero-landing"
import Calculator from "@/components/landing/calculator"
import FooterLanding from "@/components/landing/footer-landing"
import Storefront from "@/components/storefront"
import Features from "@/components/features"
import Faq from "@/components/faq"
import { getActiveProducts, getConfig, getConteudo } from "@/lib/queries"
import type { FeaturesContent, FaqContent } from "@/lib/types"

const HomePage = async () => {
  const [produtos, whatsappNumber, featuresContent, faqContent] = await Promise.all([
    getActiveProducts(),
    getConfig("whatsapp_numero"),
    getConteudo("features") as Promise<FeaturesContent | null>,
    getConteudo("faq") as Promise<FaqContent | null>,
  ])

  const whatsapp = whatsappNumber ?? "5521999999999"

  return (
    <>
      <HeaderLanding />
      <main>
        <HeroLanding whatsappNumber={whatsapp} />
        <Calculator whatsappNumber={whatsapp} />
        <Storefront produtos={produtos}>
          <Features content={featuresContent} />
          <Faq content={faqContent} />
        </Storefront>
      </main>
      <FooterLanding whatsappNumber={whatsapp} />
    </>
  )
}

export default HomePage
