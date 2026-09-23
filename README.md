# rainyforest-web

Personal site: CV, portfolio and a blog published from an Obsidian vault.
Design and decisions: `docs/superpowers/specs/2026-09-19-personal-site-design.md`.

## Develop

```bash
npm ci
npm run dev       # http://localhost:3000
npm run verify    # everything CI runs
```

## How it ships

- `main` push → GitHub Actions verifies, builds a static export, uploads it to S3,
  invalidates CloudFront and runs `scripts/smoke.sh` against the live domain.
- AWS access comes from an OIDC role limited to this repo's `main` branch.
  No long-lived AWS keys exist in GitHub.
- Infrastructure (`infra/`) is deployed by hand with `npx cdk deploy`. It changes rarely.

## Runbook

### DNS records (Cloudflare, all "DNS only")

| Name | Type | Target |
|---|---|---|
| apex | CNAME | CloudFront `DistributionDomainName` output |
| `www` | CNAME | same as apex. The redirect to apex happens in CloudFront. |
| `_<token>` (two records) | CNAME | ACM validation values |

**Never delete the ACM validation records.** ACM renews the certificate
through them; without them the site stops serving HTTPS when the certificate expires.

Keep the proxy (orange cloud) off: Cloudflare Redirect Rules and caching are not used,
and a second CDN layer would need its own cache purge on every deploy.

### Turn deploys back on

The `deploy` workflow is disabled until the domain exists, so pushes to `main`
only run `ci`. After the first `cdk deploy` and the GitHub variables are set:

```bash
gh workflow enable deploy.yml
```

### Deploy infrastructure

```bash
aws sso login
BUDGET_EMAIL=<your email> npx cdk deploy
```

### Roll back content

Open an earlier successful `deploy` run in Actions and choose "Re-run all jobs"
(it rebuilds that run's commit), or `git revert` the bad commit and push.
