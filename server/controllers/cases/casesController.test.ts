import { Request, Response } from 'express'
import CasesController from './casesController'
import AuditService, { Page } from '../../services/auditService'
import CaseLocationActivityService from '../../services/caseLocationActivityService'
import { user } from '../../routes/testutils/appSetup'
import mockPopDetails from '../mocks/popDetails'
import * as dummyDataUtils from '../../utils/dummyDataUtils'
import { FormattedPerson } from '../../interfaces/dummyDataPerson'
import DateSearchValidationService from '../../services/dateSearchValidationService'
import { ValidationError } from '../../models/ValidationResult'
import {
  buildLocationPageInitialState,
  buildLocationPageWithServiceError,
  buildLocationPageWithValidationErrors,
} from '../../testutils/factories/locationPage.factory'
import casesLocationLocale from './cases-location.locale.json'

jest.mock('../../services/auditService')
jest.mock('../../services/caseLocationActivityService')
jest.mock('../../services/dateSearchValidationService')

const mockQueryData = {
  crn: 'X172591',
  start: { date: '12/01/2026', hour: '10', minute: '00', second: '00' },
  end: { date: '14/01/2026', hour: '11', minute: '00', second: '00' },
}

const mockOriginalUrl = `/cases/X172591/location-activity?crn=X172591&start[date]=12/01/2026&start[hour]=10&start[minute]=00&end[date]=14/01/2026&end[hour]=11&end[minute]=00`
const mockCurrentUrl = encodeURIComponent(mockOriginalUrl)

