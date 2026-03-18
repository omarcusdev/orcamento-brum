"use client"

import { useState, useCallback, useRef } from "react"
import { GoogleMap, useJsApiLoader, Marker, Circle, Polygon, DrawingManager } from "@react-google-maps/api"
import { saveDeliveryArea, createExclusionZone, deleteExclusionZone } from "@/lib/admin-actions"
import type { ZonaExclusao } from "@/lib/types"

const libraries: ("places" | "drawing")[] = ["places", "drawing"]

const mapContainerStyle = { width: "100%", height: "500px", borderRadius: "12px" }

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  ],
}

type AreaMapEditorProps = {
  initialCenter: { lat: number; lng: number }
  initialRadius: number
  initialZones: ZonaExclusao[]
}

const AreaMapEditor = ({ initialCenter, initialRadius, initialZones }: AreaMapEditorProps) => {
  const [center, setCenter] = useState(initialCenter)
  const [radius, setRadius] = useState(initialRadius)
  const [zones, setZones] = useState(initialZones)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  })

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await saveDeliveryArea(radius, center.lat, center.lng)
      setMessage("Area de entrega salva!")
    } catch {
      setMessage("Erro ao salvar")
    }
    setSaving(false)
  }

  const handlePolygonComplete = useCallback(async (polygon: google.maps.Polygon) => {
    const path = polygon.getPath()
    const coords = Array.from({ length: path.getLength() }, (_, i) => ({
      lat: path.getAt(i).lat(),
      lng: path.getAt(i).lng(),
    }))

    polygon.setMap(null)

    try {
      const nome = `Zona ${zones.length + 1}`
      const result = await createExclusionZone(nome, coords)
      setZones((prev) => [...prev, { id: result.id, nome, poligono: coords, created_at: new Date().toISOString() }])
    } catch {
      setMessage("Erro ao criar zona de exclusao")
    }
  }, [zones.length])

  const handleDeleteZone = async (id: string) => {
    try {
      await deleteExclusionZone(id)
      setZones((prev) => prev.filter((z) => z.id !== id))
    } catch {
      setMessage("Erro ao remover zona")
    }
  }

  if (!isLoaded) {
    return (
      <div className="bg-brand-surface rounded-xl border border-white/10 p-8 text-center">
        <p className="text-brand-warm-gray">Carregando mapa...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
        <div className="flex items-end gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-brand-gray-light mb-1.5">Raio de entrega (km)</label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              min={1}
              max={200}
              className="w-full px-3 py-2 rounded-lg bg-brand-dark border border-white/10 focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow outline-none text-sm text-white"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-brand-yellow text-brand-black font-bold rounded-lg text-sm hover:brightness-110 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Salvando..." : "Salvar Area"}
          </button>
        </div>
        {message && <p className={`text-sm ${message.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{message}</p>}
      </div>

      <div className="rounded-xl overflow-hidden border border-white/10">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={10}
          options={mapOptions}
        >
          <Marker
            position={center}
            draggable
            onDragEnd={handleMarkerDragEnd}
            onLoad={(marker) => { markerRef.current = marker }}
          />
          <Circle
            center={center}
            radius={radius * 1000}
            options={{
              fillColor: "#E8B912",
              fillOpacity: 0.1,
              strokeColor: "#E8B912",
              strokeOpacity: 0.6,
              strokeWeight: 2,
            }}
          />
          {zones.map((zone) => (
            <Polygon
              key={zone.id}
              paths={zone.poligono}
              options={{
                fillColor: "#FF4444",
                fillOpacity: 0.3,
                strokeColor: "#FF4444",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          ))}
          <DrawingManager
            onPolygonComplete={handlePolygonComplete}
            options={{
              drawingControl: true,
              drawingControlOptions: {
                position: google.maps.ControlPosition.TOP_CENTER,
                drawingModes: [google.maps.drawing.OverlayType.POLYGON],
              },
              polygonOptions: {
                fillColor: "#FF4444",
                fillOpacity: 0.3,
                strokeColor: "#FF4444",
                strokeWeight: 2,
                editable: false,
              },
            }}
          />
        </GoogleMap>
      </div>

      {zones.length > 0 && (
        <div className="bg-brand-surface rounded-xl border border-white/10 p-5">
          <h3 className="font-display font-bold text-white tracking-wide mb-3">ZONAS DE EXCLUSAO</h3>
          <div className="space-y-2">
            {zones.map((zone) => (
              <div key={zone.id} className="flex items-center justify-between bg-brand-dark rounded-lg px-4 py-2.5">
                <span className="text-sm text-brand-gray-light">{zone.nome ?? "Zona sem nome"}</span>
                <button
                  onClick={() => handleDeleteZone(zone.id)}
                  className="text-red-400 text-sm hover:text-red-300 transition cursor-pointer"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AreaMapEditor
