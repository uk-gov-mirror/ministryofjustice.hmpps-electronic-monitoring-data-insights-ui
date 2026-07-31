import { Request, Response } from 'express'
import AuditService, { Page } from '../../services/auditService'
import CaseLocationActivityService, {
  type CaseLocationBasePosition,
  type CaseLocationPosition,
} from '../../services/caseLocationActivityService'
import mockPopDetails from '../mocks/popDetails'
import mockAdamCollins from './mocks/adamCollins'
import mockLeonelJames from './mocks/leonelJames'
import mockSamJamesWalker from './mocks/samJamesWalker'
import { getDateStringFromDateObject, getFormattedPerson, getNameFromPersonObject } from '../../utils/dummyDataUtils'
import DateSearchValidationService from '../../services/dateSearchValidationService'
import { searchLocationsQuerySchema } from '../../schemas/locationActivity/searchDateFormSchema'
import { getDateComponents, parseDateTimeFromISOString } from '../../utils/date'
import { ValidationResult } from '../../models/ValidationResult'
import { convertZodErrorToValidationError } from '../../utils/errors'
import casesLocationLocale from './cases-location.locale.json'
import { defaultLocationMapControls, LocationMapControls } from '../../types/locationMapControls'

interface LocationDateFilterFormData {
  date: string
  hour: string
  minute: string
  second?: string
}
interface FilterStateProps {
  errors: ValidationResult
  formData: LocationBuildProps
}

interface LocationBuildProps {
  fromDate: LocationDateFilterFormData
  toDate: LocationDateFilterFormData
}

interface QueryParams {
  start?: {
    date?: string
    hour?: string
    minute?: string
    second?: string
  }
  end?: {
    date?: string
    hour?: string
    minute?: string
    second?: string
  }
  crn?: string
  mapControls?: Partial<Record<keyof LocationMapControls, unknown>>
}

interface ValidationError {
  field: string
  message: string
  href?: string
}

export default class CasesController {
  constructor(
    private readonly auditService: AuditService,
    private readonly caseLocationActivityService: CaseLocationActivityService,
    private readonly dateSearchValidationService: DateSearchValidationService,
  ) {}

  private conssumeDateFilterState(req: Request): FilterStateProps {
    const validationErrors = req.session?.validationErrors || []
    const formData = req.session?.formData as LocationBuildProps | undefined

    delete req.session?.validationErrors
    delete req.session?.formData

    return {
      errors: validationErrors,
      formData,
    }
  }

  private normalizeDateFilterFormData(dateFilter: LocationDateFilterFormData): LocationDateFilterFormData {
    const date = new Date(dateFilter.date)
    const normalizedDate = date.toISOString().split('T')[0]

    const hour = dateFilter.hour.padStart(2, '0')
    const minute = dateFilter.minute.padStart(2, '0')
    return {
      date: normalizedDate,
      hour,
      minute,
    }
  }

  private buildDateFilterFormValues(
    sessionFormData: LocationBuildProps | undefined,
    queryRange: { fromDate: string; toDate: string },
    submittedFormData?: LocationBuildProps,
  ): LocationBuildProps {
    const defaultValues = {
      date: '',
      hour: '',
      minute: '',
    }

    if (sessionFormData?.fromDate && sessionFormData?.toDate) {
      return {
        fromDate: this.normalizeDateFilterFormData(sessionFormData?.fromDate),
        toDate: this.normalizeDateFilterFormData(sessionFormData.toDate),
      }
    }

    const fromDateRange = queryRange.fromDate ? parseDateTimeFromISOString(queryRange.fromDate) : null
    const toDateRange = queryRange.toDate ? parseDateTimeFromISOString(queryRange.toDate) : null
    const formValues = {
      fromDate: fromDateRange?.isValid() ? getDateComponents(fromDateRange) : defaultValues,
      toDate: toDateRange?.isValid() ? getDateComponents(toDateRange) : defaultValues,
    }

    if (submittedFormData?.fromDate && submittedFormData?.toDate) {
      return {
        fromDate: {
          ...formValues.fromDate,
          date: submittedFormData.fromDate.date,
        },
        toDate: {
          ...formValues.toDate,
          date: submittedFormData.toDate.date,
        },
      }
    }

    return formValues
  }

