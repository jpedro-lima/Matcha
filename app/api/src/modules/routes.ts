import { Router } from 'express'
import { authRoutes } from './auth/auth.routes.js'
import { healthRoutes } from './health/health.routes.js'
import { photoRoutes } from './photo/photo.routes.js'
import { tagRoutes, userTagRoutes } from './tag/tag.routes.js'
import { userRoutes } from './user/user.routes.js'

export const routes = Router()

routes.use(healthRoutes)
routes.use('/auth', authRoutes)

routes.use('/users/me/photos', photoRoutes)
routes.use('/users/me/tags', userTagRoutes)
routes.use('/users', userRoutes)

routes.use('/tags', tagRoutes)
