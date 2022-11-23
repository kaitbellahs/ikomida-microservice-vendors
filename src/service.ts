import express from 'express'
import bodyParser from 'body-parser'
import Settings from './controllers/Settings.js'
import Layout from './controllers/Layout.js'
import Staff from './controllers/Staff.js'
import App from './controllers/App.js'
import { Utils } from '@ikomida/shared-backend'

import { createRequire } from 'module'
import { Types } from '@ikomida/shared-backend'
const require = createRequire(import.meta.url)
let { name } = require('../package.json')
name = name
  .replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
  .replace(/^\w/, (m: string) => m.toUpperCase())
  .replace(/-\w/g, (m: string[]) => m[1].toUpperCase())
const logger = Utils.Logger.getInstance(name)

const app = express()
app.disable('x-powered-by')
app.use(bodyParser.json({ limit: '10mb' }))
Utils.System.setExpressResponse(app)
const port = process?.env?.PORT || 80

const settings = new Settings(logger)
const layout = new Layout(logger)
const staff = new Staff(logger)
const vendorApp = new App(logger)

app.get('/vendor/limits', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.getLimits(identity)
  res.sendResponse(payload)
})

app.get('/vendor/app', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await vendorApp.getApp(identity)
  res.sendResponse(payload)
})

app.patch('/vendor/app', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await vendorApp.updateApp(identity, req.body)
  res.sendResponse(payload)
})

app.get('/vendor/settings', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.getSettings(identity)
  res.sendResponse(payload)
})

app.put('/vendor/settings', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.updateProfile(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.get('/vendor/staff/:timestamp', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await staff.getStaff(identity, Number(req.params?.timestamp) ?? 0)
  res.sendResponse(payload)
})

app.post('/vendor/staff', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await staff.newStaff(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.delete('/vendor/staff/:id', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await staff.removeStaff(identity, req.params?.id)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.get('/layout', async (req, res) => {
  const payload = await layout.getLayout(String(req.headers?.['x-ikomida-id']))
  res.sendResponse(payload)
})

app.put('/layout', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await layout.setLayout(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.put('/vendor/updatePaymentGateway', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.integratePagseguroGateway(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.delete('/vendor/revokePaymentGateway', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.revokePagseguroGateway(identity)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.put('/vendor/businessHours', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.updateBusinessHours(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.put('/vendor/delivery', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.updateDelivery(identity, req.body)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.get('/vendor/pagSeguroUrl', async (req, res) => {
  const identity: Types.Classes.CUser = Types.Classes.CUser.fromObject(req.headers?.identity)
  const payload = await settings.getPagSeguroURL(identity)
  res.status(payload?.success ? 201 : 200).sendResponse(payload)
})

app.all('*', async (req, res) => {
  logger.error(`Vendor endpoint: "${req?.url}" not found:`)
  res.status(404).sendResponse({ error: 'NOT FOUND' })
})

app.listen(port, () => {
  logger.info(`${name} listening at http://localhost:${port}`)
})
