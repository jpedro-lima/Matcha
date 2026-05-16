// Rota stub usada exclusivamente no checkpoint da Fase 3 para exercitar o
// `validate` middleware e o errorHandler. Remover ao iniciar a Fase 4.
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middlewares/validate.js'

export const testRouter = Router()

const echoSchema = z.object({
	name: z.string().min(1),
	age: z.coerce.number().int().nonnegative(),
})

testRouter.post('/_test/validate', validate({ body: echoSchema }), (req, res) => {
	res.json({ ok: true, received: req.body })
})
