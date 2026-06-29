import { serve } from '@hono/node-server'
import { PORT } from './config'
import app from './app'

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
