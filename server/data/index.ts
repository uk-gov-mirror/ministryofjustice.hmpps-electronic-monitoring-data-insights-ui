/* eslint-disable import/first */
/*
 * Do appinsights first as it does some magic instrumentation work, i.e. it affects other 'require's
 * In particular, applicationinsights automatically collects bunyan logs
 */
import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import { initialiseAppInsights, buildAppInsightsClient } from '../utils/azureAppInsights'
import applicationInfoSupplier from '../applicationInfo'

const applicationInfo = applicationInfoSupplier()
initialiseAppInsights()
buildAppInsightsClient(applicationInfo.applicationName)

import { createRedisClient } from './redisClient'
import RedisTokenStore from './tokenStore/redisTokenStore'
import InMemoryTokenStore from './tokenStore/inMemoryTokenStore'
import config from '../config'
import HmppsAuditClient from './hmppsAuditClient'
import logger from '../../logger'
import EmdiApiClient from './emdiApiClient'
import LocationsApiClient from './locationsApiClient'
import PeopleApiClient from './peopleApiClient'
import PeopleExclusionApiClient from './peopleExclusionApiClient'

export const dataAccess = () => {
  const hmppsAuthClient = new AuthenticationClient(
    config.apis.hmppsAuth,
    logger,
    config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore(),
  )

  return {
    applicationInfo,
    hmppsAuthClient,
    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
    emdiApiClient: new EmdiApiClient(hmppsAuthClient),
    locationsApiClient: new LocationsApiClient(hmppsAuthClient),
    peopleApiClient: new PeopleApiClient(hmppsAuthClient),
    peopleExclusionApiClient: new PeopleExclusionApiClient(hmppsAuthClient),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { HmppsAuditClient }
