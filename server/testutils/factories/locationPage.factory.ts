export interface DateTimeValue {
  date: string
  hour: string
  minute: string
  second?: string
}

export interface DateFilterFormValues {
  fromDate: DateTimeValue
  toDate: DateTimeValue
}

export interface ValidationError {
  field: string
  message: string
}

export interface ErrorSummaryItem {
  text: string
  href?: string
}

export interface DateFilterForm {
  action: string
  crn: string
  errorSummary: ErrorSummaryItem[]
  errors: ValidationError[]
  values: DateFilterFormValues
}

export interface PopData {
  crn: string
  dateOfBirth: string
  tier?: string
}

export interface LocationAlert {
  text: string
  type?: 'success' | 'warning' | 'error' | 'info'
}

export interface Position {
  positionId: number
  latitude: number
  longitude: number
  precision?: number
  speed?: number
  direction?: number
  timestamp: string
  geolocationMechanism: string
  sequenceNumber?: number
}

export interface LocationPageRenderData {
  activeNav: string
  activeTab: string
  alert: boolean
  dateFilterForm: DateFilterForm
  locale?: Record<string, unknown>
  fromDate: string
  hasSearched: boolean
  id: string | undefined
  locationAlert: LocationAlert | null
  popData: PopData
  positions: Position[]
  showComplianceBadge: boolean
  toDate: string
  currentUrl?: string
  mapControls: LocationMapControls
  isMapLoading?: boolean
}

export interface LocationApiResponse {
  locations: Position[]
  total: number
  fromDate?: string
  toDate?: string
}

export interface DateFilters {
  from?: string
  to?: string
}

export interface LocationMapControls {
  baseLayer: 'street' | 'satellite'
  tracks: boolean
  confidence: boolean
  numbers: boolean
  exclusion: boolean
}

// ============================================================================
// Default Builders (Private)
// ============================================================================

const defaultDateTimeValue = (): DateTimeValue => ({
  date: '',
  hour: '',
  minute: '',
})

const defaultPopData = (): PopData => ({
  crn: 'X172591',
  dateOfBirth: '1964-10-07',
})

const defaultMapControls = (): LocationMapControls => ({
  baseLayer: 'street',
  tracks: true,
  confidence: true,
  numbers: true,
  exclusion: false,
})

const defaultDateFilterForm = (): DateFilterForm => ({
  action: '/cases/undefined/location-activity',
  crn: '',
  errorSummary: [],
  errors: [],
  values: {
    fromDate: defaultDateTimeValue(),
    toDate: defaultDateTimeValue(),
  },
})

// ============================================================================
// Position Factories
// ============================================================================

/**
 * Build a single position with sensible defaults
 */
export const buildPosition = (overrides: Partial<Position> = {}): Position => {
  const defaults: Position = {
    positionId: 1,
    latitude: 51.5074,
    longitude: -0.1278,
    precision: 10,
    speed: 0,
    direction: 0,
    timestamp: '2026-01-12T10:00:00.000Z',
    geolocationMechanism: 'GPS',
    sequenceNumber: 1,
  }

  return { ...defaults, ...overrides }
}

/**
 * Build multiple positions with incremental timestamps
 */
export const buildPositions = (count: number, baseOverrides: Partial<Position> = {}): Position[] => {
  return Array.from({ length: count }, (_, index) => {
    const baseTime = new Date('2026-01-12T10:00:00.000Z')
    baseTime.setMinutes(baseTime.getMinutes() + index * 5)

    return buildPosition({
      positionId: index + 1,
      timestamp: baseTime.toISOString(),
      sequenceNumber: index + 1,
      latitude: 51.5074 + index * 0.001,
      longitude: -0.1278 + index * 0.001,
      ...baseOverrides,
    })
  })
}

/**
 * Build a GPS trail (positions close together)
 */
export const buildGpsTrail = (
  startLat: number = 51.5074,
  startLng: number = -0.1278,
  points: number = 10,
): Position[] => {
  return buildPositions(points, {
    geolocationMechanism: 'GPS',
    precision: 5,
  }).map((pos, idx) => ({
    ...pos,
    latitude: startLat + idx * 0.0001,
    longitude: startLng + idx * 0.0001,
  }))
}

// ============================================================================
// Date Filter Form Factories
// ============================================================================

/**
 * Build date filter form with defaults
 */
