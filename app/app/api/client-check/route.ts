import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const GET = async (req: NextRequest) => {
  const cpf = req.nextUrl.searchParams.get("cpf")
  if (!cpf) return NextResponse.json({ verified: false })

  const supabase = await createClient()
  const { data } = await supabase
    .from("clientes")
    .select("documento_verificado")
    .eq("cpf", cpf)
    .single()

  return NextResponse.json({ verified: data?.documento_verificado ?? false })
}
