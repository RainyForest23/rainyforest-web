# rainyforest-web

Personal site: CV, portfolio and a blog published from an Obsidian vault.
Design and decisions: `docs/superpowers/specs/2026-09-19-personal-site-design.md`.

## Develop

```bash
npm ci
npm run dev       # http://localhost:3000
npm run verify    # everything CI runs
```

To try the production setup locally (same URL handling, 404 page and headers as the live site):

```bash
npm run build && npx wrangler dev   # http://localhost:8787
```

## How it ships

- The site is a static export (`out/`) served by Cloudflare Workers static assets
  (`wrangler.jsonc`). No Worker code runs, so requests are free and unmetered.
- `main` push → GitHub Actions verifies, builds, runs `wrangler deploy` and then
  `scripts/smoke.sh` against the live site.
- Until a domain is bought the site lives at `https://rainyforest-web.<account>.workers.dev`.

## Runbook

### First deploy (no domain needed)

1. Create a Cloudflare account. In **Workers & Pages**, pick a `workers.dev` subdomain.
2. Create an API token: **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** template.
3. In GitHub, **Settings → Secrets and variables → Actions**:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers & Pages overview).
   - Variable: `SITE_URL` = `https://rainyforest-web.<subdomain>.workers.dev`
4. Enable the workflow and run it once:
   ```bash
   gh workflow enable deploy.yml
   gh workflow run deploy.yml
   ```

### After buying the domain

1. Buy it in **Cloudflare Registrar**; DNS is then already on Cloudflare.
2. In `wrangler.jsonc`, uncomment `routes` and put in the domain (apex and `www`).
   `wrangler deploy` creates the DNS records and the certificate.
3. **Rules → Redirect Rules → "Redirect from WWW to root"** template (301, keep path and query).
4. Change the GitHub variable `SITE_URL` to `https://<domain>` and push.
   The smoke test then also checks the `www` redirect.

### Roll back

Open an earlier successful `deploy` run in Actions and choose "Re-run all jobs",
or `git revert` the bad commit and push. `npx wrangler rollback` restores the
previous version immediately without a build.
