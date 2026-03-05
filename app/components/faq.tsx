"use client"

import { useState } from "react"

const faqs = [
  {
    question: "Qual a área de entrega?",
    answer:
      "Entregamos em quase todo o Rio de Janeiro e Baixada Fluminense. Consulte disponibilidade para sua região.",
  },
  {
    question: "O gelo está incluso?",
    answer:
      "Não, o gelo não está incluso no preço. Caso precise, podemos orientar sobre a quantidade ideal para seu evento.",
  },
  {
    question: "Quais formas de pagamento?",
    answer:
      "Aceitamos Pix, cartão de crédito/débito e dinheiro. Os preços do catálogo são para pagamento à vista (Pix ou dinheiro).",
  },
  {
    question: "Com quanto tempo de antecedência devo fazer o pedido?",
    answer:
      "Recomendamos pelo menos 3 dias de antecedência para garantir a disponibilidade do chopp e equipamento.",
  },
  {
    question: "Posso cancelar meu pedido?",
    answer:
      "Sim, o cancelamento pode ser feito entrando em contato pelo WhatsApp. Consulte nossa política de cancelamento.",
  },
  {
    question: "A chopeira está inclusa no preço?",
    answer:
      "Sim! A chopeira (a gelo ou elétrica) está inclusa em todos os pedidos, sem taxa de instalação.",
  },
]

const FaqItem = ({
  question,
  answer,
}: {
  question: string
  answer: string
}) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left cursor-pointer"
      >
        <span className="font-medium text-brand-black">{question}</span>
        <span className="text-gray-400 text-xl ml-4 shrink-0">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <p className="text-gray-500 text-sm pb-4">{answer}</p>}
    </div>
  )
}

const Faq = () => (
  <section className="py-16 px-4 bg-gray-50">
    <div className="max-w-2xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold text-brand-black text-center mb-2">
        Perguntas Frequentes
      </h2>
      <p className="text-gray-500 text-center mb-8">
        Tire suas dúvidas sobre nosso serviço
      </p>
      <div className="bg-white rounded-xl shadow-sm p-6">
        {faqs.map((faq) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
          />
        ))}
      </div>
    </div>
  </section>
)

export default Faq
