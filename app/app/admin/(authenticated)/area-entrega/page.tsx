import { getDeliveryConfig, getExclusionZones } from "@/lib/queries"
import AreaMapEditor from "@/components/admin/area-map-editor"

const AreaEntregaPage = async () => {
  const [config, zones] = await Promise.all([
    getDeliveryConfig(),
    getExclusionZones(),
  ])

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-white mb-6">Area de Entrega</h1>
      <AreaMapEditor
        initialCenter={{ lat: config.centroLat, lng: config.centroLng }}
        initialRadius={config.raioKm}
        initialZones={zones}
      />
    </div>
  )
}

export default AreaEntregaPage
