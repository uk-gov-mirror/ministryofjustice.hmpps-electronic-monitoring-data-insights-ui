import { Request, Response } from 'express'
import type session from 'express-session'
import type { Person } from '../../services/peopleService'
import type PeopleService from '../../services/peopleService'
import { user } from '../../routes/testutils/appSetup'
import AuditService, { Page } from '../../services/auditService'
import CaseLocationActivityService, { type CaseLocationBasePosition } from '../../services/caseLocationActivityService'
import DateSearchValidationService from '../../services/dateSearchValidationService'
import PeopleExclusionService from '../../services/peopleExclusionService'
import casesLocationLocale from '../cases/cases-location.locale.json'
import PeopleController from './peopleController'

jest.mock('../../services/auditService')

describe('PeopleController', () => {
  let peopleService: jest.Mocked<PeopleService>
  let auditService: jest.Mocked<AuditService>
  let caseLocationActivityService: { getPositions: jest.Mock; annotatePositionsWithDisplayProperties: jest.Mock }
  let dateSearchValidationService: jest.Mocked<DateSearchValidationService>
  let peopleExclusionService: jest.Mocked<PeopleExclusionService>
  let controller: PeopleController
  let req: Partial<Request>
  let res: Partial<Response>

  const firstPerson: Person = {
    id: '41591',
    consumerId: '9b74b1071beb2210743d8551f54bcbcc',
    name: 'DEVWR0004718',
    nomisId: 'Q0788IA',
    pncId: 'MU50/038758B',
    deliusId: 'X31092',
    horId: 'C5011307',
    ceprId: null,
    prisonId: 'J05007',
    dateOfBirth: '2020-01-01',
    address: {
      postcode: 'BL2 1EW',
      city: 'Bolton',
      street: '2 Dunlin Close',
    },
  }

  beforeEach(() => {
    auditService = new AuditService(null) as jest.Mocked<AuditService>

    caseLocationActivityService = {
      getPositions: jest.fn(),
      annotatePositionsWithDisplayProperties: jest.fn(positions => positions),
    }

    dateSearchValidationService = {
      validateDateSearchRequest: jest.fn().mockReturnValue({ success: true }),
    } as unknown as jest.Mocked<DateSearchValidationService>

    peopleService = {
      searchPeople: jest.fn(),
    } as unknown as jest.Mocked<PeopleService>

    peopleExclusionService = { getExclusionZone: jest.fn() } as unknown as jest.Mocked<PeopleExclusionService>

    req = {
      id: 'test-correlation-id',
      params: { delius_id: 'X31092' },
      query: {},
      originalUrl: '/people/X31092/locations',
      session: {} as Request['session'],
    }

    res = {
      locals: { user },
      render: jest.fn(),
      redirect: jest.fn(),
    }

    controller = new PeopleController(
      peopleService,
      auditService,
      caseLocationActivityService as unknown as CaseLocationActivityService,
      dateSearchValidationService,
      peopleExclusionService,
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders the first person for the supplied delius id', async () => {
    peopleService.searchPeople.mockResolvedValue({
      people: [firstPerson],
      nextToken: null,
    })

    await controller.getPersonByDeliusId(req as Request, res as Response)

    expect(peopleService.searchPeople).toHaveBeenCalledWith(user.username, 'X31092')
    expect(req.session).toEqual({
      peopleSelection: {
        X31092: {
          personId: '41591',
          consumerId: '9b74b1071beb2210743d8551f54bcbcc',
          fullName: 'DEVWR0004718',
          dateOfBirth: '2020-01-01',
        },
      },
    })
    expect(res.render).toHaveBeenCalledWith('pages/person', {
      activeNav: 'people',
      fullName: firstPerson.name,
      popData: {
        crn: firstPerson.deliusId,
        dateOfBirth: firstPerson.dateOfBirth,
      },
      showComplianceBadge: false,
      person: firstPerson,
    })
  })

  it('redirects onward after hydrating session when redirectTo is provided', async () => {
    peopleService.searchPeople.mockResolvedValue({
      people: [firstPerson],
      nextToken: null,
    })
    req.query = { redirectTo: '/people/X31092/locations' }

    await controller.getPersonByDeliusId(req as Request, res as Response)

    expect(res.redirect).toHaveBeenCalledWith('/people/X31092/locations')
    expect(res.render).not.toHaveBeenCalled()
    expect(req.session).toEqual({
      peopleSelection: {
        X31092: {
          personId: '41591',
          consumerId: '9b74b1071beb2210743d8551f54bcbcc',
          fullName: 'DEVWR0004718',
          dateOfBirth: '2020-01-01',
        },
      },
    })
  })

  it('renders person not found instead of redirecting onward when redirectTo is provided and no person is found', async () => {
    peopleService.searchPeople.mockResolvedValue({
      people: [],
      nextToken: null,
    })
    req.query = { redirectTo: '/people/X31092/locations' }

    await controller.getPersonByDeliusId(req as Request, res as Response)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session).toEqual({})
    expect(res.render).toHaveBeenCalledWith('pages/person', {
      activeNav: 'people',
      fullName: 'Person not found',
      popData: null,
      showComplianceBadge: false,
      person: null,
    })
  })

  it('does not redirect to an unrecognised redirectTo path', async () => {
    peopleService.searchPeople.mockResolvedValue({
      people: [firstPerson],
      nextToken: null,
    })
    req.query = { redirectTo: 'https://example.com' }

    await controller.getPersonByDeliusId(req as Request, res as Response)

    expect(res.redirect).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith('pages/person', {
      activeNav: 'people',
      fullName: firstPerson.name,
      popData: {
        crn: firstPerson.deliusId,
        dateOfBirth: firstPerson.dateOfBirth,
      },
      showComplianceBadge: false,
      person: firstPerson,
    })
  })

  const setPersonContext = (overrides: Partial<session.SessionData['peopleSelection'][string]> = {}) => {
    req.session = {
      peopleSelection: {
        X31092: {
          personId: '41591',
          consumerId: '9b74b1071beb2210743d8551f54bcbcc',
          fullName: 'DEVWR0004718',
          dateOfBirth: '2020-01-01',
          ...overrides,
        },
      },
    } as unknown as session.Session & Partial<session.SessionData>
  }

  it('renders the initial location map page when state exists in session for the delius id', async () => {
    setPersonContext()

    await controller.location(req as Request, res as Response)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.PEOPLE_LOCATION_PAGE, {
      who: user.username,
      correlationId: 'test-correlation-id',
    })
    expect(caseLocationActivityService.getPositions).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        activeNav: 'cases',
        activeTab: 'locations',
        locale: casesLocationLocale,
        fullName: 'DEVWR0004718',
        popData: {
          age: 6,
          crn: 'X31092',
          dateOfBirth: '2020-01-01',
        },
        showComplianceBadge: false,
        personContext: {
          personId: '41591',
          consumerId: '9b74b1071beb2210743d8551f54bcbcc',
          fullName: 'DEVWR0004718',
          dateOfBirth: '2020-01-01',
        },
        positions: [],
        dateFilterForm: {
          action: '/people/X31092/locations',
          values: {
            fromDate: { date: '', hour: '', minute: '' },
            toDate: { date: '', hour: '', minute: '' },
          },
          errors: [],
          errorSummary: [],
          showCrn: false,
        },
        hasSearched: false,
        isMapLoading: false,
        fromDate: '',
        toDate: '',
        locationAlert: null,
        exclusionZones: null,
        mapControls: {
          baseLayer: 'street',
          tracks: true,
          confidence: true,
          numbers: true,
          exclusion: false,
        },
        currentUrl: encodeURIComponent('/people/X31092/locations'),
      }),
    )
  })

  it('fetches locations using person context personId for a valid search', async () => {
    setPersonContext()
    req.query = {
      start: { date: '12/01/2026', hour: '10', minute: '00' },
      end: { date: '14/01/2026', hour: '11', minute: '00' },
    }
    req.originalUrl =
      '/people/X31092/locations?start[date]=12/01/2026&start[hour]=10&start[minute]=00&end[date]=14/01/2026&end[hour]=11&end[minute]=00'
    const positions: CaseLocationBasePosition[] = [
      {
        positionId: 1,
        latitude: 51.5,
        longitude: -0.1,
        precision: 10,
        speed: 0,
        direction: 0,
        timestamp: '2026-01-12T10:00:00.000Z',
        geolocationMechanism: 'GPS',
        sequenceNumber: 1,
        deviceId: null,
        hdop: null,
        geometry: null,
        satellite: null,
        lbs: null,
        gpsDate: '2026-01-12T10:00:00.000Z',
      },
    ]
    const annotatedPositions = [{ ...positions[0], displayPointNumber: 1 }]
    caseLocationActivityService.getPositions.mockResolvedValue(positions)
    caseLocationActivityService.annotatePositionsWithDisplayProperties.mockReturnValue(annotatedPositions)

    await controller.location(req as Request, res as Response)

    expect(caseLocationActivityService.getPositions).toHaveBeenCalledWith(
      user.username,
      '41591',
      '2026-01-12T10:00:00.000Z',
      '2026-01-14T11:00:00.000Z',
      { crn: 'X31092' },
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        positions: annotatedPositions,
        hasSearched: true,
        isMapLoading: true,
        fromDate: '2026-01-12T10:00:00.000Z',
        toDate: '2026-01-14T11:00:00.000Z',
        locationAlert: null,
        exclusionZones: null,
        dateFilterForm: expect.objectContaining({
          showCrn: false,
          values: {
            fromDate: { date: '12/01/2026', hour: '10', minute: '00', second: '00' },
            toDate: { date: '14/01/2026', hour: '11', minute: '00', second: '00' },
          },
        }),
      }),
    )
  })

  it('preserves submitted date formatting in the location search form', async () => {
    setPersonContext()
    req.query = {
      start: { date: '2/6/2026', hour: '01', minute: '05' },
      end: { date: '3/6/2026', hour: '02', minute: '06' },
    }
    caseLocationActivityService.getPositions.mockResolvedValue([])

    await controller.location(req as Request, res as Response)

    expect(caseLocationActivityService.getPositions).toHaveBeenCalledWith(
      user.username,
      '41591',
      '2026-06-02T00:05:00.000Z',
      '2026-06-03T01:06:00.000Z',
      { crn: 'X31092' },
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        dateFilterForm: expect.objectContaining({
          values: {
            fromDate: { date: '2/6/2026', hour: '01', minute: '05', second: '00' },
            toDate: { date: '3/6/2026', hour: '02', minute: '06', second: '00' },
          },
        }),
      }),
    )
  })

  it('renders validation errors for an invalid search and does not fetch locations', async () => {
    setPersonContext()
    req.query = {
      start: { date: '', hour: '', minute: '' },
      end: { date: '14/01/2026', hour: '11', minute: '00' },
    }

    await controller.location(req as Request, res as Response)

    expect(caseLocationActivityService.getPositions).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        hasSearched: true,
        isMapLoading: false,
        locationAlert: null,
        exclusionZones: null,
        dateFilterForm: expect.objectContaining({
          showCrn: false,
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: expect.stringContaining('start'),
            }),
          ]),
          errorSummary: expect.arrayContaining([
            expect.objectContaining({
              href: expect.stringContaining('#start'),
            }),
          ]),
        }),
      }),
    )
  })

  it('shows a no results alert for a valid search with no positions', async () => {
    setPersonContext()
    req.query = {
      start: { date: '12/01/2026', hour: '10', minute: '00' },
      end: { date: '14/01/2026', hour: '11', minute: '00' },
    }
    caseLocationActivityService.getPositions.mockResolvedValue([])

    await controller.location(req as Request, res as Response)

    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        locationAlert: { text: casesLocationLocale.alerts.noResults },
      }),
    )
  })

  it('shows a fetch error alert when the location service fails', async () => {
    setPersonContext()
    req.query = {
      start: { date: '12/01/2026', hour: '10', minute: '00' },
      end: { date: '14/01/2026', hour: '11', minute: '00' },
    }
    caseLocationActivityService.getPositions.mockRejectedValue(new Error('Search service error'))

    await controller.location(req as Request, res as Response)

    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        locationAlert: { text: casesLocationLocale.alerts.fetchError },
      }),
    )
  })

  it('shows a fetch error alert when person context does not include personId', async () => {
    setPersonContext({ personId: '' })
    req.query = {
      start: { date: '12/01/2026', hour: '10', minute: '00' },
      end: { date: '14/01/2026', hour: '11', minute: '00' },
    }

    await controller.location(req as Request, res as Response)

    expect(caseLocationActivityService.getPositions).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/personLocation',
      expect.objectContaining({
        locationAlert: { text: casesLocationLocale.alerts.fetchError },
      }),
    )
  })

  it('redirects back through the person page when location state is missing', async () => {
    await controller.location(req as Request, res as Response)

    expect(res.redirect).toHaveBeenCalledWith('/people/X31092?redirectTo=%2Fpeople%2FX31092%2Flocations')
    expect(res.render).not.toHaveBeenCalled()
  })
})