  private persistFormState(req: Request, errors: ValidationResult, formData: LocationBuildProps): void {
    req.session!.validationErrors = errors
    req.session!.formData = formData
  }

  private buildSubmittedDateFilterFormValues(query: QueryParams): LocationBuildProps | undefined {
    if (!query.start || !query.end) return undefined

    return {
      fromDate: {
        date: query.start.date ?? '',
        hour: query.start.hour ?? '',
        minute: query.start.minute ?? '',
        ...(query.start.second ? { second: query.start.second } : {}),
      },
      toDate: {
        date: query.end.date ?? '',
        hour: query.end.hour ?? '',
        minute: query.end.minute ?? '',
        ...(query.end.second ? { second: query.end.second } : {}),
      },
    }
  }

  private parseBooleanMapControlValue(value: unknown): boolean | undefined {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
  }

  private buildLocationMapControls(req: Request): LocationMapControls {
    const sessionControls: Partial<LocationMapControls> = req.session?.locationMapControls || {}
    const queryControls = (req.query as QueryParams).mapControls || {}

    const baseLayer =
      queryControls.baseLayer === 'street' || queryControls.baseLayer === 'satellite'
        ? queryControls.baseLayer
        : sessionControls.baseLayer

    const controls: LocationMapControls = {
      ...defaultLocationMapControls,
      ...sessionControls,
      ...(baseLayer ? { baseLayer } : {}),
    }

    ;(['tracks', 'confidence', 'numbers', 'exclusion'] as const).forEach(key => {
      const value = this.parseBooleanMapControlValue(queryControls[key])
      if (value !== undefined) {
        controls[key] = value
      }
    })

    if (req.session) {
      req.session.locationMapControls = controls
    }
    return controls
  }

  async overview(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.CASES_OVERVIEW_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    const id = req.params.person_id
    const { highlight } = req.params

    let person
    switch (id) {
      case '1':
        person = mockAdamCollins
        break
      case '2':
        person = mockLeonelJames
        break
      case '3':
        person = mockSamJamesWalker
        break

      default:
        person = mockAdamCollins
        break
    }

    const fullName = getNameFromPersonObject(person)
    person = getFormattedPerson(person)

    const popDetails = {
      crn: person.delius_id,
      dateOfBirth: getDateStringFromDateObject(person.date_of_birth),
    }

    res.render('pages/casesOverview', {
      activeNav: 'cases',
      activeTab: 'overview',
      popData: popDetails,
      showComplianceBadge: true,
      alert: true,
      fullName,
      person,
      id,
      highlight,
    })
  }

