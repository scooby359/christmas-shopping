# Christmas Shopping 🎁

A small mobile-first web app for tracking Christmas shopping: who you're buying for, gift ideas, what's bought and what it all cost.

- All data lives in the browser's **IndexedDB**: no accounts, no server.
- **Export / Import** (⋮ menu on the home screen) saves or restores everything as a JSON file. Use it to back up or move to another device. Importing **replaces** current data.
- Prices are in GBP and stored as whole pence.

## Develop

```sh
npm install
npm run dev              # http://localhost:5173
npm run dev -- --host    # also reachable from your phone on the same Wi-Fi
```

## Build

```sh
npm run build            # type-checks, then outputs static files to dist/
npm run preview          # serve the built site locally
```

## Deploy to Cloudflare

Option A: **Workers static assets** (config in `wrangler.jsonc`):

```sh
npx wrangler login       # first time only
npm run deploy           # build + wrangler deploy
```

Option B: **Cloudflare Pages via Git**: connect the repo in the dashboard with build command `npm run build` and output directory `dist`.

Routing uses the URL hash (`#/person/<id>`), so no SPA fallback rules are needed.

## Notes

- Data is per browser and per site address. Clearing site data, or using a different browser or device, means starting empty, so export now and then.
- The app asks the browser for persistent storage so data isn't evicted when the device is low on space.

## Structure

```
src/db.ts           Dexie schema, types, CRUD helpers, totals
src/backup.ts       JSON export / import
src/format.ts       £ formatting, price parsing, URL helpers
src/pages/          HomePage, PersonPage
src/components/     Sheet modal, forms, cards, checkbox, menu, toast…
src/index.css       All styling (design tokens, light and dark themes)
```
