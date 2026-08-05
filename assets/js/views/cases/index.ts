import { EmMap, Position } from '@ministryofjustice/hmpps-electronic-monitoring-components/map'
import {
  LocationsLayer,
  TracksLayer,
  CirclesLayer,
  TextLayer,
} from '@ministryofjustice/hmpps-electronic-monitoring-components/map/layers'
import { isEmpty } from 'ol/extent'
import VectorLayer from 'ol/layer/Vector'
import { Interaction } from 'ol/interaction'
import HeatmapLayer from 'ol/layer/Heatmap'
import VectorSource from 'ol/source/Vector'
import { Feature } from 'ol'
import { Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import { Coordinate } from 'ol/coordinate'
import GeoJSON from 'ol/format/GeoJSON'
import { Fill, Stroke, Style } from 'ol/style'
import { queryElement } from '../../utils/utils'
import getRotatedDirection from './controls/getRotatedDirection'
import MapLayersControl, { MapControlState } from './controls/mapLayersControls'
import { getNavVisibilityState, resolveNavTargetIndex } from '../../utils/pingCard'

interface ShadowRootHost extends HTMLElement {
  shadowRoot: ShadowRoot | null
}

export interface TrackPosition extends Position {
  gpsDate?: string
  displayPointNumber?: number
}

export type OverlayInteraction = Interaction & {
  overlay?: {
    showAtCoordinate?: (coords: number[], properties?: Record<string, unknown>) => void
  }
}

const TIME_GAP_THRESHOLD_MINS = 50
const getShadowRoot = (emMap: EmMap): ShadowRoot | null => (emMap as ShadowRootHost).shadowRoot

const defaultMapControlState: MapControlState = {
  baseLayer: 'street',
  tracks: true,
  confidence: true,
  numbers: true,
  exclusion: false,
}

const parseBooleanDataValue = (value: string | undefined): boolean | undefined => {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const getInitialMapControlState = (mapContainer: HTMLElement): MapControlState => ({
  baseLayer: mapContainer.dataset.mapControlBaseLayer === 'satellite' ? 'satellite' : 'street',
  tracks: parseBooleanDataValue(mapContainer.dataset.mapControlTracks) ?? defaultMapControlState.tracks,
  confidence: parseBooleanDataValue(mapContainer.dataset.mapControlConfidence) ?? defaultMapControlState.confidence,
  numbers: parseBooleanDataValue(mapContainer.dataset.mapControlNumbers) ?? defaultMapControlState.numbers,
  exclusion: parseBooleanDataValue(mapContainer.dataset.mapControlExclusion) ?? defaultMapControlState.exclusion,
})

const syncMapControlInputs = (state: MapControlState) => {
  ;(Object.keys(state) as Array<keyof MapControlState>).forEach(key => {
    const input = document.querySelector<HTMLInputElement>(`[data-map-control-input="${key}"]`)
    if (input) {
      input.value = String(state[key])
    }
  })
}

const initialiseDirectionScreenReader = () => {
  const emMap = queryElement(document, 'em-map') as EmMap
  const panAnnounce = queryElement(document, '#map-pan-announce') as HTMLElement

  const viewport = emMap.olMapInstance?.getViewport()

  viewport?.addEventListener('keydown', (e: KeyboardEvent) => {
    const rotation = emMap.olMapInstance?.getView().getRotation() ?? 0
    const label = getRotatedDirection(e.key, rotation)
    if (label && panAnnounce) {
      panAnnounce.textContent = label
    }
  })

  viewport?.addEventListener('mouseup', () => {
    const rotation = emMap.olMapInstance?.getView().getRotation() ?? 0
    const label = getRotatedDirection('ArrowUp', rotation)
    if (label && panAnnounce) {
      panAnnounce.textContent = label
    }
  })
}

const injectShadowFocusStyles = (emMap: EmMap) => {
  const shadowRoot = getShadowRoot(emMap)
  if (!shadowRoot) return

  const sheet = new CSSStyleSheet()
  sheet.replaceSync(`
     :host .ol-control button:focus,
     :host .ol-zoom-in:focus,
     :host .ol-zoom-out:focus {
       color: #0b0c0c !important;
       outline: 3px solid #ffdd00 !important;
       outline-offset: 0 !important;
       box-shadow: inset 0 0 0 2px !important;
       text-decoration: none;
     }

     :host .ol-control button:focus:not(:focus-visible),
     :host .ol-zoom-in:focus:not(:focus-visible),
     :host .ol-zoom-out:focus:not(:focus-visible) {
       background-color: revert;
       box-shadow: none;
       color: revert;
     }
   `)
  shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet]
}

const initialiseLocationDataView = () => {
  const mapContainer = queryElement(document, '[data-qa="em-map"]') as HTMLElement
  const emMap = queryElement(mapContainer, 'em-map') as unknown as EmMap

  const setupMap = () => {
    const map = emMap.olMapInstance
    if (!map) {
      setTimeout(setupMap, 200)
      return
    }

    const updateMapButton = queryElement(document, '#update-map-button') as HTMLButtonElement
    map.on('loadend', () => {
      updateMapButton.disabled = false
    })

    injectShadowFocusStyles(emMap as EmMap)
    const { positions } = emMap
    const mapControlState = getInitialMapControlState(mapContainer)
    syncMapControlInputs(mapControlState)

    const locationsLayer = emMap.addLayer(
      new LocationsLayer({
        title: 'pointsLayer',
        positions,
        zIndex: 4,
        style: {
          fill: 'rgba(76, 128, 182, 1)',
          stroke: {
            color: 'rgba(76, 128, 182, 1)',
          },
        },
      }),
    )!

    const getTimestamp = (position: Position): number | null => {
      const ts = (position as TrackPosition).gpsDate
      if (!ts) return null
      return new Date(ts).getTime()
    }

    const shouldDash = (from: Position, to: Position): boolean => {
      const t1 = getTimestamp(from)
      const t2 = getTimestamp(to)
      if (t1 === null || t2 === null) return false
      const diffMinutes = (t2 - t1) / 60000
      return diffMinutes > TIME_GAP_THRESHOLD_MINS
    }

    const tracksLayer = new TracksLayer({
      id: 'tracksLayer',
      positions,
      visible: mapControlState.tracks,
      zIndex: 1,
      style: { stroke: { color: 'rgba(76, 128, 182, 1)' } },
      segmentStyle: ({ positions: [from, to] }) => ({
        stroke: {
          lineDash: shouldDash(from, to) ? [8, 6] : undefined,
        },
      }),
    })

    const confidenceLayer = new CirclesLayer({
      positions,
      id: 'confidenceLayer',
      title: 'confidenceLayer',
      visible: mapControlState.confidence,
      zIndex: 3,
      style: {
        fill: 'rgba(0, 0, 0, 0)',
        stroke: {
          color: 'rgba(76, 128, 182, 1)',
          width: 2,
        },
      },
    })
    const numbersLayer = new TextLayer({
      positions,
      textProperty: 'displayPointNumber',
      id: 'numbersLayer',
      title: 'numbersLayer',
      visible: mapControlState.numbers,
      zIndex: 3,
      style: {
        offset: { x: 0, y: 30 },
        textAlign: 'center',
      },
    })

    if (mapContainer.dataset.enableHeatmap === 'true') {
      const heatmapSource = new VectorSource({
        features: positions.map(
          position =>
            new Feature({
              geometry: new Point(
                fromLonLat([(position as TrackPosition).longitude, (position as TrackPosition).latitude]),
              ),
            }),
        ),
      })

      const heatmapLayer = new HeatmapLayer({
        source: heatmapSource,
        blur: 15,
        radius: 10,
        zIndex: 2,
      })
      emMap.addLayer(heatmapLayer)
    }

    let exclusionLayer: VectorLayer | undefined
    const exclusionZonesData = mapContainer.dataset.exclusionZones
    if (exclusionZonesData && mapContainer.dataset.enableExclusionZones === 'true') {
      try {
        const exclusionZones = JSON.parse(exclusionZonesData)
        const polygonZones = (Array.isArray(exclusionZones) ? exclusionZones : []).filter(
          zone => zone?.geometry?.type === 'Polygon',
        )

        if (polygonZones.length > 0) {
          const features = new GeoJSON().readFeatures(
            {
              type: 'FeatureCollection',
              features: polygonZones.map(zone => ({
                type: 'Feature',
                properties: { name: zone.name, address: zone.address },
                geometry: zone.geometry,
              })),
            },
            { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' },
          )

          exclusionLayer = new VectorLayer({
            source: new VectorSource({ features }),
            style: new Style({
              fill: new Fill({ color: 'rgba(255, 0, 0, 0.3)' }),
              stroke: new Stroke({ color: 'rgba(255, 0, 0, 1)', width: 2 }),
            }),
            zIndex: 5,
            visible: mapControlState.exclusion,
          })

          map.addLayer(exclusionLayer) // native ol.Map, not emMap.addLayer
        }
      } catch (error) {
        /* eslint no-console: ["error", { allow: ["warn", "error"] }] */
        console.error('Error parsing exclusion zone data:', error)
      }
    }

    emMap.addLayer(locationsLayer)
    emMap.addLayer(tracksLayer)
    emMap.addLayer(confidenceLayer)
    emMap.addLayer(numbersLayer)

    emMap.fitToAllLayers({ padding: 80 })

    const mapLayersControl = new MapLayersControl({
      mapContainer,
      map: emMap,
      tracksLayer,
      confidenceLayer,
      numbersLayer,
      exclusionLayer,
      enableExclusionZones: mapContainer.dataset.enableExclusionZones === 'true',
      initialState: mapControlState,
      onChange: syncMapControlInputs,
    })
    map.addControl(mapLayersControl)

    const updateNavVisibility = (index: number) => {
      const shadowRootNav = getShadowRoot(emMap as EmMap)
      if (!shadowRootNav) return
      const firstBtn = shadowRootNav.querySelector('[data-nav="first"]') as HTMLButtonElement | null
      const prevBtn = shadowRootNav.querySelector('[data-nav="prev"]') as HTMLButtonElement | null
      const nextBtn = shadowRootNav.querySelector('[data-nav="next"]') as HTMLButtonElement | null
      const lastBtn = shadowRootNav.querySelector('[data-nav="last"]') as HTMLButtonElement | null

      const state = getNavVisibilityState(index, positions.length)
      if (firstBtn) firstBtn.style.visibility = state.first
      if (prevBtn) prevBtn.style.visibility = state.prev
      if (nextBtn) nextBtn.style.visibility = state.next
      if (lastBtn) lastBtn.style.visibility = state.last
    }

    let currentPointIndex: number | null = null

    const offsetMapCenterForOverlay = (targetMap: NonNullable<EmMap['olMapInstance']>, coords: Coordinate) => {
      const view = targetMap.getView()
      const resolution = view.getResolution() ?? 1
      const overlayHeightPx = 300
      const offsetMetres = (overlayHeightPx / 2) * resolution
      const offsetCenter: [number, number] = [coords[0], coords[1] - offsetMetres]
      view.animate({ center: offsetCenter, duration: 300 })
    }

    const openOverlayForIndex = (index: number) => {
      const position = positions[index] as TrackPosition
      currentPointIndex = index

      const nativeLayers = locationsLayer.getNativeLayer()
      const vectorLayer = Array.isArray(nativeLayers) ? (nativeLayers[0] as VectorLayer) : null
      const source = vectorLayer?.getSource?.()
      if (!source) return

      const feature = source
        .getFeatures()
        .find(f => f.getProperties().displayPointNumber === position.displayPointNumber)
      if (!feature) return

      const geometry = feature.getGeometry()
      if (!(geometry instanceof Point)) return
      const coords = geometry.getCoordinates()

      offsetMapCenterForOverlay(map, coords)

      const interactions = map.getInteractions().getArray()
      const clickInteraction = interactions.find((i: OverlayInteraction) => i.overlay?.showAtCoordinate)
      if (clickInteraction) {
        ;(clickInteraction as OverlayInteraction).overlay.showAtCoordinate(coords, feature.getProperties())
      }
    }

    const shadowRootMap = getShadowRoot(emMap as EmMap)

    shadowRootMap?.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement
      const navLink = target.closest('[data-nav]') as HTMLElement | null
      if (!navLink) return
      e.preventDefault()

      const direction = navLink.dataset.nav
      const targetIndex = resolveNavTargetIndex(direction, currentPointIndex, positions.length)
      if (targetIndex !== null) openOverlayForIndex(targetIndex)
    })

    const interactions = map.getInteractions().getArray()
    const clickInteraction = interactions.find(
      (i): i is OverlayInteraction => !!(i as OverlayInteraction).overlay?.showAtCoordinate,
    )

    if (clickInteraction) {
      const originalShowAtCoordinate = clickInteraction.overlay!.showAtCoordinate!.bind(clickInteraction.overlay)
      clickInteraction.overlay!.showAtCoordinate = (coords, properties) => {
        const pointNumber = properties?.displayPointNumber
        const index = positions.findIndex(p => (p as TrackPosition).displayPointNumber === pointNumber)
        if (index !== -1) currentPointIndex = index
        originalShowAtCoordinate(coords, properties)
        if (index !== -1) updateNavVisibility(index)
      }
    }

    emMap.dispatchEvent(
      new CustomEvent('app:map:layers:ready', {
        bubbles: true,
        composed: true,
        detail: { message: 'All custom layers added' },
      }),
    )
    const nativeLayer = locationsLayer.getNativeLayer()
    if (nativeLayer && Array.isArray(nativeLayer)) {
      const layer = nativeLayer[0] as VectorLayer
      const locationSource = layer?.getSource?.()
      if (locationSource) {
        const extent = locationSource.getExtent()
        if (!isEmpty(extent)) {
          map.getView().fit(extent, {
            maxZoom: 20,
            padding: [30, 30, 30, 30],
            size: map.getSize(),
          })
        }
      }
    }

    if (document.querySelector('#map-pan-announce')) {
      initialiseDirectionScreenReader()
    }
  }

  setupMap()
}

export default initialiseLocationDataView
