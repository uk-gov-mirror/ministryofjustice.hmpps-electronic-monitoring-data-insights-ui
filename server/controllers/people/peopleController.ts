import { Request, Response } from 'express'
import type session from 'express-session'
import PeopleService from '../../services/peopleService'
import AuditService, { Page } from '../../services/auditService'
import CaseLocationActivityService, {
  type CaseLocationBasePosition,
  type CaseLocationPosition,
} from '../../services/caseLocationActivityService'
import DateSearchValidationService from '../../services/dateSearchValidationService'
import { ValidationResult } from '../../models/ValidationResult'
import { searchLocationsQuerySchema } from '../../schemas/locationActivity/searchDateFormSchema'
import { calculateAge, getDateComponents, parseDateTimeFromISOString } from '../../utils/date'
import casesLocationLocale from '../cases/cases-location.locale.json'
import { defaultLocationMapControls, LocationMapControls } from '../../types/locationMapControls'
import PeopleExclusionService from '../../services/peopleExclusionService'
import { ApiExclusionZoneResponse } from '../../data/peopleExclusionApiClient'

type SelectedPersonContext = session.SessionData['peopleSelection'][string]

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
  mapControls?: Partial<Record<keyof LocationMapControls, unknown>>
}

interface ValidationError {
  field: string
  message: string
  href?: string
}

export default class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly auditService: AuditService,
    private readonly caseLocationActivityService: CaseLocationActivityService,
    private readonly dateSearchValidationService: DateSearchValidationService,
    private readonly peopleExclusionService: PeopleExclusionService,
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

  private parseBooleanMapControlValue(value: unknown): boolean | undefined {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
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

  async getPersonByDeliusId(req: Request, res: Response): Promise<void> {
    const { delius_id: deliusId } = req.params
    const { username } = res.locals.user
    const result = await this.peopleService.searchPeople(username, deliusId)
    const person = result.people[0] ?? null

    if (person) {
      this.setSelectedPerson(req, deliusId, {
        personId: person.id ?? '',
        consumerId: person.consumerId ?? '',
        fullName: person.name ?? '',
        dateOfBirth: person.dateOfBirth ?? '',
      })
    }

    const redirectTo = this.getAllowedRedirectTo(req, deliusId)

    if (redirectTo && person) {
      res.redirect(redirectTo)
      return
    }

    res.render('pages/person', {
      activeNav: 'people',
      fullName: person?.name ?? 'Person not found',
      popData: person
        ? {
            crn: person.deliusId,
            dateOfBirth: person.dateOfBirth,
          }
        : null,
      showComplianceBadge: false,
      person,
    })
  }

  async location(req: Request, res: Response): Promise<void> {
    await this.auditService.logPageView(Page.PEOPLE_LOCATION_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    const { delius_id: deliusId } = req.params
    const personContext = this.getSelectedPerson(req, deliusId)

    if (!personContext) {
      const redirectTo = encodeURIComponent(`/people/${deliusId}/locations`)
      res.redirect(`/people/${deliusId}?redirectTo=${redirectTo}`)
      return
    }

    const { errors: sessionErrors, formData: sessionFormData } = this.conssumeDateFilterState(req)
    let positions: CaseLocationBasePosition[] = []
    let positionCardData: CaseLocationPosition[] = []
    let exclusionResult: ApiExclusionZoneResponse | null = null
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
          if (personContext.personId) {
            try {
              const crn = deliusId
              positions = await this.caseLocationActivityService.getPositions(
                res.locals.user.username,
                personContext.personId,
                queryResult.data.fromDate,
                queryResult.data.toDate,
                { crn },
              )
              positionCardData = this.caseLocationActivityService.annotatePositionsWithDisplayProperties(positions)
              exclusionResult = await this.peopleExclusionService.getExclusionZone(
                res.locals.user.username,
                personContext.personId,
              )
            } catch (error) {
              /* eslint no-console: ["error", { allow: ["warn", "error"] }] */
              console.error('Error fetching locations:', error)
              locationAlert = { text: casesLocationLocale.alerts.fetchError }
            }
          } else {
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

    if (!locationAlert && hasSearched && validationErrors.length === 0 && positions.length === 0) {
      locationAlert = { text: casesLocationLocale.alerts.noResults }
    }

    const isMapLoading = hasSearched && positions.length > 0 && !(locationAlert && locationAlert.text)

    res.render('pages/personLocation', {
      activeNav: 'cases',
      activeTab: 'locations',
      locale: casesLocationLocale,
      fullName: personContext.fullName,
      popData: {
        crn: deliusId,
        dateOfBirth: personContext.dateOfBirth,
        age: calculateAge(personContext.dateOfBirth),
      },
      showComplianceBadge: false,
      personContext,
      positions: positionCardData,
      dateFilterForm: {
        action: `/people/${deliusId}/locations`,
        values: formValues,
        errors: validationErrors,
        errorSummary: validationErrors.map(err => ({ text: err.message, href: err?.href })),
        showCrn: false,
      },
      hasSearched,
      isMapLoading,
      fromDate: queryRange.fromDate,
      toDate: queryRange.toDate,
      locationAlert,
      mapControls,
      currentUrl: encodeURIComponent(String(req.originalUrl)),
      exclusionZones: exclusionResult?.exclusionZones ?? null,
    })
  }

  private getSelectedPerson(req: Request, deliusId: string): SelectedPersonContext | null {
    return req.session.peopleSelection?.[deliusId] ?? null
  }

  private getAllowedRedirectTo(req: Request, deliusId: string): string | null {
    const redirectTo = typeof req.query.redirectTo === 'string' ? req.query.redirectTo : null
    const allowedRedirectTo = `/people/${deliusId}/locations`

    return redirectTo === allowedRedirectTo ? redirectTo : null
  }

  private setSelectedPerson(req: Request, deliusId: string, personContext: SelectedPersonContext): void {
    req.session.peopleSelection = {
      ...(req.session.peopleSelection || {}),
      [deliusId]: personContext,
    }
  }
}
