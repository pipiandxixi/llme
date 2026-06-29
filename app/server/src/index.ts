import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import profilesRoute from './routes/profiles'
import chatRoute from './routes/chat'
import { PORT } from './config'

const app = new Hono()

app.use('*', cors({ origin: '*' }))
app.route('/api/profiles', profilesRoute)
app.route('/api/chat', chatRoute)

app.get('/health', (c) => c.json({ ok: true }))

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
