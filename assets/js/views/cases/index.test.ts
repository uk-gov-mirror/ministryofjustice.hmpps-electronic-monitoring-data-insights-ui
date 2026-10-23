/**
 * @jest-environment jsdom
 */

import {
  LocationsLayer,
  TracksLayer,
  CirclesLayer,
  TextLayer,
} from '@ministryofjustice/hmpps-electronic-monitoring-components/map/layers'
import { EmMap } from '@ministryofjustice/hmpps-electronic-monitoring-components/map'
import Feature from 'ol/Feature'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import { Interaction } from 'ol/interaction'
import BandedHeatmap from './controls/bandedHeatmap'
import initialiseLocationDataView, { bindPointKeyboardNavigation } from './index'
import * as utils from '../../utils/utils'
import * as exclusionZoneFeatures from '../../utils/exclusionZoneFeatures'
import MapLayersControl from './controls/mapLayersControls'
import { buildExclusionZoneFeatures } from '../../utils/exclusionZoneFeatures'
import MapFullscreenControl from './controls/mapFullscreenControl'

interface MockOlMapInstance {
  addLayer: jest.Mock
  addControl: jest.Mock
  on: jest.Mock
  getView: jest.Mock
  getSize: jest.Mock
  getViewport: jest.Mock
  getInteractions: jest.Mock
}

interface MockEmMapElement {
  olMapInstance: MockOlMapInstance | null
  positions: unknown[]
  addLayer: jest.Mock
  dispatchEvent: jest.Mock
  fitToAllLayers: jest.Mock
  getNativeLayer: jest.Mock
}

interface MockShadowRoot {
  adoptedStyleSheets: CSSStyleSheet[]
  querySelector: jest.Mock
}

interface MockEmMapWithShadow extends MockEmMapElement {
  shadowRoot: MockShadowRoot | null
  addEventListener?: jest.Mock
  removeEventListener?: jest.Mock
}

