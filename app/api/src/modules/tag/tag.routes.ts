import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { validate } from '../../middlewares/validate.js'
import { getMyTags, getTagsAutocomplete, putMyTags } from './tag.handlers.js'
import { putTagsBodySchema, tagsQuerySchema } from './tag.schemas.js'

export const userTagRoutes = Router()
userTagRoutes.get('/', requireAuth, getMyTags)
userTagRoutes.put('/', requireAuth, validate({ body: putTagsBodySchema }), putMyTags)

export const tagRoutes = Router()
tagRoutes.get('/', requireAuth, validate({ query: tagsQuerySchema }), getTagsAutocomplete)
