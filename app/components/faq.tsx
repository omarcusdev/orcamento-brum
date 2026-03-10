"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const faqs = [
  {
    question: "Qual a area de entrega?",
    answer: "Entregamos em quase todo o Rio de Janeiro e Baixada Fluminense. Consulte disponibilidade para sua regiao.",
  },
  {
    question: "O gelo esta incluso?",
    answer: "Nao, o gelo nao esta incluso no preco. Caso precise, podemos orientar sobre a quantidade ideal para seu evento.",
  },
  {
    question: "Quais formas de pagamento?",
    answer: "Aceitamos Pix, cartao de credito/debito e dinheiro. Os precos do catalogo sao para pagamento a vista (Pix ou dinheiro).",
  },
  {
    question: "Com quanto tempo de antecedencia devo fazer o pedido?",
    answer: "Recomendamos pelo menos 3 dias de antecedencia para garantir a disponibilidade do chopp e equipamento.",
  },
  {
    question: "Posso cancelar meu pedido?",
    answer: "Sim, o cancelamento pode ser feito entrando em contato pelo WhatsApp. Consulte nossa politica de cancelamento.",
  },
  {
    question: "A chopeira esta inclusa no preco?",
    answer: "Sim! A chopeira (a gelo ou eletrica) esta inclusa em todos os pedidos, sem taxa de instalacao.",
  },
]

const FaqItem = ({ question, answer, index }: { question: string; answer: string; index: number }) => {
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

const Faq = () => (
  <section className="py-20 px-4 bg-brand-surface">
    <div className="max-w-2xl mx-auto">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="font-display text-3xl md:text-5xl font-bold text-white text-center mb-3 uppercase tracking-wider"
      >
        Perguntas Frequentes
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-brand-gray-light text-center mb-10"
      >
        Tire suas duvidas sobre nosso servico
      </motion.p>
      <div className="bg-brand-black rounded-lg p-6 shadow-sm border border-white/5">
        {faqs.map((faq, idx) => (
          <FaqItem key={faq.question} question={faq.question} answer={faq.answer} index={idx} />
        ))}
      </div>
    </div>
  </section>
)

export default Faq
