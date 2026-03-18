"use client"

import { useRef, useCallback, useState } from "react"
import { useJsApiLoader, StandaloneSearchBox } from "@react-google-maps/api"

const libraries: ("places")[] = ["places"]

export type AddressData = {
  rua: string
  numero: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  lat: number
  lng: number
  formatted: string
}

type AddressAutocompleteProps = {
  onAddressSelect: (address: AddressData) => void
  inputClassName: string
}

const AddressAutocomplete = ({ onAddressSelect, inputClassName }: AddressAutocompleteProps) => {
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null)
  const [inputValue, setInputValue] = useState("")

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  })

  const onPlacesChanged = useCallback(() => {
    const places = searchBoxRef.current?.getPlaces()
    if (!places || places.length === 0) return

    const place = places[0]
    const components = place.address_components ?? []

    const get = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name ?? ""

    const getShort = (type: string) =>
      components.find((c) => c.types.includes(type))?.short_name ?? ""

    const address: AddressData = {
      rua: get("route"),
      numero: get("street_number"),
      bairro: get("sublocality_level_1") || get("sublocality") || get("neighborhood"),
      cidade: get("administrative_area_level_2") || get("locality"),
      estado: getShort("administrative_area_level_1"),
      cep: get("postal_code"),
      lat: place.geometry?.location?.lat() ?? 0,
      lng: place.geometry?.location?.lng() ?? 0,
      formatted: place.formatted_address ?? "",
    }

    setInputValue(address.formatted)
    onAddressSelect(address)
  }, [onAddressSelect])

  if (!isLoaded) {
    return (
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Digite o endereco do evento..."
        className={inputClassName}
      />
    )
  }

  return (
    <StandaloneSearchBox
      onLoad={(ref) => { searchBoxRef.current = ref }}
      onPlacesChanged={onPlacesChanged}
    >
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Digite o endereco do evento..."
        className={inputClassName}
      />
    </StandaloneSearchBox>
  )
}

export default AddressAutocomplete
