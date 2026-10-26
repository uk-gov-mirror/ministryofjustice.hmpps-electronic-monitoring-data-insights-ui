import { asSystem, RestClient } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import config from '../config'
import logger from '../../logger'

  
export type ApiRestrictionZone = {
  name: string
  address: string 
  restrictionZoneId: number
  restrictionType: 'EXCLUSION' | 'INCLUSION'
  geometry: Geometry
  schedule: {
    scheduleType: string
    activeFrom: string
    activeTo: string
    applicableFrom: string
    applicableTo: string
    recurrence?: {
      weekFrequency: number
      daysOfWeek: string[]
    }
  }
} 

export type RestrictionZonesResult = {
  exclusionZones: ApiRestrictionZone[]
  inclusionZones: ApiRestrictionZone[]
}

export type PolygonGeometry = {
  type: 'Polygon'
  crs?: CoordinateReferenceSystem
  coordinates: number[][][]
}

export type PointGeometry = {
  type: 'Point'
  crs?: CoordinateReferenceSystem
  coordinates: number[]
  radiusMetres: number
}

export type Geometry = PolygonGeometry | PointGeometry

type CoordinateReferenceSystem = {
  type: string
  properties: CoordinateReferenceSystemProperties
}

type CoordinateReferenceSystemProperties = {
  name: string
}

export type ApiRestrictionZoneResponse = {
  restrictionZones: ApiRestrictionZone[]
}

export default class PeopleExclusionApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('People Exclusion API', config.apis.emdiApi, logger, authenticationClient)
  }

  async getRestrictionZones(
    username: string,
    personId: string,
    crn: string,
    exclusions: boolean = false,
    inclusions: boolean = false,
  ): Promise<ApiRestrictionZoneResponse> {
    return this.get<ApiRestrictionZoneResponse>(
      {
        path: `/people/${personId}/restrictions`,
        query: { crn, exclusions, inclusions },
      },
      asSystem(username),
    )
  }
}
