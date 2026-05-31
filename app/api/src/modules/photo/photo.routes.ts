import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { validate } from '../../middlewares/validate.js'
import {
	deletePhotoHandler,
	getPhotos,
	postConfirm,
	postPresign,
} from './photo.handlers.js'
import { photoIdParamsSchema, presignBodySchema } from './photo.schemas.js'

export const photoRoutes = Router()

photoRoutes.get('/', requireAuth, getPhotos)
photoRoutes.post(
	'/presign',
	requireAuth,
	validate({ body: presignBodySchema }),
	postPresign,
)
photoRoutes.post(
	'/:id/confirm',
	requireAuth,
	validate({ params: photoIdParamsSchema }),
	postConfirm,
)
photoRoutes.delete(
	'/:id',
	requireAuth,
	validate({ params: photoIdParamsSchema }),
	deletePhotoHandler,
)
