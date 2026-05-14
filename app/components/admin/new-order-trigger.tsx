"use client"

import { useState } from "react"
import ManualOrderDrawer from "@/components/admin/manual-order-drawer"
import type { Produto } from "@/lib/types"

type Props = {
  produtos: Produto[]
}

const NewOrderTrigger = ({ produtos }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-yellow text-brand-black font-bold px-4 py-2 rounded-lg text-sm hover:brightness-110 transition cursor-pointer"
      >
        + Novo pedido manual
      </button>
      <ManualOrderDrawer open={open} onClose={() => setOpen(false)} produtos={produtos} />
    </>
  )
}

export default NewOrderTrigger
