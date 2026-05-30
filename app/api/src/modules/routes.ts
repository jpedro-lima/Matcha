import { Router } from 'express'
import { authRoutes } from './auth/auth.routes.js'
import { healthRoutes } from './health/health.routes.js'
import { userRoutes } from './user/user.routes.js'

export const routes = Router()

routes.use(healthRoutes)
routes.use('/auth', authRoutes)
routes.use('/users', userRoutes)
