import { Hono } from 'hono'
import { handle } from '@hono/node-server/vercel'
import app from '../app/server/src/app'

const apiApp = new Hono()
apiApp.route('/api', app)

export default handle(apiApp)
