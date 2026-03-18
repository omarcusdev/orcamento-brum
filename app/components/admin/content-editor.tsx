"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { saveConteudo } from "@/lib/admin-actions"
import type { HeroContent, FeaturesContent, FaqContent, FooterContent, FeatureItem, FaqItem } from "@/lib/types"

const ICON_OPTIONS = [
  "beer", "truck", "wrench", "dollar-sign", "clock", "shield",
  "star", "heart", "phone", "map-pin", "zap", "gift",
]

const tabs = ["Hero", "Features", "FAQ", "Footer"] as const
type Tab = typeof tabs[number]

const inputClassName = "w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white placeholder-brand-warm-gray"
const labelClassName = "block text-sm font-medium text-brand-gray-light mb-1"

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
              <label className={labelClassName}>Titulo</label>
              <input value={hero.titulo} onChange={(e) => setHero({ ...hero, titulo: e.target.value })} className={inputClassName} />
            </div>
            <div>
              <label className={labelClassName}>Subtitulo</label>
              <textarea value={hero.subtitulo} onChange={(e) => setHero({ ...hero, subtitulo: e.target.value })} rows={2} className={`${inputClassName} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Texto botao principal</label>
                <input value={hero.cta_texto} onChange={(e) => setHero({ ...hero, cta_texto: e.target.value })} className={inputClassName} />
              </div>
              <div>
                <label className={labelClassName}>Texto botao WhatsApp</label>
                <input value={hero.cta_whatsapp_texto} onChange={(e) => setHero({ ...hero, cta_whatsapp_texto: e.target.value })} className={inputClassName} />
              </div>
            </div>
            <button
              onClick={() => handleSave("hero", hero as unknown as Record<string, unknown>)}
              disabled={saving}
              className="px-6 py-2.5 bg-brand-yellow text-brand-black font-bold rounded-lg text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Hero"}
            </button>
          </div>
        )}

        {activeTab === "Features" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Titulo da secao</label>
                <input value={features.titulo} onChange={(e) => setFeatures({ ...features, titulo: e.target.value })} className={inputClassName} />
              </div>
              <div>
                <label className={labelClassName}>Subtitulo</label>
                <input value={features.subtitulo} onChange={(e) => setFeatures({ ...features, subtitulo: e.target.value })} className={inputClassName} />
              </div>
            </div>
            {features.items.map((item, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Item {idx + 1}</span>
                  <button onClick={() => removeFeatureItem(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={item.titulo} onChange={(e) => updateFeatureItem(idx, "titulo", e.target.value)} placeholder="Titulo" className={inputClassName} />
                  <select value={item.icone} onChange={(e) => updateFeatureItem(idx, "icone", e.target.value)} className={inputClassName}>
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
                <textarea value={item.descricao} onChange={(e) => updateFeatureItem(idx, "descricao", e.target.value)} placeholder="Descricao" rows={2} className={`${inputClassName} resize-none`} />
              </div>
            ))}
            <button onClick={addFeatureItem} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar item</button>
            <div>
              <button
                onClick={() => handleSave("features", features as unknown as Record<string, unknown>)}
                disabled={saving}
                className="px-6 py-2.5 bg-brand-yellow text-brand-black font-bold rounded-lg text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Features"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "FAQ" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClassName}>Titulo da secao</label>
                <input value={faq.titulo} onChange={(e) => setFaq({ ...faq, titulo: e.target.value })} className={inputClassName} />
              </div>
              <div>
                <label className={labelClassName}>Subtitulo</label>
                <input value={faq.subtitulo} onChange={(e) => setFaq({ ...faq, subtitulo: e.target.value })} className={inputClassName} />
              </div>
            </div>
            {faq.items.map((item, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Pergunta {idx + 1}</span>
                  <button onClick={() => removeFaqItem(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <input value={item.pergunta} onChange={(e) => updateFaqItem(idx, "pergunta", e.target.value)} placeholder="Pergunta" className={inputClassName} />
                <textarea value={item.resposta} onChange={(e) => updateFaqItem(idx, "resposta", e.target.value)} placeholder="Resposta" rows={2} className={`${inputClassName} resize-none`} />
              </div>
            ))}
            <button onClick={addFaqItem} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar pergunta</button>
            <div>
              <button
                onClick={() => handleSave("faq", faq as unknown as Record<string, unknown>)}
                disabled={saving}
                className="px-6 py-2.5 bg-brand-yellow text-brand-black font-bold rounded-lg text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar FAQ"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "Footer" && (
          <div className="space-y-4">
            <div>
              <label className={labelClassName}>Texto do footer</label>
              <input value={footer.texto} onChange={(e) => setFooter({ ...footer, texto: e.target.value })} className={inputClassName} />
            </div>
            {footer.links.map((link, idx) => (
              <div key={idx} className="bg-brand-dark rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-warm-gray">Link {idx + 1}</span>
                  <button onClick={() => removeFooterLink(idx)} className="text-red-400 text-xs hover:text-red-300 cursor-pointer">Remover</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={link.label} onChange={(e) => updateFooterLink(idx, "label", e.target.value)} placeholder="Label" className={inputClassName} />
                  <input value={link.url} onChange={(e) => updateFooterLink(idx, "url", e.target.value)} placeholder="URL" className={inputClassName} />
                </div>
              </div>
            ))}
            <button onClick={addFooterLink} className="text-brand-yellow text-sm font-medium hover:text-brand-amber transition cursor-pointer">+ Adicionar link</button>
            <div>
              <button
                onClick={() => handleSave("footer", footer as unknown as Record<string, unknown>)}
                disabled={saving}
                className="px-6 py-2.5 bg-brand-yellow text-brand-black font-bold rounded-lg text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Footer"}
              </button>
            </div>
          </div>
        )}

        {message && <p className={`text-sm mt-4 ${message.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{message}</p>}
      </motion.div>
    </div>
  )
}

export default ContentEditor