export const buildDateFilterForm = (overrides: Partial<DateFilterForm> = {}): DateFilterForm => {
  const defaults = defaultDateFilterForm()

  return {
    ...defaults,
    ...overrides,
    values: {
      ...defaults.values,
      ...(overrides.values || {}),
      fromDate: {
        ...defaults.values.fromDate,
        ...(overrides.values?.fromDate || {}),
      },
      toDate: {
        ...defaults.values.toDate,
        ...(overrides.values?.toDate || {}),
      },
    },
  }
}

/**
 * Build date filter form with pre-filled dates
 */
export const buildDateFilterFormWithDates = (
  fromDate: string = '12/01/2026',
  toDate: string = '14/01/2026',
  crn: string = '1',
): DateFilterForm => {
  return buildDateFilterForm({
    crn,
    values: {
      fromDate: {
        date: fromDate,
        hour: '10',
        minute: '00',
        second: '00',
      },
      toDate: {
        date: toDate,
        hour: '11',
        minute: '00',
        second: '00',
      },
    },
  })
}

/**
 * Build date filter form with validation errors
 */
export const buildDateFilterFormWithErrors = (errors: ValidationError[], crn: string = '1'): DateFilterForm => {
  return buildDateFilterForm({
    crn,
    errorSummary: errors.map(err => ({
      text: err.message,
    })),
    errors,
    values: {
      fromDate: {
        date: '12/01/2026',
        hour: '10',
        minute: '00',
        second: '00',
      },
      toDate: {
        date: '14/01/2026',
        hour: '11',
        minute: '00',
        second: '00',
      },
    },
  })
}

// ============================================================================
// Location Page Render Data Factories (Unit Tests)
// ============================================================================

/**
 * Build complete location page render data with defaults
 * Primary factory for unit tests
 */
export const buildLocationPageRenderData = (
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  const defaults: LocationPageRenderData = {
    activeNav: 'cases',
    activeTab: 'location-activity',
    alert: true,
    dateFilterForm: defaultDateFilterForm(),
    fromDate: '',
    hasSearched: false,
    id: undefined,
    locationAlert: null,
    popData: defaultPopData(),
    positions: [],
    showComplianceBadge: true,
    toDate: '',
    mapControls: defaultMapControls(),
  }

  return {
    ...defaults,
    ...overrides,
    dateFilterForm: {
      ...defaults.dateFilterForm,
      ...(overrides.dateFilterForm || {}),
      values: {
        ...defaults.dateFilterForm.values,
        ...(overrides.dateFilterForm?.values || {}),
        fromDate: {
          ...defaults.dateFilterForm.values.fromDate,
          ...(overrides.dateFilterForm?.values?.fromDate || {}),
        },
        toDate: {
          ...defaults.dateFilterForm.values.toDate,
          ...(overrides.dateFilterForm?.values?.toDate || {}),
        },
      },
    },
    popData: {
      ...defaults.popData,
      ...(overrides.popData || {}),
    },
  }
}

/**
 * Build initial page state (no search performed)
 * Use for testing initial page load
 */
export const buildLocationPageInitialState = (
  crn: string = '',
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  return buildLocationPageRenderData({
    hasSearched: false,
    fromDate: '',
    toDate: '',
    positions: [],
    locationAlert: null,
    isMapLoading: false,
    dateFilterForm: buildDateFilterForm({
      crn,
      ...(overrides.dateFilterForm || {}),
    }),
    ...overrides,
  })
}

/**
 * Build page with validation errors
 * Use for testing form validation failure scenarios
 */
export const buildLocationPageWithValidationErrors = (
  errors: ValidationError[],
  crn: string = '1',
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  return buildLocationPageRenderData({
    dateFilterForm: buildDateFilterFormWithErrors(errors, crn),
    hasSearched: true,
    fromDate: '2026-01-12T10:00:00.000Z',
    toDate: '2026-01-14T11:00:00.000Z',
    positions: [],
    isMapLoading: false,
    locationAlert: {
      text: 'No location data found for the selected date range.',
    },
    ...overrides,
  })
}

/**
 * Build page with successful search results
 * Use for testing successful location searches
 */
export const buildLocationPageWithPositions = (
  positions: Position[],
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  return buildLocationPageRenderData({
    dateFilterForm: buildDateFilterFormWithDates('12/01/2026', '14/01/2026', '1'),
    hasSearched: true,
    fromDate: '2026-01-12T10:00:00.000Z',
    toDate: '2026-01-14T11:00:00.000Z',
    positions,
    locationAlert:
      positions.length === 0
        ? {
            text: 'No location data found for the selected date range.',
          }
        : null,
    ...overrides,
  })
}

