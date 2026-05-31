import { Router } from 'express'
import { authRoutes } from './auth/auth.routes.js'
import { healthRoutes } from './health/health.routes.js'
import { photoRoutes } from './photo/photo.routes.js'
import { userRoutes } from './user/user.routes.js'

export const routes = Router()

routes.use(healthRoutes)
routes.use('/auth', authRoutes)
// Mais específico antes do mais genérico: /users/me/photos precisa
// resolver no photoRoutes antes de cair em userRoutes.
routes.use('/users/me/photos', photoRoutes)
routes.use('/users', userRoutes)
