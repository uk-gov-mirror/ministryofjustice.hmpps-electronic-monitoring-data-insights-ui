import type PeopleExclusionApiClient from '../data/peopleExclusionApiClient'
import type { RestrictionZonesResult } from '../data/peopleExclusionApiClient'
import type {
  ApiRestrictionZone,
  ApiRestrictionZoneResponse,
} from '../data/peopleExclusionApiClient'

export default class PeopleExclusionService {
  constructor(private readonly peopleExclusionApiClient: PeopleExclusionApiClient) {}

  async getRestrictionZones(
    username: string,
    personId: string,
    crn: string,
    exclusions: boolean = false,
    inclusions: boolean = false,
  ): Promise<RestrictionZonesResult> {
    const response = await this.peopleExclusionApiClient.getRestrictionZones(
      username,
      personId,
      crn,
      exclusions,
      inclusions,
    )
    return {
      exclusionZones: this.mapRestrictionZones(response).filter(zone => zone.restrictionType === 'EXCLUSION'),
      inclusionZones: this.mapRestrictionZones(response).filter(zone => zone.restrictionType === 'INCLUSION'),
    }
  }

  private mapRestrictionZones(response: ApiRestrictionZoneResponse): ApiRestrictionZone[] {
    const { restrictionZones } = response
    return (restrictionZones ?? []).map(zone => ({
      restrictionZoneId: zone.restrictionZoneId, 
      restrictionType: zone.restrictionType,
      name: zone.name,
      address: zone.address,
      geometry: zone.geometry,
      schedule: zone.schedule,
    }))
  }
}
