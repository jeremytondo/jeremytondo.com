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

Connect the GitHub repo once (Workers & Pages → Create → Import a repository):

- Project name: `jeremytondo-com` (must match `name` in `wrangler.jsonc`)
- Build command: `npm run build` (Chromium arrives via `npm install`'s postinstall step)
- Deploy command: `npx wrangler deploy` (the default)
- Production branch: `main` (other branches get preview URLs)
- Node version comes from `.node-version`

Then add `jeremytondo.com` (and `www.jeremytondo.com` if wanted) under the Worker's
**Settings → Domains & Routes → Custom domain**. If the domain's DNS is already on Cloudflare, it
creates the records; otherwise point the domain's nameservers at Cloudflare first.
