import { RequestHandler } from 'express'
import logger from '../../logger'
import FeatureFlags from '../models/FeatureFlags'
import FlagService from '../services/flagService'

export default function evaluateFeatureFlags(flagService: FlagService): RequestHandler {
  return async (req, res, next) => {
    try {
      const flags = await flagService.getFlags({ username: res.locals.user?.username })
      res.locals.flags = flags
      res.locals.enableHeatmap = flags.enableHeatmap
      res.locals.enablePingCardNavigation = flags.enablePingCardNavigation
      res.locals.enableExclusionZones = flags.enableExclusionZones
      next()
    } catch (error) {
      logger.error(error, 'Failed to retrieve flipt feature flags')
      const flags = new FeatureFlags()
      res.locals.flags = flags
      res.locals.enableHeatmap = flags.enableHeatmap
      res.locals.enablePingCardNavigation = flags.enablePingCardNavigation
      res.locals.enableExclusionZones = flags.enableExclusionZones
      next()
    }
  }
}
