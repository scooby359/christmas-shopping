# Christmas Shopping 🎁

A mobile-first web app for tracking Christmas shopping: who you're buying for, gift ideas, what's bought and what it all cost. Your list is stored in the cloud, so it's the same on your phone and laptop.

## How it works

```
Browser ──► Cloudflare Access (sign-in) ──► Worker ─┬─► static React app (dist/client)
                                                     └─► /api/*  ──► D1 database
```

- **Sign-in** is handled entirely by [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/). Only the email addresses you allow can get in. The Worker reads the signed-in email with `ctx.access.getIdentity()`.
- **Each login has its own private list.** Every database row is keyed by the user's email, and every query is scoped to it.
- **Fails closed:** if a request didn't come through Access, the API returns 401. Switching Access off makes the API stop working; it never exposes data.
- Changes show on screen instantly and save in the background. If a save fails, the change is undone and a message is shown. The list refreshes when the app comes back into view, so edits from another device appear.
- Offline, the last loaded list stays visible and changes are paused.
- **Export / Import** (⋮ menu) saves or restores a JSON backup. Importing replaces your whole list.

## Project layout

```
src/            React app (pages, components, store.ts = client state + API calls)
worker/         Worker API (Hono): index.ts routes, db.ts queries, validate.ts input checks
shared/         Types shared by both
migrations/     D1 schema (SQL)
```

## Develop

```sh
npm install
npm run dev        # applies local DB migrations, then serves app + Worker + local D1
```

Locally you are signed in as `you@example.com` automatically. Change this in the `access.dev` block of `wrangler.jsonc`. That block only affects local development.

```sh
npm test           # API tests, run inside the Workers runtime (incl. user-isolation tests)
npm run typecheck  # app, worker and config
npm run build
```

After changing bindings in `wrangler.jsonc`, run `npm run cf-typegen` to regenerate `worker/worker-configuration.d.ts`.

## First-time deploy

1. **Create the database** and copy the `database_id` it prints into `wrangler.jsonc`:
   ```sh
   npx wrangler d1 create christmas-shopping
   ```
2. **Create the tables:**
   ```sh
   npm run db:migrate:remote
   ```
3. **Deploy:**
   ```sh
   npm run deploy
   ```
   Until steps 4–5 are done, the site loads but shows "Couldn't load your list", because the API refuses requests that haven't gone through sign-in.
4. **Create an Access policy** listing who may sign in: Cloudflare dashboard → **Zero Trust** → **Access controls** → **Policies** → **Add a policy**:
   - Name: `Christmas shopping users`, Action: **Allow**, Session duration: e.g. 1 month
   - Include → Selector **Emails** → add each allowed address
   - (First time using Zero Trust: you'll be asked to choose a team name and the Free plan, up to 50 users.)
   - ⚠️ Don't use the quick "Email domain" option with `gmail.com`, because that admits *every* Gmail user.
5. **Put the Worker behind Access**: Workers & Pages → **christmas-shopping** → **Access** tab → **Protect this Worker behind Access** → **All traffic** → Authentication policy: **Christmas shopping users** → **Apply Access**.
   - Sign-in uses a one-time code emailed to you by default. You can add Google etc. under Zero Trust → Settings → Authentication.
   - To add or remove people later, edit the policy's email list. No redeploy needed.
6. Open the site, sign in with an allowed email, and start adding people.

## Later deploys

```sh
npm run db:migrate:remote   # only if there are new files in migrations/
npm run deploy
```
