import type { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import PeopleExclusionApiClient, { type ApiRestrictionZoneResponse } from '../data/peopleExclusionApiClient'
import PeopleExclusionService from './peopleExclusionService'

describe('PeopleExclusionService', () => {
  it('forwards the CRN and preserves exclusion geometry, identifiers and schedules while filtering inclusion zones', async () => {
    const client = new PeopleExclusionApiClient({} as AuthenticationClient)
    const schedule = {
      scheduleType: 'SCHEDULED',
      activeFrom: '2026-10-30T15:05:29.619Z',
      activeTo: '2026-10-31T15:05:29.619Z',
      applicableFrom: '2026-10-30T15:05:29.619Z',
      applicableTo: '2026-10-31T15:05:29.619Z',
      recurrence: { weekFrequency: 1, daysOfWeek: ['MONDAY'] },
    }
    const response: ApiRestrictionZoneResponse = {
      restrictionZones: [
        {
          restrictionZoneId: 1,
          restrictionType: 'EXCLUSION',
          schedule,
          name: 'Zone A',
          address: '1 Test Street',
          geometry: {
            type: 'Polygon',
            crs: { type: 'name', properties: { name: 'EPSG:4326' } },
            coordinates: [
              [
                [-0.1, 51.5],
                [-0.1, 51.51],
                [-0.09, 51.51],
                [-0.1, 51.5],
              ],
            ],
          },
        },
        {
          restrictionZoneId: 2,
          restrictionType: 'INCLUSION',
          name: 'Inclusion zone',
          address: '2 Test Street',
          geometry: { type: 'Point', coordinates: [-0.1, 51.5], radiusMetres: 100 },
          schedule,
        },
        {
          restrictionZoneId: 3,
          restrictionType: 'EXCLUSION',
          name: 'Circular exclusion',
          address: '3 Test Street',
          geometry: { type: 'Point', coordinates: [-0.2, 51.6], radiusMetres: 250 },
          schedule,
        },
      ],
    }
    const getZone = jest.spyOn(client, 'getRestrictionZones').mockResolvedValue(response)

    const result = await new PeopleExclusionService(client).getRestrictionZones(
      'user1',
      '41591',
      'X31092',
      false,
      false,
    )

    expect(getZone).toHaveBeenCalledWith('user1', '41591', 'X31092', false, false)
    expect(result).toEqual({
      exclusionZones: [response.restrictionZones[0], response.restrictionZones[2]],
      inclusionZones: [response.restrictionZones[1]],
    })
  })

  it('returns no exclusion zones for an empty response', async () => {
    const client = new PeopleExclusionApiClient({} as AuthenticationClient)
    jest.spyOn(client, 'getRestrictionZones').mockResolvedValue({ restrictionZones: [] })

    await expect(new PeopleExclusionService(client).getRestrictionZones('user1', '41591', 'X31092')).resolves.toEqual({
      exclusionZones: [],
      inclusionZones: [],
    })
  })

  it('propagates API errors to the controller', async () => {
    const client = new PeopleExclusionApiClient({} as AuthenticationClient)
    const error = new Error('Restriction zones unavailable')
    jest.spyOn(client, 'getRestrictionZones').mockRejectedValue(error)

    await expect(
      new PeopleExclusionService(client).getRestrictionZones('user1', '41591', 'X31092', true, false),
    ).rejects.toThrow(error)
  })
})
