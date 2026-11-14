# jeremytondo.com

Astro static site. The resume at `/resume/` and its PDF are both generated from
[`resume.md`](resume.md) on every build.

```
dist/
  index.html                       ← placeholder card: name, resume, LinkedIn
  resume/index.html
  resume/jeremytondo-resume.pdf   ← stable URL; never rename
```

## Editing the resume

Edit `resume.md` and push to `main`. Keep it plain markdown, with no front matter or custom
syntax. Layout comes from heading position, so headings can be reworded freely:

| Markdown | Rendered as |
| --- | --- |
| `#` (1st) + bold line + `a \| b \| c` line + paragraph | Masthead: name, tagline, contact column, summary |
| 1st `##` with `###` children | Tinted 2×2 "What I Do" panel |
| 2nd `##` with `- **Org** - Role; Role (dates)` items | Org / roles / dates grid |
| 3rd `##` with `### Org (dates)` → `**Role**` → bullets | Experience entries; starts page 2 in print |
| Any further `##` | Default stacked section |

Lines that don't match a pattern render as plain text; the build never fails on content.
Positions are mapped in `src/site.config.ts` (`sectionLayouts`), alongside the page title,
meta description, LinkedIn URL and PDF filename.

## How it works

- `src/lib/rehype-sectionize.ts` wraps each heading and its content in nested `<section>`s
  and assigns layouts by heading position.
- `src/lib/rehype-resume.ts` splits existing patterns (`(dates)`, `Org - Role`, `a | b`) into
  elements the CSS can place.
- `src/styles/resume.css` is the port of the **D3** design (Resume Template canvas), including
  `@page` / print rules for Letter paper.
- `scripts/build-pdf.mjs` runs after `astro build`: it serves `dist/`, prints `/resume/` with
  headless Chromium (Playwright) and writes the PDF. The text stays selectable for ATS
  parsing. It warns if the PDF runs past 2 pages.

## Commands

Uses Node 26 (`.node-version`). `npm install` also downloads Chromium for the PDF step.

```sh
npm install
npm run dev        # http://localhost:4321 (no PDF in dev)
npm run build      # site and PDF into dist/
npm run preview    # serve dist/ the way Cloudflare does, headers included (run build first)
npm test           # tests and type-check
```

`dev` and `preview` only listen on localhost. To open them from a phone or laptop on the
tailnet, publish the port with Tailscale once (it stays on until you turn it off):

```sh
tailscale serve --bg --https=8443 http://localhost:4321   # https://<machine>.<tailnet>.ts.net:8443
tailscale serve --https=8443 off                          # to stop
```

## Deploy: Cloudflare Workers

The site deploys as a static-assets Worker (no Worker code). [`wrangler.jsonc`](wrangler.jsonc)
points Cloudflare at `dist/`, and `public/_headers` sets the security headers.

GitHub Actions builds and deploys it ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
Cloudflare's own Workers Builds can't run the PDF step: its image lacks Chromium's system
libraries and has no root to install them.

- **Pull requests:** `npm test` and `npm run build`. The resume PDF is uploaded as the
  `resume-pdf` artifact on the run's summary page (kept 14 days) so you can check it before
  merging. `wrangler versions upload` then uploads a preview version that serves no production
  traffic, and a PR comment (updated on each push) links to it:
  - a branch URL, `<branch>-jeremytondo-com.<subdomain>.workers.dev`, that always serves the
    branch's latest push;
  - a URL for that one commit.

  PRs from forks skip the preview, since they don't get the repo secrets.
- **Push to `main`:** the same, then `npx wrangler deploy` publishes `dist/`. To redeploy
  without a commit, run the workflow by hand on `main` (Actions → CI → Run workflow).

The workflow uses Node from `.node-version` and caches npm and Playwright's Chromium. On a cache
hit the `postinstall` download does nothing, and `npx playwright install --with-deps chromium`
only adds the system libraries.

One-time setup:

- Repo secrets `CLOUDFLARE_API_TOKEN` (an API token with **Account → Workers Scripts → Edit**)
  and `CLOUDFLARE_ACCOUNT_ID`.
- The Worker's name in Cloudflare must match `name` in `wrangler.jsonc` (`jeremytondo-com`).
- `wrangler.jsonc` sets the Worker's `workers.dev` URLs, and each deploy from `main` applies
  them: `"preview_urls": true` turns on preview URLs, and `"workers_dev": false` keeps the
  production `jeremytondo-com.<subdomain>.workers.dev` URL off, so the site is served only on
  its own domain. Until the first deploy, the toggles on the Worker's **Domains** tab decide.
- Workers Builds must stay disconnected (Worker → **Settings → Build → Git repository →
  Disconnect**), or Cloudflare runs its own failing build alongside this one.

The custom domain `jeremytondo.com` is attached on the Worker's **Domains** tab (Add Domain), not
in `wrangler.jsonc`, so deploys leave it alone and the API token needs no zone permissions. Add
`www.jeremytondo.com` the same way if wanted.
