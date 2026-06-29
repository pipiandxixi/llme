import { handle } from '@hono/node-server/vercel'
import app from '../../../../app/server/src/app'

export default handle(app)
