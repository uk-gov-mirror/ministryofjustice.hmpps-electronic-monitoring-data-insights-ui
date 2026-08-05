import { FliptClient } from '@flipt-io/flipt-client-js'
import FlagService from './flagService'

jest.mock('@flipt-io/flipt-client-js', () => ({
  FliptClient: {
    init: jest.fn(),
  },
}))

const evaluateBoolean = jest.fn()

describe('FlagService', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(FliptClient.init as jest.Mock).mockResolvedValue({ evaluateBoolean })
  })

  it('returns feature flags based on Flipt boolean evaluation results', async () => {
    evaluateBoolean
      .mockReturnValueOnce({ flagKey: 'enable-heatmap', enabled: true })
      .mockReturnValueOnce({ flagKey: 'enable-ping-card-navigation', enabled: false })
      .mockReturnValueOnce({ flagKey: 'enable-exclusion-zones', enabled: false })

    const flags = await new FlagService().getFlags({ username: 'USER1' })

    expect(FliptClient.init).toHaveBeenCalledWith({
      namespace: 'hmpps-electronic-monitoring-data-insights',
      url: 'http://localhost:8100',
      updateInterval: 120,
    })
    expect(evaluateBoolean).toHaveBeenNthCalledWith(1, {
      flagKey: 'enable-heatmap',
      entityId: 'user1',
      context: {
        username: 'user1',
      },
    })
    expect(evaluateBoolean).toHaveBeenNthCalledWith(2, {
      flagKey: 'enable-ping-card-navigation',
      entityId: 'user1',
      context: {
        username: 'user1',
      },
    })
    expect(flags.enableHeatmap).toEqual(true)
    expect(flags.enablePingCardNavigation).toEqual(false)
    expect(flags.enableExclusionZones).toEqual(false)
  })

  it('defaults a flag to false when Flipt does not return the requested flag key', async () => {
    evaluateBoolean
      .mockReturnValueOnce({ flagKey: 'enable-heatmap', enabled: true })
      .mockReturnValueOnce({ flagKey: 'unexpected-flag', enabled: true })
      .mockReturnValueOnce({ flagKey: 'enable-exclusion-zones', enabled: true })

    const flags = await new FlagService().getFlags({})

    expect(evaluateBoolean).toHaveBeenCalledWith({
      flagKey: 'enable-heatmap',
      entityId: 'anonymous',
      context: {},
    })
    expect(evaluateBoolean).toHaveBeenCalledWith({
      flagKey: 'enable-ping-card-navigation',
      entityId: 'anonymous',
      context: {},
    })
    expect(evaluateBoolean).toHaveBeenCalledWith({
      flagKey: 'enable-exclusion-zones',
      entityId: 'anonymous',
      context: {},
    })
    expect(flags.enableHeatmap).toEqual(true)
    expect(flags.enablePingCardNavigation).toEqual(false)
    expect(flags.enableExclusionZones).toEqual(true)
  })
})