  async curfew(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.CASES_CURFEW_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })
    res.render('pages/casesCurfew', {
      activeNav: 'cases',
      activeTab: 'curfew',
      popData: mockPopDetails,
      showComplianceBadge: true,
      alert: true,
      id: req.params.id,
    })
  }

  async location(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.CASES_LOCATION_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    const personId = req.params.person_id
    const { errors: sessionErrors, formData: sessionFormData } = this.conssumeDateFilterState(req)
    const crn = req.query.crn as string
    let positions: CaseLocationBasePosition[] = []
    let positionCardData: CaseLocationPosition[] = []
    let validationErrors: ValidationError[] = sessionErrors
    let hasSearched = false
    let locationAlert: { text: string } | null = null
    let queryRange = { fromDate: '', toDate: '' }
    let formValues: LocationBuildProps
    const mapControls = this.buildLocationMapControls(req)

    const hasQueryParams = req.query.start !== undefined || req.query.end !== undefined

    if (hasQueryParams) {
      hasSearched = true
      const queryResult = searchLocationsQuerySchema.safeParse(req.query)

      if (!queryResult.success) {
        const rawQuery = req.query as QueryParams

        formValues = {
          fromDate: {
            date: rawQuery?.start?.date ?? '',
            hour: rawQuery?.start?.hour ?? '',
            minute: rawQuery?.start?.minute ?? '',
          },
          toDate: {
            date: rawQuery?.end?.date ?? '',
            hour: rawQuery?.end?.hour ?? '',
            minute: rawQuery?.end?.minute ?? '',
          },
        }
        validationErrors = queryResult.error.issues.map(issue => {
          const field = issue.path.join('.')

          const href = `#${issue.path.join('-')}`
          return {
            field,
            message: issue.message,
            href,
          }
        })
      } else {
        queryRange = queryResult.data

        const fromDate = parseDateTimeFromISOString(queryResult.data.fromDate)
        const toDate = parseDateTimeFromISOString(queryResult.data.toDate)
        const validation = this.dateSearchValidationService.validateDateSearchRequest(fromDate, toDate)
        if (validation.success) {
          try {
            positions = await this.caseLocationActivityService.getPositions(
              res.locals.user.username,
              crn,
              queryResult.data.fromDate,
              queryResult.data.toDate,
            )

            positionCardData = this.caseLocationActivityService.annotatePositionsWithDisplayProperties(positions)
          } catch (error) {
            /* eslint no-console: ["error", { allow: ["warn", "error"] }] */
            console.error('Error fetching locations:', error)
            locationAlert = { text: casesLocationLocale.alerts.fetchError }
          }
        } else {
          validationErrors = validation.errors || []
        }

        formValues = this.buildDateFilterFormValues(
          sessionFormData,
          queryRange,
          this.buildSubmittedDateFilterFormValues(req.query as QueryParams),
        )
      }
    } else {
      formValues = this.buildDateFilterFormValues(sessionFormData, queryRange)
    }
    if (!locationAlert && hasSearched && positions.length === 0) {
      locationAlert = { text: casesLocationLocale.alerts.noResults }
    }
    const isMapLoading = hasSearched && positions.length > 0 && !(locationAlert && locationAlert.text)
    res.render('pages/casesLocation', {
      activeNav: 'cases',
      activeTab: 'location-activity',
      locale: casesLocationLocale,
      popData: mockPopDetails,
      positions: positionCardData,
      showComplianceBadge: true,
      alert: true,
      id: personId,
      dateFilterForm: {
        action: `/cases/${personId}/location-activity`,
        values: formValues,
        crn,
        errors: validationErrors,
        errorSummary: validationErrors.map(err => ({ text: err.message, href: err?.href })),
      },
      hasSearched,
      fromDate: queryRange.fromDate,
      toDate: queryRange.toDate,
      locationAlert,
      mapControls,
      isMapLoading,
      currentUrl: encodeURIComponent(String(req.originalUrl)),
    })
  }

  async searchLocation(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.CASES_LOCATION_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    const personId = req.params.person_id
    const { fromDate, toDate } = req.body
    const formPayload = { fromDate, toDate }

    const parsedform = searchLocationsQuerySchema.safeParse(formPayload)

    if (!parsedform.success) {
      const errors = convertZodErrorToValidationError(parsedform.error)
      this.persistFormState(req, errors, formPayload)
      return res.redirect(`/cases/${personId}/location-activity`)
    }

    const fromDateTime = parseDateTimeFromISOString(parsedform.data.fromDate)
    const toDateTime = parseDateTimeFromISOString(parsedform.data.toDate)
    const validation = this.dateSearchValidationService.validateDateSearchRequest(fromDateTime, toDateTime)

    if (!validation.success) {
      this.persistFormState(req, validation.errors || [], formPayload)
      return res.redirect(`/cases/${personId}/location-activity`)
    }

    const query = new URLSearchParams({
      fromDate: parsedform.data.fromDate,
      toDate: parsedform.data.toDate,
    })

    return res.redirect(`/cases/${personId}/location-activity?${query.toString()}`)
  }

  async notes(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.CASES_NOTES_PAGE, { who: res.locals.user.username, correlationId: req.id })
    res.render('pages/casesNotes', {
      activeNav: 'cases',
      activeTab: 'notes',
      id: req.params.id,
    })
  }
}
