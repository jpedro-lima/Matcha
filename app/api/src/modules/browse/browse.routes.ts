import { Router } from 'express'
import { requireAuth } from '../../middlewares/require-auth.js'
import { validate } from '../../middlewares/validate.js'
import { getBrowse, getSearch } from './browse.handlers.js'
import { browseQuerySchema, searchQuerySchema } from './browse.schemas.js'

// /browse — feed passivo (todos os filtros são opcionais; default LIMIT 10).
export const browseRoutes = Router()
browseRoutes.get('/', requireAuth, validate({ query: browseQuerySchema }), getBrowse)

// /search — mesma engine; exige >= 1 critério (refine no schema).
export const searchRoutes = Router()
searchRoutes.get('/', requireAuth, validate({ query: searchQuerySchema }), getSearch)
