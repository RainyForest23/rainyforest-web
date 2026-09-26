/** The only source of absolute URLs. Set SITE_URL in the deploy build. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}
