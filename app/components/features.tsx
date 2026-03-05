const features = [
  {
    icon: "🍺",
    title: "Chopeira Inclusa",
    description:
      "Chopeira a gelo ou elétrica inclusa em todos os pedidos, sem taxa extra.",
  },
  {
    icon: "🚚",
    title: "Entrega e Retirada",
    description:
      "Entregamos e recolhemos o equipamento. Você só aproveita a festa.",
  },
  {
    icon: "🔧",
    title: "Assistência no Evento",
    description:
      "Oferecemos suporte técnico durante seu evento, caso necessário.",
  },
  {
    icon: "💰",
    title: "Sem Taxa de Instalação",
    description:
      "Instalação gratuita. Preços promocionais para pagamento à vista.",
  },
]

const Features = () => (
  <section className="py-16 px-4 bg-white">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl md:text-4xl font-bold text-brand-black text-center mb-2">
        Por que escolher a ALFA?
      </h2>
      <p className="text-gray-500 text-center mb-12">
        Tudo que você precisa para seu evento, sem complicação
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature) => (
          <div key={feature.title} className="text-center p-6">
            <span className="text-4xl mb-4 block">{feature.icon}</span>
            <h3 className="font-bold text-brand-black mb-2">
              {feature.title}
            </h3>
            <p className="text-sm text-gray-500">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export default Features
