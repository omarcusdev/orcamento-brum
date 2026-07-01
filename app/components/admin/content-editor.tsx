"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { saveConteudo } from "@/lib/admin-actions"
import { Button, Input, Textarea, Select, fieldLabelClass } from "@/components/ui"
import type { HeroContent, FeaturesContent, FaqContent, FooterContent, FeatureItem, FaqItem } from "@/lib/types"

const ICON_OPTIONS = [
  "beer", "truck", "wrench", "dollar-sign", "clock", "shield",
  "star", "heart", "phone", "map-pin", "zap", "gift",
]

const tabs = ["Hero", "Features", "FAQ", "Footer"] as const
type Tab = typeof tabs[number]

type ContentEditorProps = {
  hero: HeroContent | null
  features: FeaturesContent | null
  faq: FaqContent | null
  footer: FooterContent | null
}

const ContentEditor = ({ hero: initialHero, features: initialFeatures, faq: initialFaq, footer: initialFooter }: ContentEditorProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("Hero")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [hero, setHero] = useState<HeroContent>(initialHero ?? {
    titulo: "Chopp gelado no seu evento",
    subtitulo: "Delivery de chopp para festas e eventos no Rio de Janeiro e Baixada Fluminense.",
    cta_texto: "Ver Catalogo",
    cta_whatsapp_texto: "WhatsApp",
  })

  const [features, setFeatures] = useState<FeaturesContent>(initialFeatures ?? {
    titulo: "Por que escolher a ALFA?",
    subtitulo: "Tudo que voce precisa para seu evento, sem complicacao",
    items: [],
  })

  const [faq, setFaq] = useState<FaqContent>(initialFaq ?? {
    titulo: "Perguntas Frequentes",
    subtitulo: "Tire suas duvidas sobre nosso servico",
    items: [],
  })

  const [footer, setFooter] = useState<FooterContent>(initialFooter ?? {
    texto: "ALFA Chopp Delivery",
    links: [],
  })

  const handleSave = async (secao: string, dados: Record<string, unknown>) => {
    setSaving(true)
    setMessage(null)
    try {
      await saveConteudo(secao, dados)
      setMessage("Salvo!")
      setTimeout(() => setMessage(null), 2000)
    } catch {
      setMessage("Erro ao salvar")
    }
    setSaving(false)
  }

  const updateFeatureItem = (index: number, field: keyof FeatureItem, value: string) => {
    setFeatures((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }))
  }

  const addFeatureItem = () => {
    setFeatures((prev) => ({
      ...prev,
      items: [...prev.items, { titulo: "", descricao: "", icone: "star" }],
    }))
  }

  const removeFeatureItem = (index: number) => {
    setFeatures((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const updateFaqItem = (index: number, field: keyof FaqItem, value: string) => {
    setFaq((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }))
  }

  const addFaqItem = () => {
    setFaq((prev) => ({
      ...prev,
      items: [...prev.items, { pergunta: "", resposta: "" }],
    }))
  }

  const removeFaqItem = (index: number) => {
    setFaq((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  const updateFooterLink = (index: number, field: "label" | "url", value: string) => {
    setFooter((prev) => ({
      ...prev,
      links: prev.links.map((link, i) => i === index ? { ...link, [field]: value } : link),
    }))
  }

  const addFooterLink = () => {
    setFooter((prev) => ({
      ...prev,
      links: [...prev.links, { label: "", url: "" }],
    }))
  }

  const removeFooterLink = (index: number) => {
    setFooter((prev) => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setMessage(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              activeTab === tab
                ? "bg-brand-yellow text-brand-black"
                : "bg-brand-surface text-brand-gray-light border border-white/10 hover:border-white/20"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-brand-surface rounded-xl border border-white/10 p-6"
      >
        {activeTab === "Hero" && (
          <div className="space-y-4">
            <div>
              <label className={fieldLabelClass}>Titulo</label>
              <Input value={hero.titulo} onChange={(e) => setHero({ ...hero, titulo: e.target.value })} />
            </div>
            <div>
              <label className={fieldLabelClass}>Subtitulo</label>
              <Textarea value={hero.subtitulo} onChange={(e) => setHero({ ...hero, subtitulo: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelClass}>Texto botao principal</label>
                <Input value={hero.cta_texto} onChange={(e) => setHero({ ...hero, cta_texto: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabelClass}>Texto botao WhatsApp</label>
                <Input value={hero.cta_whatsapp_texto} onChange={(e) => setHero({ ...hero, cta_whatsapp_texto: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => handleSave("hero", hero as unknown as Record<string, unknown>)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Hero"}
            </Button>
          </div>
        )}

        {activeTab === "Features" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelClass}>Titulo da secao</label>
                <Input value={features.titulo} onChange={(e) => setFeatures({ ...features, titulo: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabelClass}>Subtitulo</label>
                <Input value={features.subtitulo} onChange={(e) => setFeatures({ ...features, subtitulo: e.target.value })} />
              </div>
            </div>
            {features.items.map((item, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Item {idx + 1}</span>
                  <button onClick={() => removeFeatureItem(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={item.titulo} onChange={(e) => updateFeatureItem(idx, "titulo", e.target.value)} placeholder="Titulo" />
                  <Select value={item.icone} onChange={(e) => updateFeatureItem(idx, "icone", e.target.value)}>
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </Select>
                </div>
                <Textarea value={item.descricao} onChange={(e) => updateFeatureItem(idx, "descricao", e.target.value)} placeholder="Descricao" rows={2} />
              </div>
            ))}
            <button onClick={addFeatureItem} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar item</button>
            <div>
              <Button onClick={() => handleSave("features", features as unknown as Record<string, unknown>)} disabled={saving}>
                {saving ? "Salvando..." : "Salvar Features"}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "FAQ" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={fieldLabelClass}>Titulo da secao</label>
                <Input value={faq.titulo} onChange={(e) => setFaq({ ...faq, titulo: e.target.value })} />
              </div>
              <div>
                <label className={fieldLabelClass}>Subtitulo</label>
                <Input value={faq.subtitulo} onChange={(e) => setFaq({ ...faq, subtitulo: e.target.value })} />
              </div>
            </div>
            {faq.items.map((item, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Pergunta {idx + 1}</span>
                  <button onClick={() => removeFaqItem(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <Input value={item.pergunta} onChange={(e) => updateFaqItem(idx, "pergunta", e.target.value)} placeholder="Pergunta" />
                <Textarea value={item.resposta} onChange={(e) => updateFaqItem(idx, "resposta", e.target.value)} placeholder="Resposta" rows={2} />
              </div>
            ))}
            <button onClick={addFaqItem} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar pergunta</button>
            <div>
              <Button onClick={() => handleSave("faq", faq as unknown as Record<string, unknown>)} disabled={saving}>
                {saving ? "Salvando..." : "Salvar FAQ"}
              </Button>
            </div>
          </div>
        )}

        {activeTab === "Footer" && (
          <div className="space-y-4">
            <div>
              <label className={fieldLabelClass}>Texto do footer</label>
              <Input value={footer.texto} onChange={(e) => setFooter({ ...footer, texto: e.target.value })} />
            </div>
            {footer.links.map((link, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Link {idx + 1}</span>
                  <button onClick={() => removeFooterLink(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={link.label} onChange={(e) => updateFooterLink(idx, "label", e.target.value)} placeholder="Label" />
                  <Input value={link.url} onChange={(e) => updateFooterLink(idx, "url", e.target.value)} placeholder="URL" />
                </div>
              </div>
            ))}
            <button onClick={addFooterLink} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar link</button>
            <div>
              <Button onClick={() => handleSave("footer", footer as unknown as Record<string, unknown>)} disabled={saving}>
                {saving ? "Salvando..." : "Salvar Footer"}
              </Button>
            </div>
          </div>
        )}

        {message && <p className={`text-sm mt-4 ${message.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{message}</p>}
      </motion.div>
    </div>
  )
}

export default ContentEditor
