const EARTH_RADIUS_KM = 6371

const toRad = (deg: number) => (deg * Math.PI) / 180

export const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(a))
}

type Point = { lat: number; lng: number }

export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  const { lat: x, lng: y } = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng
    const xj = polygon[j].lat, yj = polygon[j].lng
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export const isAddressInDeliveryArea = (
  addressLat: number,
  addressLng: number,
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  exclusionZones: Point[][]
): boolean => {
  const distance = haversineDistance(addressLat, addressLng, centerLat, centerLng)
  if (distance > radiusKm) return false
  for (const zone of exclusionZones) {
    if (isPointInPolygon({ lat: addressLat, lng: addressLng }, zone)) return false
  }
  return true
}
