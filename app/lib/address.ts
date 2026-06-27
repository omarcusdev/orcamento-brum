import type { AddressData } from "@/components/address-autocomplete"

export type EnderecoCompleto = {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  complemento: string
  lat: number
  lng: number
}

// Google place -> the stored endereco_completo shape. The two admin drawers built this object
// inline identically; the only per-call difference is whether an existing complemento is kept.
export const addressDataToEnderecoCompleto = (addr: AddressData, complemento = ""): EnderecoCompleto => ({
  rua: addr.rua,
  numero: addr.numero,
  bairro: addr.bairro,
  cidade: addr.cidade,
  estado: addr.estado,
  cep: addr.cep,
  complemento,
  lat: addr.lat,
  lng: addr.lng,
})
