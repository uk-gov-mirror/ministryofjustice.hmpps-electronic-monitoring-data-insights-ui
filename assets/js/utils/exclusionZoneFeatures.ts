import Feature from 'ol/Feature'
import GeoJSON from 'ol/format/GeoJSON'
import { circular } from 'ol/geom/Polygon'

const DATA_PROJECTION = 'EPSG:4326'
const MAP_PROJECTION = 'EPSG:3857'
const CIRCLE_SIDES = 64

type ExclusionZoneData = {
  name: string
  address?: string
  geometry?:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'Point'; coordinates: number[]; radiusMetres?: number }
}

let geoJson: GeoJSON | undefined
const getGeoJson = (): GeoJSON => {
  geoJson ??= new GeoJSON()
  return geoJson
}

const zoneToFeature = (zone: ExclusionZoneData): Feature | null => {
  const properties = { name: zone.name, address: zone.address }
  const { geometry } = zone
  switch (geometry?.type) {
    case 'Polygon':
      return getGeoJson().readFeature(
        { type: 'Feature', properties, geometry },
        { dataProjection: DATA_PROJECTION, featureProjection: MAP_PROJECTION },
      ) as Feature

    case 'Point': {
      const [lon, lat] = geometry.coordinates ?? []
      const radius = Number(geometry.radiusMetres)
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(radius) || !(radius > 0)) return null

      const polygon = circular([lon, lat], radius, CIRCLE_SIDES).transform(DATA_PROJECTION, MAP_PROJECTION)
      return new Feature({ geometry: polygon, ...properties })
    }

    default:
      return null
  }
}

export const buildExclusionZoneFeatures = (zones: unknown): Feature[] =>
  (Array.isArray(zones) ? zones : [])
    .map(zone => zoneToFeature(zone as ExclusionZoneData))
    .filter((feature): feature is Feature => feature !== null)

export default zoneToFeature
