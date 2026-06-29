import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { PORT } from './config'
import app from './app'

const localApp = new Hono()
localApp.route('/api', app)

serve({ fetch: localApp.fetch, port: PORT }, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
