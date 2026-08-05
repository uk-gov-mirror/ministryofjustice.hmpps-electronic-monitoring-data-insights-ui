import { SuperAgentRequest } from 'superagent'
import { stubFor } from './wiremock'

const flag = (key: string, enabled: boolean) => ({
  key,
  name: key,
  description: '',
  enabled,
  type: 'BOOLEAN_FLAG_TYPE',
  createdAt: '2026-06-24T00:00:00.000000Z',
  updatedAt: '2026-06-24T00:00:00.000000Z',
  rules: [] as unknown[],
  rollouts: [] as unknown[],
})

export default {
  stubFeatureFlags: ({
    enableHeatmap = true,
    enablePingCardNavigation = true,
    enableExclusionZones = true,
  }: {
    enableHeatmap?: boolean
    enablePingCardNavigation?: boolean
    enableExclusionZones?: boolean
  } = {}): SuperAgentRequest =>
    stubFor({
      request: {
        urlPathPattern: '/flipt/internal/v1/evaluation/snapshot/namespace/hmpps-electronic-monitoring-data-insights',
        method: 'GET',
      },
      response: {
        status: 200,
        jsonBody: {
          namespace: {
            key: 'hmpps-electronic-monitoring-data-insights',
          },
          flags: [
            flag('enable-heatmap', enableHeatmap),
            flag('enable-ping-card-navigation', enablePingCardNavigation),
            flag('enable-exclusion-zones', enableExclusionZones),
          ],
        },
      },
    }),
}
