"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { FaqContent } from "@/lib/types"

const defaultFaqs = [
  {
    question: "Qual a área de entrega?",
    answer: "Atendemos quase todo o Rio de Janeiro e a Baixada Fluminense. Você consulta a disponibilidade do seu endereço direto no checkout.",
  },
  {
    question: "Tem taxa de entrega?",
    answer: "Sim, cobramos um frete calculado conforme seu endereço. O valor aparece no checkout antes de você confirmar o pedido.",
  },
  {
    question: "Com quanto tempo de antecedência devo fazer o pedido?",
    answer: "Recomendamos pelo menos 3 dias. Trabalhamos com agenda limitada (2 pedidos por horário), então quanto mais cedo você reservar, mais garantida fica a disponibilidade.",
  },
  {
    question: "Quais formas de pagamento?",
    answer: "Aceitamos Pix, cartão de crédito/débito e dinheiro. Os preços do catálogo são para pagamento à vista (Pix ou dinheiro). O pagamento é feito na entrega.",
  },
  {
    question: "Por que vocês pedem meus documentos?",
    answer: "Pedimos um documento pessoal e um comprovante de residência para confirmar a identidade e o endereço de entrega — padrão para delivery de equipamento de alto valor. Os arquivos ficam armazenados com segurança e são usados só para verificação.",
  },
  {
    question: "Posso cancelar meu pedido?",
    answer: "Sim. Fale com a gente pelo WhatsApp o quanto antes. Quanto mais próximo do evento, mais difícil reverter o que já foi separado.",
  },
  {
    question: "O que está incluso no pedido?",
    answer: "O barril de chopp, a chopeira elétrica e a instalação já vêm inclusos. Você só precisa providenciar gelo (para refrigerar a chopeira) e copos para os convidados.",
  },
  {
    question: "Como funciona a chopeira?",
    answer: "A chopeira elétrica é entregue, instalada e configurada pela nossa equipe. É só ligar na tomada e tirar chopp. Sem mistério, sem complicação.",
  },
  {
    question: "Como acompanho meu pedido?",
    answer: "Clique em \"Meus Pedidos\" no topo do site e informe seu CPF. Você vê o status em tempo real: confirmado, em rota, entregue e recolhido.",
  },
  {
    question: "Vocês buscam o equipamento depois do evento?",
    answer: "Sim. Combinamos um horário de recolhimento (chopeira + barris vazios) após o seu evento. Você só precisa deixar o equipamento acessível.",
  },
]

const FaqItemComponent = ({ question, answer, index }: { question: string; answer: string; index: number }) => {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="border-b border-white/5 last:border-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group"
      >
        <span className="font-medium text-white group-hover:text-brand-amber transition-colors duration-200">{question}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-brand-yellow text-xl ml-4 shrink-0"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="text-brand-gray-light text-sm pb-5 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

type FaqProps = {
  content?: FaqContent | null
}

const Faq = ({ content }: FaqProps) => {
  const titulo = content?.titulo ?? "Perguntas Frequentes"
  const subtitulo = content?.subtitulo ?? "Tire suas dúvidas sobre nosso serviço"
  const items = content?.items && content.items.length > 0
    ? content.items.map((item) => ({ question: item.pergunta, answer: item.resposta }))
    : defaultFaqs

  return (
    <section id="faq" className="py-20 px-4 bg-brand-surface">
      <div className="max-w-2xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-display text-3xl md:text-5xl font-bold text-white text-center mb-3 uppercase tracking-wider"
        >
          {titulo}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-brand-gray-light text-center mb-10"
        >
          {subtitulo}
        </motion.p>
        <div className="bg-brand-black rounded-lg p-6 shadow-sm border border-white/5">
          {items.map((faq, idx) => (
            <FaqItemComponent key={idx} question={faq.question} answer={faq.answer} index={idx} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Faq