/**
 * Build page with no results (empty search)
 * Use for testing empty search results
 */
export const buildLocationPageWithNoResults = (
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  return buildLocationPageWithPositions([], {
    ...overrides,
    locationAlert: {
      text: 'No location data found for the selected date range.',
    },
  })
}

/**
 * Build page with service error (e.g. API failure)
 * Use for testing error handling when location data cannot be fetched
 */
export const buildLocationPageWithServiceError = (
  crn: string,
  fromDate: string = '12/01/2026',
  toDate: string = '14/01/2026',
  overrides: Partial<LocationPageRenderData> = {},
): LocationPageRenderData => {
  return buildLocationPageRenderData({
    dateFilterForm: buildDateFilterFormWithDates(fromDate, toDate, crn),
    hasSearched: true,
    positions: [],
    fromDate: '2026-01-12T10:00:00.000Z',
    toDate: '2026-01-14T11:00:00.000Z',
    locationAlert: {
      text: 'Unable to fetch location data. Please try again later.',
    },
    isMapLoading: false,
    currentUrl: encodeURIComponent(`/cases/${crn}/location?fromDate=${fromDate}&toDate=${toDate}`),
    ...overrides,
  })
}

// ============================================================================
// API Response Factories
// ============================================================================

/**
 * Build API response for location search
 * Use for mocking API calls in E2E tests
 */
export const buildLocationApiResponse = (positions: Position[], filters?: DateFilters): LocationApiResponse => {
  return {
    locations: positions,
    total: positions.length,
    fromDate: filters?.from,
    toDate: filters?.to,
  }
}

/**
 * Build successful API response with positions
 */
export const buildSuccessfulApiResponse = (count: number = 5, filters?: DateFilters): LocationApiResponse => {
  return buildLocationApiResponse(buildPositions(count), filters)
}

/**
 * Build empty API response (no results)
 */
export const buildEmptyApiResponse = (filters?: DateFilters): LocationApiResponse => {
  return buildLocationApiResponse([], filters)
}

// ============================================================================
// PopData Factories
// ============================================================================

/**
 * Build person-on-probation data
 */
export const buildPopData = (overrides: Partial<PopData> = {}): PopData => {
  return {
    ...defaultPopData(),
    ...overrides,
  }
}

// ============================================================================
// Preset Scenarios (Common Test Cases)
// ============================================================================

/**
 * Complete scenario: Initial page load
 */
export const scenarios = {
  initialLoad: (crn: string = 'X123456') => buildLocationPageInitialState(crn),

  /**
   * Complete scenario: Validation error - missing dates
   */
  validationError_missingDates: () =>
    buildLocationPageWithValidationErrors([
      { field: 'fromDate', message: 'Start date is required' },
      { field: 'toDate', message: 'End date is required' },
    ]),

  /**
   * Complete scenario: Validation error - invalid date format
   */
  validationError_invalidFormat: () =>
    buildLocationPageWithValidationErrors([{ field: 'fromDate', message: 'Invalid date format' }]),

  /**
   * Complete scenario: Validation error - date range too large
   */
  validationError_rangeTooLarge: () =>
    buildLocationPageWithValidationErrors([{ field: 'toDate', message: 'Date range cannot exceed 90 days' }]),

  /**
   * Complete scenario: Successful search with results
   */
  successfulSearch_withResults: (positionCount: number = 10) =>
    buildLocationPageWithPositions(buildPositions(positionCount)),

  /**
   * Complete scenario: Successful search with no results
   */
  successfulSearch_noResults: () => buildLocationPageWithNoResults(),

  /**
   * Complete scenario: GPS trail visualization
   */
  gpsTrail: (points: number = 20) => buildLocationPageWithPositions(buildGpsTrail(51.5074, -0.1278, points)),
}

export default {
  buildPosition,
  buildPositions,
  buildGpsTrail,
  buildDateFilterForm,
  buildDateFilterFormWithDates,
  buildDateFilterFormWithErrors,
  buildLocationPageRenderData,
  buildLocationPageInitialState,
  buildLocationPageWithValidationErrors,
  buildLocationPageWithPositions,
  buildLocationPageWithNoResults,
  buildLocationApiResponse,
  buildSuccessfulApiResponse,
  buildEmptyApiResponse,
  buildPopData,
  scenarios,
}
