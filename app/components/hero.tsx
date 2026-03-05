import Image from "next/image"

const Hero = () => (
  <section className="bg-brand-dark text-white py-20 px-4">
    <div className="max-w-6xl mx-auto text-center">
      <Image
        src="/logo-color.png"
        alt="ALFA Chopp Delivery"
        width={120}
        height={120}
        className="mx-auto mb-8"
        priority
      />
      <h1 className="text-4xl md:text-6xl font-bold mb-4">
        Chopp gelado no seu <span className="text-brand-yellow">evento</span>
      </h1>
      <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
        Delivery de chopp com chopeira inclusa para festas, confraternizacoes e eventos
        no Rio de Janeiro e Baixada Fluminense.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <a
          href="#catalogo"
          className="bg-brand-yellow text-brand-black font-bold px-8 py-4 rounded-lg text-lg hover:brightness-110 transition"
        >
          Ver Catalogo
        </a>
        <a
          href="https://wa.me/5521999999999"
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-brand-yellow text-brand-yellow font-bold px-8 py-4 rounded-lg text-lg hover:bg-brand-yellow/10 transition"
        >
          Falar no WhatsApp
        </a>
      </div>
    </div>
  </section>
)

export default Hero
