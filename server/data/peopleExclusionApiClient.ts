import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

export type ApiExclusionZone = {
  name: string
  address: string
  geometry: Geometry
}

export type Geometry = {
  type: string
  crs: CoordinateReferenceSystem
  coordinates: number[][][]
}

type CoordinateReferenceSystem = {
  type: string
  properties: CoordinateReferenceSystemProperties
}

type CoordinateReferenceSystemProperties = {
  name: string
}

export type ApiExclusionZoneResponse = {
  exclusionZones: ApiExclusionZone[]
  nextToken: string | null
}

export default class PeopleExclusionApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('People Exclusion API', config.apis.emdiApi, logger, authenticationClient)
  }

  async getExclusionZone(username: string, personId: string): Promise<ApiExclusionZoneResponse> {
    return this.get<ApiExclusionZoneResponse>(
      {
        path: `/people/${personId}/exclusion-zones`,
      },
      asSystem(username),
    )
  }
}
