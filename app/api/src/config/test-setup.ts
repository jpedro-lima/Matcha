import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Vitest não puxa o `.env` da raiz automaticamente — diferente do `npm run dev`
// que usa `tsx --env-file=…`. Carregamos manualmente via API nativa do Node
// (≥ 20.12) para que `src/config/env.ts` enxergue as variáveis na hora do
// import.
const here = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(here, '../../../../.env')
process.loadEnvFile(envPath)
