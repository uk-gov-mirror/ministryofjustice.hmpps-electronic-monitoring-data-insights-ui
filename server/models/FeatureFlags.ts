/* eslint-disable lines-between-class-members */
export default class FeatureFlags {
  [index: string]: boolean
  enableHeatmap = false
  enablePingCardNavigation = false
  enableExclusionZones = false
}

export type FeatureFlagName = 'enableHeatmap' | 'enablePingCardNavigation' | 'enableExclusionZones'

export const featureFlagKeys: Record<FeatureFlagName, string> = {
  enableHeatmap: 'enable-heatmap',
  enablePingCardNavigation: 'enable-ping-card-navigation',
  enableExclusionZones: 'enable-exclusion-zones',
}
