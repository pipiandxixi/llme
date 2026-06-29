import { Hono } from 'hono'
import { cors } from 'hono/cors'
import profilesRoute from './routes/profiles'
import profileDataRoute from './routes/profile-data'
import chatRoute from './routes/chat'
import diagnosticsRoute from './routes/diagnostics'

const app = new Hono()

app.use('*', cors({ origin: '*' }))
app.route('/profiles', profilesRoute)
app.route('/profile', profileDataRoute)
app.route('/chat', chatRoute)
app.route('/diagnostics', diagnosticsRoute)
app.get('/health', (c) => c.json({ ok: true }))

export default app
