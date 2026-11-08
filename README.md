# Restroom 911

Mobile-first prototype for finding a usable restroom quickly. It was previously called Restroom Pronto. The name, colors, and planned price live in [`src/config/brand.ts`](src/config/brand.ts).

The app runs in **demo mode with no API keys**. Pilot cities are Mayfield, Paducah, Benton, Murray, and Grand Rivers, Kentucky, in the `America/Chicago` time zone. Every packaged place is **fictional**. Do not use the sample pins for real emergency navigation.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123 on your computer. On a phone on the same Wi-Fi, use your computer’s LAN address and port `43123`.

Optional local admin API (still no paid services):

```bash
cp .env.example .env
# set ADMIN_PASSWORD to something other than "change-me"
npm run dev:api
```

Leave `VITE_DATA_SOURCE=demo` unless you want the UI to start against that API. You can also switch to “Local server sandbox” on the Admin screen after the API is running. Vite proxies `/api` to `http://127.0.0.1:43124`.

## Try this first

1. Leave tester access on **Paid (simulated)**. No card is collected.
2. Tap **Mayfield**, then **Paducah**. On Paducah, switch between **Fastest suitable** and **Highest rated**.
3. Tap **RESTROOM NOW** and allow location, or deny it and pick a city.
4. Open a result. Check Unknown fields, sample ratings, and that hours open does not say the room is free.
5. **Report a problem**, then open **Admin**, turn on **demo admin**, and approve it. The verified hours stay as written. Ranking changes only after approval.
6. Open **Sample QR codes** and scan `Mayfield Welcome Kiosk` or `Campus Commons` with your phone. QR pages work on the free plan with no account.
7. Switch tester access to **Free** and try RESTROOM NOW. Location search explains the planned $5/month gate. QR directions stay available.
8. On a directions page, tap **Finished visit** to see the dismissible demonstration offer.

## Install on Android

1. Open the site in Chrome.
2. Use the browser menu and choose **Install app** or **Add to Home screen**.
3. The installed app uses the same demo data. It is a PWA, not a native store app.

A production build includes a service worker. `npm run dev` does not, so install and offline checks should use `npm run build && npm run preview` (port **43130**).

## Data and persistence

| Data | Where it lives |
| --- | --- |
| Packaged fictional places, sample ratings, sample reports | In the app bundle. Same on every device. |
| Your reports, ratings, edits, tester plan, accessibility preferences | This browser only (IndexedDB, or localStorage if IndexedDB is unavailable). |
| Server sandbox | `data/server-sandbox.json` on the machine running `npm run dev:api`. Not committed. |

Demo data and server sandbox data are merged on top of the seed. Reset clears the sandbox overlay, not the seed file. One unreviewed report never overwrites a verified field. Approving a report can change ranking and shows a warning. It still does not rewrite the stored hours, access, or accessibility fields. An admin edit does that, and it records a review note.

The active search is kept in `sessionStorage` so refresh works. It is replaced, not appended, and precise GPS fixes are not written to `localStorage`.

## Ranking

`src/domain/ranking.ts` is a pure function. It weighs route minutes **only when a routing provider returned them**, otherwise straight-line distance (labeled approximate, with no invented travel time), known parking/entrance/indoor estimates, hours in the place’s time zone, access limits, required accessibility (hard filter), freshness, and approved lock/closure reports. Unknown stays unknown. Required features are never silently replaced.

## Optional routing

Straight-line is the default. To ask a routing server for travel time:

```bash
VITE_ROUTING_PROVIDER=osrm VITE_OSRM_BASE_URL=https://router.project-osrm.org npm run dev
```

The results screen explains that this sends the search location and restroom coordinates to that server, and it waits for a tap before sending. If the server fails, distances stay approximate and no travel time is shown.

Map tiles, when the map loads, come from OpenStreetMap. The tile server sees your IP address and the map area. The results list does not depend on the map. This prototype has no analytics.

External **Get directions** links open `geo:`, Google Maps, or Apple Maps. Fictional pins require a confirmation first. The app does not claim the fastest route or indoor GPS. Indoor text is written from a chosen entrance or QR sign.

## Admin password

The browser demo admin is a device sandbox. It is labeled as such and is not authentication.

The API checks `ADMIN_PASSWORD` with a timing-safe compare and an httpOnly cookie. `change-me` and a blank password are refused. Public report posts are validated and rate-limited even when admin login is off. Health check: `GET /api/health`.

## Tests

```bash
npm test
npm run test:e2e
npm run build && npx playwright test --config=playwright.pwa.config.ts
```

Unit tests cover ranking, hours and `America/Chicago` (including overnight windows and daylight time), moderation, validation, seed scenarios, the demo store, and server authorization. End-to-end tests use Playwright with a mocked location. The production check confirms the service worker takes control and that a city search still works after the browser goes offline. A full offline reload of the document was not reliable in headless Chrome (`ERR_INTERNET_DISCONNECTED`), so that step is not part of the passing test.

## Deploy for free

This repo is not deployed from here. After you create a Git repository and push `main`:

**Cloudflare Pages**

1. Connect the repository.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Leave the env vars empty for demo mode.

**GitHub Pages**

`.github/workflows/pages.yml` builds with `VITE_BASE=/restroom-911/` and `VITE_DATA_SOURCE=demo`, copies `index.html` to `404.html` so client routes survive a refresh, and deploys with GitHub Actions. That base path is what the manifest, service worker scope, and asset URLs need for `https://heartlandprogutters-dot.github.io/restroom-911/`.

The workflow has not been run from this environment. GitHub CLI is not signed in here, so the public repository was not created and Pages was not published.

After you authenticate and create the public repo `heartlandprogutters-dot/restroom-911`:

1. Push `main`.
2. In the repo settings, set Pages to **GitHub Actions** (not the branch publisher).
3. Open the Actions run for “Deploy GitHub Pages”.

The admin API does not run on static hosting. Demo admin stays on the device. Host `server/index.ts` yourself only if you want the password-protected sandbox. No secrets belong in this repo.

## What is real, simulated, or missing

| Piece | Status |
| --- | --- |
| Urgent search, ranking, hours, reports, ratings, QR text, PWA shell | Implemented and runnable in demo mode |
| Places, hours, ratings, reviews, coordinates | Fictional sample data |
| $5/month plan | A tester switch only. No payment and no card form |
| Admin on the public demo | This browser only |
| Admin API | Local server, real password check, not hosted |
| Travel time | Shown only after a configured routing server responds |
| Map | Leaflet + OpenStreetMap. The list still renders if the map fails |
| Occupancy, photos, native apps, medical questions, business billing, live ads | Not built |

See `.env.example` for every setting.
