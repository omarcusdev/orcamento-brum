import { getConteudo } from "@/lib/queries"
import ContentEditor from "@/components/admin/content-editor"
import type { HeroContent, FeaturesContent, FaqContent, FooterContent } from "@/lib/types"

const ConteudoPage = async () => {
  const [hero, features, faq, footer] = await Promise.all([
    getConteudo("hero") as Promise<HeroContent | null>,
    getConteudo("features") as Promise<FeaturesContent | null>,
    getConteudo("faq") as Promise<FaqContent | null>,
    getConteudo("footer") as Promise<FooterContent | null>,
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">Conteudo da Pagina</h1>
      <ContentEditor hero={hero} features={features} faq={faq} footer={footer} />
    </div>
  )
}

export default ConteudoPage
