import { Hono } from 'hono'
import { cors } from 'hono/cors'
import profilesRoute from './routes/profiles'
import chatRoute from './routes/chat'

const app = new Hono()

app.use('*', cors({ origin: '*' }))
app.route('/profiles', profilesRoute)
app.route('/chat', chatRoute)
app.get('/health', (c) => c.json({ ok: true }))

export default app
