import { asSystem } from '@ministryofjustice/hmpps-rest-client'
import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import PeopleExclusionApiClient, { type ApiRestrictionZoneResponse } from './peopleExclusionApiClient'

describe('PeopleExclusionApiClient', () => {
  it('includes the required CRN query parameter while retaining the person ID in the path', async () => {
    const client = new PeopleExclusionApiClient({} as AuthenticationClient)
    const response: ApiRestrictionZoneResponse = { restrictionZones: [] }
    const getSpy = jest.spyOn(client, 'get').mockResolvedValue(response)

    const result = await client.getRestrictionZones('user1', '41591', 'X31092', true, false)

    expect(getSpy).toHaveBeenCalledWith(
      { path: '/people/41591/restrictions', query: { crn: 'X31092', exclusions: true, inclusions: false } },
      asSystem('user1'),
    )
    expect(result).toEqual(response)
  })
})
