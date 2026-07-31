import { type RequestHandler, Router } from 'express'
import type { Services } from '../services'
import PeopleController from '../controllers/people/peopleController'

export default function peopleRoutes(
  {
    auditService,
    caseLocationActivityService,
    dateSearchValidationService,
    peopleService,
    peopleExclusionService,
  }: Services,
  get: (path: string, handler: RequestHandler) => Router,
): void {
  const peopleController = new PeopleController(
    peopleService,
    auditService,
    caseLocationActivityService,
    dateSearchValidationService,
    peopleExclusionService,
  )

  get('/people/:delius_id', async (req, res) => {
    await peopleController.getPersonByDeliusId(req, res)
  })

  get('/people/:delius_id/locations', async (req, res) => {
    await peopleController.location(req, res)
  })
}