describe('CasesController', () => {
  let auditService: jest.Mocked<AuditService>
  let caseLocationActivityService: { getPositions: jest.Mock; annotatePositionsWithDisplayProperties: jest.Mock }
  let dateSearchValidationService: jest.Mocked<DateSearchValidationService>
  let controller: CasesController
  let req: Partial<Request>
  let res: Partial<Response>

  jest.spyOn(dummyDataUtils, 'getNameFromPersonObject').mockReturnValue('John Smith')
  jest.spyOn(dummyDataUtils, 'getFormattedPerson').mockReturnValue({
    delius_id: 'X123456',
    date_of_birth: { year: 1990, month: 1, day: 1 },
  } as unknown as FormattedPerson)

  beforeEach(() => {
    auditService = new AuditService(null) as jest.Mocked<AuditService>

    dateSearchValidationService = {
      validateDateSearchRequest: jest.fn().mockReturnValue({ success: true }),
    } as jest.Mocked<DateSearchValidationService>

    caseLocationActivityService = {
      getPositions: jest.fn(),
      annotatePositionsWithDisplayProperties: jest.fn(positions => positions),
    }

    req = { id: 'test-correlation-id', params: { id: '1', highlight: null } }
    res = { locals: { user }, render: jest.fn() }

    controller = new CasesController(
      auditService,
      caseLocationActivityService as unknown as CaseLocationActivityService,
      dateSearchValidationService,
    )
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('overview', () => {
    it('should log page view and render overview tab', async () => {
      await controller.overview(req as Request, res as Response)
      expect(auditService.logPageView).toHaveBeenCalledWith(Page.CASES_OVERVIEW_PAGE, {
        who: 'user1',
        correlationId: 'test-correlation-id',
      })
      expect(res.render).toHaveBeenCalledWith('pages/casesOverview', {
        activeNav: 'cases',
        activeTab: 'overview',
        popData: {
          crn: 'X123456',
          dateOfBirth: 'Monday, 1 January 1990',
        },
        showComplianceBadge: true,
        highlight: null,
        id: undefined,
        alert: true,
        fullName: 'John Smith',
        person: { delius_id: 'X123456', date_of_birth: { year: 1990, month: 1, day: 1 } },
      })
    })
  })

  describe('curfew', () => {
    it('should log page view and render curfew tab', async () => {
      await controller.curfew(req as Request, res as Response)
      expect(auditService.logPageView).toHaveBeenCalledWith(Page.CASES_CURFEW_PAGE, {
        who: 'user1',
        correlationId: 'test-correlation-id',
      })
      expect(res.render).toHaveBeenCalledWith('pages/casesCurfew', {
        activeNav: 'cases',
        activeTab: 'curfew',
        popData: mockPopDetails,
        showComplianceBadge: true,
        alert: true,
        id: '1',
      })
    })
  })

  describe('locationActivity', () => {
    beforeEach(() => {
      req.query = mockQueryData
      req.originalUrl = mockOriginalUrl
    })

    it('should log page view and render location activity tab', async () => {
      req.query = { crn: 'X172591' }
      await controller.location(req as Request, res as Response)
      expect(auditService.logPageView).toHaveBeenCalledWith(Page.CASES_LOCATION_PAGE, {
        who: 'user1',
        correlationId: 'test-correlation-id',
      })
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        buildLocationPageInitialState('X172591', {
          locale: casesLocationLocale,
          popData: mockPopDetails,
          currentUrl: mockCurrentUrl,
        }),
      )
    })

    it('should render default map controls when session is empty', async () => {
      req.query = { crn: 'X172591' }
      req.session = {} as Request['session']

      await controller.location(req as Request, res as Response)

      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        expect.objectContaining({
          mapControls: {
            baseLayer: 'street',
            tracks: true,
            confidence: true,
            numbers: true,
            exclusion: false,
          },
        }),
      )
    })

    it('should use map controls stored in session', async () => {
      req.query = { crn: 'X172591' }
      req.session = {
        locationMapControls: {
          baseLayer: 'satellite',
          tracks: false,
          confidence: true,
          numbers: false,
        },
      } as Request['session']

      await controller.location(req as Request, res as Response)

      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        expect.objectContaining({
          mapControls: {
            baseLayer: 'satellite',
            tracks: false,
            confidence: true,
            numbers: false,
            exclusion: false,
          },
        }),
      )
    })

    it('should update map controls in session from valid query parameters', async () => {
      req.query = {
        crn: 'X172591',
        mapControls: {
          baseLayer: 'satellite',
          tracks: 'false',
          confidence: 'true',
          numbers: 'false',
          exclusion: 'true',
        },
      }
      req.session = {} as Request['session']

      await controller.location(req as Request, res as Response)

      expect(req.session.locationMapControls).toEqual({
        baseLayer: 'satellite',
        tracks: false,
        confidence: true,
        numbers: false,
        exclusion: true,
      })
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        expect.objectContaining({
          mapControls: req.session.locationMapControls,
        }),
      )
    })

    it('should ignore invalid map control query parameters', async () => {
      req.query = {
        crn: 'X172591',
        mapControls: {
          baseLayer: 'hybrid',
          tracks: 'yes',
          confidence: 'no',
          numbers: 'invalid',
          exclusion: 'false',
        },
      }
      req.session = {
        locationMapControls: {
          baseLayer: 'satellite',
          tracks: false,
          confidence: false,
          numbers: true,
          exclusion: false,
        },
      } as Request['session']

      await controller.location(req as Request, res as Response)

      expect(req.session.locationMapControls).toEqual({
        baseLayer: 'satellite',
        tracks: false,
        confidence: false,
        numbers: true,
        exclusion: false,
      })
    })

    it('should handle validation errors and render location activity tab with errors', async () => {
      const validationErrors = [{ field: 'fromDate', message: 'Invalid date' }] as ValidationError[]
      dateSearchValidationService.validateDateSearchRequest.mockReturnValue({
        success: false,
        errors: validationErrors,
      })
      await controller.location(req as Request, res as Response)
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        buildLocationPageWithValidationErrors(validationErrors, mockQueryData.crn, {
          locale: casesLocationLocale,
          popData: mockPopDetails,
          currentUrl: mockCurrentUrl,
        }),
      )
    })

    it('should show alert when no location data found for valid search', async () => {
      caseLocationActivityService.getPositions.mockResolvedValue([])
      await controller.location(req as Request, res as Response)
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        buildLocationPageWithValidationErrors([], mockQueryData.crn, {
          locale: casesLocationLocale,
          popData: mockPopDetails,
          locationAlert: { text: casesLocationLocale.alerts.noResults },
          currentUrl: mockCurrentUrl,
        }),
      )
    })

    it('should handle when search service has an exception', async () => {
      caseLocationActivityService.getPositions.mockRejectedValue(new Error('Search service error'))
      await controller.location(req as Request, res as Response)
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
        buildLocationPageWithServiceError(mockQueryData.crn, mockQueryData.start.date, mockQueryData.end.date, {
          locale: casesLocationLocale,
          popData: mockPopDetails,
          currentUrl: mockCurrentUrl,
        }),
      )
    })

    it('preserves submitted date formatting in the location search form', async () => {
      req.query = {
        crn: 'X172591',
        start: { date: '2/6/2026', hour: '01', minute: '05' },
        end: { date: '3/6/2026', hour: '02', minute: '06' },
      }
      caseLocationActivityService.getPositions.mockResolvedValue([])

      await controller.location(req as Request, res as Response)

      expect(caseLocationActivityService.getPositions).toHaveBeenCalledWith(
        user.username,
        'X172591',
        '2026-06-02T00:05:00.000Z',
        '2026-06-03T01:06:00.000Z',
      )
      expect(res.render).toHaveBeenCalledWith(
        'pages/casesLocation',
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
  })

  describe('notes', () => {
    it('should log page view and render notes tab', async () => {
      await controller.notes(req as Request, res as Response)
      expect(auditService.logPageView).toHaveBeenCalledWith(Page.CASES_NOTES_PAGE, {
        who: 'user1',
        correlationId: 'test-correlation-id',
      })
      expect(res.render).toHaveBeenCalledWith('pages/casesNotes', {
        activeNav: 'cases',
        activeTab: 'notes',
        id: '1',
      })
    })
  })

  describe('casesLocationLocale', () => {
    it('should contain the expected overlay fields', () => {
      expect(casesLocationLocale.overlay).toMatchObject({
        point: expect.any(String),
        accuracy: expect.any(String),
        dateTime: expect.any(String),
        latLng: expect.any(String),
        speed: expect.any(String),
        geolocationMechanism: expect.any(String),
      })
    })
  })
})
