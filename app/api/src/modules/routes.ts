import { Router } from 'express'
import { authRoutes } from './auth/auth.routes.js'
import { healthRoutes } from './health/health.routes.js'

export const routes = Router()

routes.use(healthRoutes)
routes.use('/auth', authRoutes)
