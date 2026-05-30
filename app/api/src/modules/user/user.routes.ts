import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { validate } from '../../middlewares/validate.js'
import { getMe, patchLocation, patchMe } from './user.handlers.js'
import { locationBodySchema, updateUserBodySchema } from './user.schemas.js'

export const userRoutes = Router()

userRoutes.get('/me', requireAuth, getMe)
userRoutes.patch('/me', requireAuth, validate({ body: updateUserBodySchema }), patchMe)
userRoutes.patch(
	'/me/location',
	requireAuth,
	validate({ body: locationBodySchema }),
	patchLocation,
)
