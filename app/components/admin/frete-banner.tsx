"use client"

const FreteBanner = () => {
  const handleClick = () => {
    const freteInput = document.querySelector<HTMLInputElement>("[data-frete-input]")
    if (freteInput) {
      freteInput.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => freteInput.focus(), 400)
    }
  }

  return (
    <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-6">
      <span className="text-amber-400 text-sm font-medium">Frete nao definido para este pedido</span>
      <button
        onClick={handleClick}
        className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-500/30 transition cursor-pointer"
      >
        Definir frete
      </button>
    </div>
  )
}

export default FreteBanner
