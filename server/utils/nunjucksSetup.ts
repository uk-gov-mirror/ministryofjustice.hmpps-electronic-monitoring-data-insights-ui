/* eslint-disable no-param-reassign */
import path from 'path'
import nunjucks from 'nunjucks'
import express from 'express'
import fs from 'fs'
import { initialiseName } from './utils'
import config from '../config'
import logger from '../../logger'
import formatDate from './helpers'

const commonLocale = {
  en: {
    profileInfoHeader: {
      crnLabel: 'CRN',
      dateOfBirthLabel: 'Date of birth',
    },
  },
}

export default function nunjucksSetup(app: express.Express): void {
  app.set('view engine', 'njk')

  app.locals.asset_path = '/assets/'
  app.locals.applicationName = 'HMPPS Electronic Monitoring Data Insights Ui'
  app.locals.environmentName = config.environmentName
  app.locals.environmentNameColour = config.environmentName === 'PRE-PRODUCTION' ? 'govuk-tag--green' : ''
  app.locals.common = commonLocale.en
  app.locals.mpopUrl = config.mpopUrl
  app.locals.enableHeatmap = false
  app.locals.enablePingCardNavigation = false
  app.locals.enableExclusionZones = false

  let assetManifest: Record<string, string> = {}

  try {
    const assetMetadataPath = path.resolve(__dirname, '../../assets/manifest.json')
    assetManifest = JSON.parse(fs.readFileSync(assetMetadataPath, 'utf8'))
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e, 'Could not read asset manifest file')
    }
  }

  const njkEnv = nunjucks.configure(
    [
      path.join(__dirname, '../../server/views'),
      'node_modules/govuk-frontend/dist/',
      'node_modules/@ministryofjustice/frontend/',
      'node_modules/@ministryofjustice/hmpps-probation-frontend-components/dist/assets/',
      'node_modules/@ministryofjustice/hmpps-electronic-monitoring-components/dist/nunjucks/',
    ],
    {
      autoescape: true,
      express: app,
    },
  )

  njkEnv.addFilter('formatSimpleDate', date => formatDate(date, 'simple'))
  njkEnv.addFilter('initialiseName', initialiseName)
  njkEnv.addFilter('assetMap', (url: string) => assetManifest[url] || url)
}
