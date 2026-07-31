export type MapBaseLayer = 'street' | 'satellite'

export interface LocationMapControls {
  baseLayer: MapBaseLayer
  tracks: boolean
  confidence: boolean
  numbers: boolean
  exclusion: boolean
}

export const defaultLocationMapControls: LocationMapControls = {
  baseLayer: 'street',
  tracks: true,
  confidence: true,
  numbers: true,
  exclusion: false,
}
