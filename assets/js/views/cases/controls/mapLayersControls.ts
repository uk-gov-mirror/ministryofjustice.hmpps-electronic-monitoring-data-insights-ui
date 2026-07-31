import Control from 'ol/control/Control'
import TileLayer from 'ol/layer/Tile'
import TileSource from 'ol/source/Tile'
import type BaseLayer from 'ol/layer/Base'
import { ComposableLayer } from '@ministryofjustice/hmpps-electronic-monitoring-components/map/layers'
import { EmMap } from '@ministryofjustice/hmpps-electronic-monitoring-components/map'

export interface MapControlState {
  baseLayer: 'street' | 'satellite'
  tracks: boolean
  confidence: boolean
  numbers: boolean
  exclusion: boolean
}

interface MapLayersControlOptions {
  streetLayer?: TileLayer<TileSource>
  satelliteLayer?: TileLayer<TileSource>
  tracksLayer: ComposableLayer
  confidenceLayer?: ComposableLayer
  numbersLayer?: ComposableLayer
  exclusionLayer?: ComposableLayer
  mapContainer: HTMLElement
  map: EmMap
  initialState?: MapControlState
  onChange?: (state: MapControlState) => void
}

const defaultMapControlState: MapControlState = {
  baseLayer: 'street',
  tracks: true,
  confidence: true,
  numbers: true,
  exclusion: false,
}

export default class MapLayersControl extends Control {
  private panel: HTMLElement

  private openBtn: HTMLElement

  constructor(opts: MapLayersControlOptions) {
    const el = document.createElement('div')
    super({ element: el })

    const { mapContainer } = opts
    mapContainer.style.position = 'relative'

    const { panel, openBtn } = MapLayersControl.createPanel(opts)
    this.panel = panel
    this.openBtn = openBtn

    mapContainer.appendChild(this.panel)
    mapContainer.appendChild(this.openBtn)
  }

  private static createPanel(opts: MapLayersControlOptions): { panel: HTMLElement; openBtn: HTMLElement } {
    const state: MapControlState = { ...defaultMapControlState, ...opts.initialState }

    const openBtn = document.createElement('button')
    openBtn.setAttribute('aria-label', 'Open layers panel')
    openBtn.className = 'govuk-button mlc-open-btn govuk-button--inverse'
    openBtn.innerHTML = 'Open map controls &#9656;'
    openBtn.setAttribute('data-hidden', 'true')

    const panel = document.createElement('div')
    panel.className = 'mlc-panel'

    const toggle = (hide: HTMLElement, show: HTMLElement) => {
      hide.setAttribute('data-hidden', 'true')
      show.removeAttribute('data-hidden')
    }

    panel.innerHTML = `
      <div class="govuk-form-group govuk-!-margin-bottom-0">
        <div class="mlc-header govuk-!-margin-bottom-1">
          <button 
            type="button" 
            class="mlc-panel__close govuk-button govuk-button--secondary" 
            aria-label="Close map controls"
          >
            Close map controls
            <span aria-hidden="true">&#9662;</span>
          </button>
        </div>
        
        <fieldset class="govuk-fieldset">
            <span class="govuk-fieldset__heading govuk-!-font-weight-bold">Map View</span>
            <div class="govuk-radios govuk-radios--small" data-module="govuk-radios">
                <div class="govuk-radios__item">
                  <input class="govuk-radios__input" id="mlc-base-street" name="mlc-base" type="radio" value="street" ${state.baseLayer === 'street' ? 'checked' : ''}>
                  <label class="govuk-label govuk-radios__label" for="mlc-base-street">Street</label>
                </div>
            </div>
        </fieldset>
     </div>

      <hr class="govuk-section-break govuk-section-break--visible mlc-panel__divider">
      <div class="govuk-form-group govuk-!-margin-bottom-0">
        <fieldset class="govuk-fieldset">
            <span class="govuk-fieldset__heading govuk-!-font-weight-bold">Map Controls</span>
          <div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">
            <div class="govuk-checkboxes__item">
              <input class="govuk-checkboxes__input" id="mlc-tracks" type="checkbox" ${state.tracks ? 'checked' : ''}>
              <label class="govuk-label govuk-checkboxes__label" for="mlc-tracks">Direction of travel</label>
            </div>
            <div class="govuk-checkboxes__item">
              <input class="govuk-checkboxes__input" id="mlc-confidence" type="checkbox" ${state.confidence ? 'checked' : ''}>
              <label class="govuk-label govuk-checkboxes__label" for="mlc-confidence">View location accuracy</label>
            </div>
            <div class="govuk-checkboxes__item">
              <input class="govuk-checkboxes__input" id="mlc-numbers" type="checkbox" ${state.numbers ? 'checked' : ''}>
              <label class="govuk-label govuk-checkboxes__label" for="mlc-numbers">Point numbers</label>
            </div>
          </div>
        </fieldset>
      </div>

      <hr class="govuk-section-break govuk-section-break--visible mlc-panel__divider">
      <div class="govuk-form-group govuk-!-margin-bottom-0">
        <fieldset class="govuk-fieldset">
            <span class="govuk-fieldset__heading govuk-!-font-weight-bold">Zones</span>
          <div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">
            <div class="govuk-checkboxes__item">
              <input class="govuk-checkboxes__input" id="mlc-exclusion" type="checkbox" ${state.exclusion ? 'checked' : ''}>
              <label class="govuk-label govuk-checkboxes__label" for="mlc-exclusion">Exclusion</label>
            </div>
          </div>
        </fieldset>
      </div>
      `

    const notifyChange = () => opts.onChange?.({ ...state })

    opts.streetLayer?.setVisible(state.baseLayer === 'street')
    opts.satelliteLayer?.setVisible(state.baseLayer === 'satellite')

    panel.querySelectorAll('[name="mlc-base"]').forEach(radio =>
      radio.addEventListener('change', e => {
        const val = (e.target as HTMLInputElement).value
        state.baseLayer = val === 'satellite' ? 'satellite' : 'street'
        opts.streetLayer?.setVisible(val === 'street')
        opts.satelliteLayer?.setVisible(val === 'satellite')
        notifyChange()
      }),
    )

    const bindCheckbox = (
      id: string,
      stateKey: 'tracks' | 'confidence' | 'numbers' | 'exclusion',
      layer?: ComposableLayer,
    ) => {
      const input = panel.querySelector(id) as HTMLInputElement | null
      if (!input || !layer) return
      const nativeLayer = opts.map.getNativeLayer(layer.id)
      ;(nativeLayer as BaseLayer | undefined)?.setVisible(state[stateKey])
      input.addEventListener('change', () => {
        state[stateKey] = input.checked
        ;(nativeLayer as BaseLayer | undefined)?.setVisible(input.checked)
        notifyChange()
      })
    }

    bindCheckbox('#mlc-tracks', 'tracks', opts.tracksLayer)
    bindCheckbox('#mlc-confidence', 'confidence', opts.confidenceLayer)
    bindCheckbox('#mlc-numbers', 'numbers', opts.numbersLayer)
    bindCheckbox('#mlc-exclusion', 'exclusion', opts.exclusionLayer)

    panel.querySelector('.mlc-panel__close')?.addEventListener('click', () => {
      toggle(panel, openBtn)
      openBtn.focus()
    })

    openBtn.addEventListener('click', () => {
      toggle(openBtn, panel)
      const firstFocusable = panel.querySelector<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      firstFocusable?.focus()
    })

    return { panel, openBtn }
  }

  override disposeInternal() {
    this.panel.remove()
    this.openBtn.remove()
    super.disposeInternal()
  }
}
