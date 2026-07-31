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
import { Interaction } from 'ol/interaction'
import initialiseLocationDataView from './index'
import * as utils from '../../utils/utils'
import MapLayersControl from './controls/mapLayersControls'

interface MockOlMapInstance {
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
jest.mock('ol/layer/Heatmap', () => jest.fn().mockImplementation(() => ({})))
jest.mock('ol/geom', () => ({
  LineString: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('ol/proj', () => ({
  fromLonLat: jest.fn((coord: number[]) => coord),
}))
jest.mock('ol/style', () => ({
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

  it('should add TracksLayer with visible set to true', () => {
    initialiseLocationDataView()
    expect(TracksLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
  })

  it('should initialise custom layers and map controls from the persisted map control state', () => {
    mockMapContainer.dataset.mapControlBaseLayer = 'satellite'
    mockMapContainer.dataset.mapControlTracks = 'false'
    mockMapContainer.dataset.mapControlConfidence = 'true'
    mockMapContainer.dataset.mapControlNumbers = 'false'

    initialiseLocationDataView()

    expect(TracksLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
    expect(CirclesLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: true }))
    expect(TextLayer).toHaveBeenCalledWith(expect.objectContaining({ visible: false }))
    expect(MapLayersControl).toHaveBeenCalledWith(
      expect.objectContaining({
        initialState: {
          baseLayer: 'satellite',
          tracks: false,
          confidence: true,
          numbers: false,
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
    `

    initialiseLocationDataView()

    const mapLayersControlOptions = (MapLayersControl as unknown as jest.Mock).mock.calls[0][0]
    mapLayersControlOptions.onChange({
      baseLayer: 'satellite',
      tracks: false,
      confidence: true,
      numbers: false,
    })

    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="baseLayer"]')?.value).toBe('satellite')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="tracks"]')?.value).toBe('false')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="confidence"]')?.value).toBe('true')
    expect(document.querySelector<HTMLInputElement>('[data-map-control-input="numbers"]')?.value).toBe('false')
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
    expect(mockMap.addControl).toHaveBeenCalledTimes(1)
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

    it('should preserve any existing stylesheets on the shadow root', () => {
      const existingSheet = new CSSStyleSheet()
      ;(mockEmMap.shadowRoot as MockShadowRoot).adoptedStyleSheets = [existingSheet]
      initialiseLocationDataView()
      const { adoptedStyleSheets } = mockEmMap.shadowRoot as MockShadowRoot
      expect(adoptedStyleSheets).toHaveLength(2)
      expect(adoptedStyleSheets[0]).toBe(existingSheet)
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
})
