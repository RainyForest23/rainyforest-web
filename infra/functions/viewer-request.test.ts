import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const IMPORT_LINE = "import cf from 'cloudfront';"
const raw = readFileSync(new URL('./viewer-request.js', import.meta.url), 'utf8')
if (!raw.includes(IMPORT_LINE)) throw new Error(`viewer-request.js must start with: ${IMPORT_LINE}`)
const source = raw.replace(IMPORT_LINE, '')

type Handler = (event: unknown) => Promise<any>

function load(redirects: Record<string, string> = {}): { handler: Handler; lookups: string[] } {
  const lookups: string[] = []
  const cf = {
    kvs: () => ({
      get: async (key: string) => {
        lookups.push(key)
        if (!(key in redirects)) throw new Error(`key not found: ${key}`)
        return redirects[key]
      },
    }),
  }
  const handler = new Function('cf', `${source}\nreturn handler;`)(cf) as Handler
  return { handler, lookups }
}

function event(uri: string, host = 'example.dev') {
  return { request: { uri, headers: { host: { value: host } }, querystring: {} } }
}

describe('viewer-request', () => {
  it('serves index.html for the root', async () => {
    const { handler } = load()
    expect((await handler(event('/'))).uri).toBe('/index.html')
  })

  it('serves index.html for directory paths with a trailing slash', async () => {
    const { handler } = load()
    expect((await handler(event('/blog/foo/'))).uri).toBe('/blog/foo/index.html')
  })

  it('serves index.html for directory paths without a trailing slash', async () => {
    const { handler } = load()
    expect((await handler(event('/blog/foo'))).uri).toBe('/blog/foo/index.html')
  })

  it('passes asset paths through untouched and skips the KVS lookup', async () => {
    const { handler, lookups } = load({ '/_next/static/app.js': '/elsewhere' })
    expect((await handler(event('/_next/static/app.js'))).uri).toBe('/_next/static/app.js')
    expect(lookups).toEqual([])
  })

  it('redirects www to the apex domain, keeping the path', async () => {
    const { handler } = load()
    expect(await handler(event('/blog/', 'www.example.dev'))).toEqual({
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://example.dev/blog/' } },
    })
  })

  it('redirects paths found in the KVS map, with or without a trailing slash', async () => {
    const { handler, lookups } = load({ '/old-post': '/blog/new-post/' })
    for (const uri of ['/old-post', '/old-post/']) {
      const res = await handler(event(uri))
      expect(res.statusCode).toBe(301)
      expect(res.headers.location.value).toBe('/blog/new-post/')
    }
    expect(lookups).toEqual(['/old-post', '/old-post'])
  })
})
