import { Router } from 'express'
import { dbHealth, health } from './health.handlers.js'

export const healthRoutes = Router()

healthRoutes.get('/health', health)
healthRoutes.get('/db-health', dbHealth)
