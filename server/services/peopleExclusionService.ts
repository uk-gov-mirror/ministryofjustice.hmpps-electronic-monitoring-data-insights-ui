import type PeopleExclusionApiClient from '../data/peopleExclusionApiClient'
import type { ApiExclusionZone, ApiExclusionZoneResponse } from '../data/peopleExclusionApiClient'

export default class PeopleExclusionService {
  constructor(private readonly peopleExclusionApiClient: PeopleExclusionApiClient) {}

  async getExclusionZone(username: string, personId: string): Promise<ApiExclusionZoneResponse> {
    const response = await this.peopleExclusionApiClient.getExclusionZone(username, personId)
    return {
      exclusionZones: this.mapExclusionZones(response),
      nextToken: response.nextToken,
    }
  }

  private mapExclusionZones(response: ApiExclusionZoneResponse): ApiExclusionZone[] {
    const { exclusionZones } = response
    return (exclusionZones ?? []).map(zone => ({
      name: zone.name,
      address: zone.address,
      geometry: zone.geometry,
    }))
  }
}
