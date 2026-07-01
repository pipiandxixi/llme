export { default } from './_shared'

// Vercel's Node.js functions pre-parse JSON request bodies into req.body by
// default. Hono's c.req.json() expects to read the raw request stream itself
// (via @hono/node-server's adapter), so with the default parser left on, any
// PUT/POST route through this catch-all hangs forever trying to read a
// stream Vercel already drained — it never errors, just sits until Vercel's
// own function timeout kills it. Disabling the built-in parser here lets
// Hono read the raw body as it expects.
export const config = {
  api: {
    bodyParser: false,
  },
}