jest.mock('./controls/mapLayersControls', () => jest.fn().mockImplementation(() => ({})))
jest.mock('../../utils/exclusionZoneFeatures')
jest.mock('@ministryofjustice/hmpps-electronic-monitoring-components/map', () => ({}))
jest.mock('@ministryofjustice/hmpps-electronic-monitoring-components/map/layers', () => ({
  LocationsLayer: jest.fn().mockImplementation(() => ({
    getNativeLayer: jest.fn(() => [
      {
        getSource: jest.fn(() => ({
          getExtent: jest.fn(() => [0, 0, 100, 100]),
        })),
      },
    ]),
  })),
  TracksLayer: jest.fn().mockImplementation(() => ({})),
  CirclesLayer: jest.fn().mockImplementation(() => ({})),
  TextLayer: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('ol/extent', () => ({ isEmpty: jest.fn(() => true) }))
jest.mock('ol/layer/Vector', () => jest.fn().mockImplementation(() => ({})))
jest.mock('ol/source/Vector', () => jest.fn().mockImplementation(() => ({})))
jest.mock('ol/Feature', () => jest.fn().mockImplementation(() => ({})))
jest.mock('./controls/bandedHeatmap', () =>
  jest.fn().mockImplementation(() => ({
    setVisible: jest.fn(),
    setLevels: jest.fn(),
  })),
)
jest.mock('ol/geom', () => ({
  LineString: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('ol/proj', () => ({
  ...jest.requireActual('ol/proj'),
  fromLonLat: jest.fn((coord: number[]) => coord),
}))
jest.mock('ol/style', () => ({
  Fill: jest.fn().mockImplementation(() => ({})),
  Style: jest.fn().mockImplementation(() => ({})),
  Stroke: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('./controls/layerVisibilityToggle', () => jest.fn())
jest.mock('./controls/getRotatedDirection', () => jest.fn())
jest.mock('../../utils/utils')

describe('initialiseLocationDataView', () => {
  let mockEmMap: MockEmMapWithShadow
  let mockMap: MockOlMapInstance
  let mockMapContainer: HTMLElement
  let mockUpdateButton: HTMLButtonElement

  beforeEach(() => {
    mockMap = {
      addLayer: jest.fn(),
      addControl: jest.fn(),
      on: jest.fn(),
      getView: jest.fn(() => ({
        fit: jest.fn(),
        getRotation: jest.fn(() => 0),
      })),
      getSize: jest.fn(() => [800, 600]),
      getViewport: jest.fn(() => ({
        addEventListener: jest.fn(),
      })),
      getInteractions: jest.fn(() => ({
        getArray: jest.fn((): Interaction[] => [
          {
            overlay: {
              showAtCoordinate: jest.fn(),
            },
          } as unknown as Interaction,
        ]),
      })),
    }

    mockEmMap = {
      olMapInstance: mockMap,
      positions: [],
      addLayer: jest.fn((layer: unknown) => layer),
      dispatchEvent: jest.fn(),
      fitToAllLayers: jest.fn(),
      getNativeLayer: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      shadowRoot: {
        adoptedStyleSheets: [],
        querySelector: jest.fn(),
        addEventListener: jest.fn(),
      } as unknown as MockShadowRoot,
    }
    mockMapContainer = document.createElement('div')

    mockUpdateButton = document.createElement('button')
    mockUpdateButton.id = 'update-map-button'
    mockUpdateButton.hidden = false
    ;(utils.queryElement as jest.Mock).mockImplementation((_root: unknown, selector: string) => {
      if (selector === '[data-qa="em-map"]') return mockMapContainer
      if (selector === 'em-map') return mockEmMap as unknown as EmMap
      if (selector === '#update-map-button') return mockUpdateButton
      return mockEmMap as unknown as EmMap
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  const mockReplaceSync = jest.fn()
  beforeAll(() => {
    global.CSSStyleSheet = jest.fn().mockImplementation(() => ({
      replaceSync: mockReplaceSync,
    })) as unknown as typeof CSSStyleSheet
  })

  it('should add a LocationsLayer to the map', () => {
    initialiseLocationDataView()
    expect(LocationsLayer).toHaveBeenCalled()
  })

  it('adds the fullscreen button through the map control API', () => {
    initialiseLocationDataView()

    expect(mockMap.addControl).toHaveBeenCalledWith(expect.any(MapFullscreenControl))
  })

  it('adds converted exclusion features to the map layer when enabled', () => {
    const zones = [{ name: 'Circle', geometry: { type: 'Point', coordinates: [-0.1, 51.5], radiusMetres: 100 } }]
    const features = [new Feature()]
    jest.mocked(buildExclusionZoneFeatures).mockReturnValueOnce(features)
    mockMapContainer.dataset.enableExclusionZones = 'true'
    mockMapContainer.dataset.exclusionZones = JSON.stringify(zones)

    initialiseLocationDataView()

    expect(buildExclusionZoneFeatures).toHaveBeenCalledWith(zones)
    expect(VectorSource).toHaveBeenLastCalledWith({ features })
    const source = jest.mocked(VectorSource).mock.results.at(-1)?.value
    expect(VectorLayer).toHaveBeenCalledWith(expect.objectContaining({ source }))
    const layer = jest.mocked(VectorLayer).mock.results.at(-1)?.value
    expect(mockMap.addLayer).toHaveBeenCalledWith(layer)
  })

  it('should add TracksLayer with visible set to true', () => {
    initialiseLocationDataView()
    expect(TracksLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
  })

  it('passes activity selections to the heatmap renderer and controls layer visibility', () => {
    initialiseLocationDataView()
    const options = jest.mocked(MapLayersControl).mock.calls.at(-1)![0]
    const layer = jest.mocked(BandedHeatmap).mock.results.at(-1)!.value
    const levels = { low: true, medium: false, high: true, veryHigh: true }

    options.onHeatmapLevelsChange?.(levels)
    expect(layer.setLevels).toHaveBeenCalledWith(levels)
    options.onChange?.({
      baseLayer: 'street',
      tracks: true,
      confidence: true,
      numbers: true,
      exclusion: false,
      heatmap: true,
      heatmapLevels: levels,
    })
    expect(layer.setVisible).toHaveBeenLastCalledWith(true)
    options.onChange?.({
      baseLayer: 'street',
      tracks: true,
      confidence: true,
      numbers: true,
      exclusion: false,
      heatmap: false,
      heatmapLevels: { low: false, medium: false, high: false, veryHigh: false },
    })
    expect(layer.setVisible).toHaveBeenLastCalledWith(false)
  })

  it('should initialise custom layers and map controls from the persisted map control state', () => {
    mockMapContainer.dataset.mapControlBaseLayer = 'satellite'
    mockMapContainer.dataset.mapControlTracks = 'false'
    mockMapContainer.dataset.mapControlConfidence = 'true'
    mockMapContainer.dataset.mapControlNumbers = 'false'
    mockMapContainer.dataset.mapControlHeatmap = 'false'
    mockMapContainer.dataset.mapControlHeatmapLevelVeryHigh = 'false'
    mockMapContainer.dataset.mapControlHeatmapLevelHigh = 'false'
    mockMapContainer.dataset.mapControlHeatmapLevelMedium = 'false'
    mockMapContainer.dataset.mapControlHeatmapLevelLow = 'false'

    initialiseLocationDataView()

    expect(TracksLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
    expect(CirclesLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
    expect(TextLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
    expect(BandedHeatmap).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
    expect(MapLayersControl).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState: {
          baseLayer: 'satellite',
          tracks: false,
          confidence: true,
          numbers: false,
          heatmap: false,
          heatmapLevels: { low: false, medium: false, high: false, veryHigh: false },
          exclusion: false,
        },
        onChange: expect.any(Function),
      }),
    )
  })

  it('should keep map control hidden inputs in sync', () => {
    document.body.innerHTML = `
      <input data-map-control-input="baseLayer" value="street">
      <input data-map-control-input="tracks" value="true">
      <input data-map-control-input="confidence" value="true">
      <input data-map-control-input="numbers" value="true">
      <input data-map-control-input="heatmap" value="false">
    `

    initialiseLocationDataView()

    const mapLayersControlOptions = (MapLayersControl as unknown as jest.Mock).mock.calls[0][0]
    mapLayersControlOptions.onChange({
      baseLayer: 'satellite',
      tracks: false,
      confidence: true,
      numbers: false,
      heatmap: false,
    })

    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="baseLayer"]')?.value).toBe('satellite')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="tracks"]')?.value).toBe('false')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="confidence"]')?.value).toBe('true')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="numbers"]')?.value).toBe('false')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="heatmap"]')?.value).toBe('false')
  })

  it('should add a CirclesLayer to the map', () => {
    initialiseLocationDataView()
    expect(CirclesLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
  })

  it('should add a TextLayer to the map', () => {
    initialiseLocationDataView()
    expect(TextLayer).toHaveBeenCalled()
  })

  it('should add map layers control to the map', () => {
    initialiseLocationDataView()
    expect(MapLayersControl).toHaveBeenCalled()
    expect(mockMap.addControl).toHaveBeenCalledTimes(2)
  })

  it('should dispatch app:map:layers:ready event', () => {
    initialiseLocationDataView()
    expect(mockEmMap.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'app:map:layers:ready' }))
  })

  it('should retry setupMap if olMapInstance is not ready', () => {
    jest.useFakeTimers()

    mockEmMap.olMapInstance = null

    initialiseLocationDataView()
    expect(mockEmMap.dispatchEvent).not.toHaveBeenCalled()

    mockEmMap.olMapInstance = mockMap
    jest.advanceTimersByTime(200)

    expect(mockEmMap.dispatchEvent).toHaveBeenCalled()
    jest.useRealTimers()
  })

  describe('injectShadowFocusStyles', () => {
    it('should not throw if shadowRoot is null', () => {
      mockEmMap.shadowRoot = null
      expect(() => initialiseLocationDataView()).not.toThrow()
    })

    it('should include MoJ focus styles in the injected stylesheet', () => {
      initialiseLocationDataView()
      expect(mockReplaceSync).toHaveBeenCalledWith(expect.stringContaining(':host .ol-zoom-in:focus'))
      expect(mockReplaceSync).toHaveBeenCalledWith(expect.stringContaining('outline: 3px solid #ffdd00 !important'))
      expect(mockReplaceSync).toHaveBeenCalledWith(expect.stringContaining(':focus:not(:focus-visible)'))
    })

    it('includes the fullscreen button styles in the adopted shadow stylesheet', () => {
      initialiseLocationDataView()

      expect(mockReplaceSync).toHaveBeenCalledWith(
        expect.stringContaining(':host .emdi-map-fullscreen-control .emdi-map-fullscreen-toggle'),
      )
      expect(mockReplaceSync).toHaveBeenCalledWith(expect.stringContaining('.emdi-map-fullscreen-toggle__icon'))
    })

    it('should preserve any existing stylesheets on the shadow root', () => {
      const existingSheet = new CSSStyleSheet()
      ;(mockEmMap.shadowRoot as MockShadowRoot).adoptedStyleSheets = [existingSheet]
      initialiseLocationDataView()
      const { adoptedStyleSheets } = mockEmMap.shadowRoot as MockShadowRoot
      expect(adoptedStyleSheets).toHaveLength(2)
      expect(adoptedStyleSheets[0]).toBe(existingSheet)
    })

    it('should give the zoom controls explicit accessible names', () => {
      const zoomIn = document.createElement('button')
      const zoomOut = document.createElement('button')
      ;(mockEmMap.shadowRoot as MockShadowRoot).querySelector.mockImplementation((selector: string) => {
        if (selector === '.ol-zoom-in') return zoomIn
        if (selector === '.ol-zoom-out') return zoomOut
        return null
      })

      initialiseLocationDataView()

      expect(zoomIn).toHaveAttribute('aria-label', 'Zoom in')
      expect(zoomOut).toHaveAttribute('aria-label', 'Zoom out')
    })
  })

  describe('point keyboard access', () => {
    it('should listen for keyboard activation on the map region', () => {
      const addEventListenerSpy = jest.spyOn(mockMapContainer, 'addEventListener')

      initialiseLocationDataView()

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it.each(['Enter', ' '])('should open the first point when the map region receives %p', key => {
      const mapRegion = document.createElement('div')
      const openPoint = jest.fn()
      bindPointKeyboardNavigation(mapRegion, 2, openPoint)
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

      mapRegion.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(true)
      expect(openPoint).toHaveBeenCalledWith(0, true)
    })

    it('should ignore activation keys when there are no location points', () => {
      const mapRegion = document.createElement('div')
      const openPoint = jest.fn()
      bindPointKeyboardNavigation(mapRegion, 0, openPoint)
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })

      mapRegion.dispatchEvent(event)

      expect(event.defaultPrevented).toBe(false)
      expect(openPoint).not.toHaveBeenCalled()
    })

    it('should not override keyboard interaction with controls inside the map region', () => {
      const mapRegion = document.createElement('div')
      const childButton = document.createElement('button')
      const openPoint = jest.fn()
      mapRegion.appendChild(childButton)
      bindPointKeyboardNavigation(mapRegion, 2, openPoint)

      childButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

      expect(openPoint).not.toHaveBeenCalled()
    })
  })

  describe('Update Map Button', () => {
    it('should register a loadend listener on the map', () => {
      initialiseLocationDataView()
      expect(mockMap.on).toHaveBeenCalledWith('loadend', expect.any(Function))
    })

    it('should enable the update button when the map fires loadend', () => {
      mockUpdateButton.disabled = true

      initialiseLocationDataView()

      const loadendHandler = (mockMap.on as jest.Mock).mock.calls.find(([event]) => event === 'loadend')?.[1]

      expect(loadendHandler).toBeDefined()
      loadendHandler()

      expect(mockUpdateButton.disabled).toBe(false)
    })
  })

  describe('Exclusion Zones and heatmap feature Flags', () => {
    it.each([
      {
        type: 'Polygon',
        coordinates: [
          [
            [-0.1, 51.5],
            [-0.1, 51.51],
            [-0.09, 51.51],
            [-0.1, 51.5],
          ],
        ],
      },
      { type: 'Point', coordinates: [-0.1, 51.5], radiusMetres: 100 },
    ])('should pass converted $type features to the map exclusion layer', geometry => {
      const zones = [{ name: 'Exclusion zone', geometry }]
      const features = [new Feature()]
      const buildFeatures = jest
        .spyOn(exclusionZoneFeatures, 'buildExclusionZoneFeatures')
        .mockReturnValueOnce(features)
      mockMapContainer.dataset.exclusionZones = JSON.stringify(zones)
      mockMapContainer.dataset.enableExclusionZones = 'true'
      mockMapContainer.dataset.mapControlExclusion = 'true'

      try {
        initialiseLocationDataView()

        expect(buildFeatures).toHaveBeenCalledWith(zones)
        expect(VectorSource).toHaveBeenLastCalledWith({ features })
        const source = jest.mocked(VectorSource).mock.results.at(-1)?.value
        expect(VectorLayer).toHaveBeenLastCalledWith(expect.objectContaining({ source, visible: true }))
        const layer = jest.mocked(VectorLayer).mock.results.at(-1)?.value
        expect(mockMap.addLayer).toHaveBeenCalledWith(layer)
        expect(MapLayersControl).toHaveBeenCalledWith(expect.objectContaining({ exclusionLayer: layer }))
      } finally {
        buildFeatures.mockRestore()
      }
    })

    it('should override heatmap and exclusion states to false when feature flags are disabled', () => {
      mockMapContainer.dataset.mapControlHeatmap = 'true'
      mockMapContainer.dataset.mapControlExclusion = 'true'
      mockMapContainer.dataset.enableHeatmap = 'false'
      mockMapContainer.dataset.enableExclusionZones = 'false'

      initialiseLocationDataView()

      expect(MapLayersControl).toHaveBeenCalledWith(
        expect.objectContaining({
          initialState: expect.objectContaining({
            heatmap: false,
            exclusion: false,
          }),
          enableHeatmap: false,
          enableExclusionZones: false,
        }),
      )
    })

    it('should allow heatmap and exclusion states to be true when feature flags are enabled', () => {
      mockMapContainer.dataset.mapControlHeatmap = 'true'
      mockMapContainer.dataset.mapControlExclusion = 'true'
      mockMapContainer.dataset.enableHeatmap = 'true'
      mockMapContainer.dataset.enableExclusionZones = 'true'

      initialiseLocationDataView()

      expect(MapLayersControl).toHaveBeenCalledWith(
        expect.objectContaining({
          initialState: expect.objectContaining({
            heatmap: true,
            exclusion: true,
          }),
          enableHeatmap: true,
          enableExclusionZones: true,
        }),
      )
    })
  })
})
