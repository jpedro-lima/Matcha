import { z } from 'zod'

export const genderSchema = z.enum(['m', 'f', 'nb', 'other'])
export const sexualOrientationSchema = z.enum(['hetero', 'homo', 'bi', 'other'])
