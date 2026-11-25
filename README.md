# rainyforest-web

Woorim Shin's personal site: what I have worked on, shown on one timeline, with a
visual explanation and a structured write-up for each piece of work.

The name is mine, translated. 우림 is written 雨林: rain, forest.

**Status:** being rebuilt on the `rebuild/astro` branch. `main` still holds the earlier
Next.js version. Nothing is deployed yet.

## What is on the site

| Path | What it is |
|---|---|
| `/` | A rainforest drawn in dots, then the experience timeline: one dot per month, one branch per kind of work |
| `/about` | Why the site is called Rainyforest, told in seven scroll scenes |
| `/work` | Every experience in one list |
| `/work/[slug]` | The write-up. Every experience answers the same eight questions: Decision, Before, Ontology, Smallest version, Trade-offs, What broke, Measured, Next |
| `/work/[slug]/story` | A visual explanation, for the experiences that have one |
| `/cv`, `/blog` | CV built from `content/resume.json`; older posts |
| `/ko/…` | Korean version of every path. English is the default |

Clicking an experience opens its visual explanation if it has one, and its write-up
otherwise. Each of the two links to the other.

Study notes, principles and a keynote gallery are designed but not built yet.

## Design

- One dot grid draws everything: trees, rain, the snake, the timeline. No image files,
  no gradients, no glow.
- Dark ground, a few greens, one yellow. Yellow is for the snake and the work that matters most.
- The page scrolls natively. Pictures follow the scroll; nothing takes it over.
- Reading pages keep the forest at the sides and leave the text column clear.
- Motion stops under `prefers-reduced-motion`.

The full design, with the reasons, is in
[`docs/superpowers/specs/2026-11-21-site-rebuild-design.md`](docs/superpowers/specs/2026-11-21-site-rebuild-design.md) (Korean).

### Mock pages

The look was worked out in throwaway HTML before any of it goes into Astro.
Open [`docs/design/concept-spike/index.html`](docs/design/concept-spike/index.html) in a browser.

```bash
cd docs/design/concept-spike
node build-pages.mjs                # the Work list and the write-ups, from one template
node energy-bench/build-story.mjs   # the visual explanation of the energy cost model
node tesla-jr/build-story.mjs       # the visual explanation of Tesla Jr.
node check-links.mjs                # every internal link in the mock pages
node publish.mjs --push             # put the mock online (gh-pages). Study is published only if a password is set, and then only encrypted
```

## Develop

```bash
npm ci
npm run dev       # http://localhost:4321
npm run verify    # everything CI runs: token check, tests, build, link check, type check
```

To try the production setup locally (same URL handling, 404 page and headers as the live site):

```bash
npm run build && npm run preview   # http://localhost:8787
```

## Where things are

| Path | What it holds |
|---|---|
| `content/` | The site's content: `resume.json`, project pages, older posts |
| `src/pages/`, `src/pages/ko/` | Thin route files, one per URL |
| `src/views/` | The page bodies. They take a `locale` and are shared by both languages |
| `src/styles/tokens.css` | Every colour and size. `npm run check:tokens` fails if one appears anywhere else |
| `src/i18n/` | UI strings and path helpers for English and Korean |
| `scripts/` | The checks `npm run verify` runs |
| `docs/superpowers/` | The design and the staged build plans |
| `docs/learning/` | Notes written while building, one per concept |

## Rules for content

- No grades anywhere on the site or in the repo.
- Work done at a company is described by its structure and by figures that have been
  checked. No company code, data, lecture text or internal screens.
- Text written with AI and not yet reviewed carries a `[Draft]` tag.

## How it ships

- The site is a static Astro build (`dist/`) served by Cloudflare Workers static assets
  (`wrangler.jsonc`). No Worker code runs, so requests are free and unmetered.
- The `deploy` workflow is switched off until the first deploy. Once enabled, a push to
  `main` verifies, builds, runs `wrangler deploy` and then `scripts/smoke.sh` against the live site.
- Until a domain is bought the site will live at `https://rainyforest-web.<account>.workers.dev`.
- Pull requests are merged with a merge commit, not squashed.

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
