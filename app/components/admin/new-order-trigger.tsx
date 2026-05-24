"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import ManualOrderDrawer from "@/components/admin/manual-order-drawer"
import { Button } from "@/components/ui"
import type { Produto } from "@/lib/types"

type Props = {
  produtos: Produto[]
}

const NewOrderTrigger = ({ produtos }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo pedido manual
      </Button>
      <ManualOrderDrawer open={open} onClose={() => setOpen(false)} produtos={produtos} />
    </>
  )
}

export default NewOrderTrigger
