import { dataAccess } from '../data'
import AuditService from './auditService'
import CaseLocationActivityService from './caseLocationActivityService'
import DateSearchValidationService from './dateSearchValidationService'
import EmdiService from './emdiService'
import FlagService from './flagService'
import LocationsService from './locationsService'
import PeopleExclusionService from './peopleExclusionService'
import PeopleService from './peopleService'
import TrailService from './trailService'

export const services = () => {
  const {
    applicationInfo,
    hmppsAuditClient,
    emdiApiClient,
    locationsApiClient,
    peopleApiClient,
    peopleExclusionApiClient,
  } = dataAccess()

  const auditService = new AuditService(hmppsAuditClient)
  const emdiService = new EmdiService(emdiApiClient)
  const locationsService = new LocationsService(locationsApiClient)
  const caseLocationActivityService = new CaseLocationActivityService(locationsService)
  const peopleService = new PeopleService(peopleApiClient)
  const trailService = new TrailService()
  const dateSearchValidationService = new DateSearchValidationService()
  const flagService = new FlagService()
  const peopleExclusionService = new PeopleExclusionService(peopleExclusionApiClient)

  return {
    applicationInfo,
    auditService,
    caseLocationActivityService,
    emdiService,
    locationsService,
    peopleService,
    trailService,
    dateSearchValidationService,
    flagService,
    peopleExclusionService,
  }
}

export type Services = ReturnType<typeof services>
