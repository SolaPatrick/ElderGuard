# ElderGuard frontend

The ElderGuard web console (Admin/Head and caregivers). It is built from the Figma hi-fi design and the ElderGuard design system. A mobile app (Expo / React Native) will be added next to it later and reuse the `shared` package.

## Quick start (Windows, macOS or Linux)

You need **Node.js 22.12 or newer** ([nodejs.org](https://nodejs.org), pick the LTS version). Check with `node -v`.

```bash
cd frontend
npm install          # first time only, takes a minute
npm run dev          # opens on http://localhost:5173
```

The app runs on a **fake API with sample data** until the backend is ready. Log in with:

| Username         | Role                         | Password        |
| ---------------- | ---------------------------- | --------------- |
| `teresa.reyes`   | Admin/Head                   | `elderguard123` |
| `joel.ramos`     | Caregiver (Rooms 101–103)    | `elderguard123` |
| `liza.fernandez` | Deactivated (shows an error) | `elderguard123` |

To demo a live alert, open the profile menu (top right) and choose **Simulate a fall (demo)**. The popup and alarm show within 5 seconds. Reloading the page resets the sample data.

## Connecting the real backend

1. Copy `web/.env.example` to `web/.env.local`.
2. Set `VITE_USE_MOCKS=false` and `API_PROXY_TARGET` to the backend address (for example `http://localhost:8000`).
3. Restart `npm run dev`.

The backend should follow [`docs/api-contract.md`](docs/api-contract.md). If a response doesn't match, the browser console shows exactly which field is different.

## Checking for bugs

| Command             | What it does                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`     | Everything below except end-to-end. Run it before every push.                                                                    |
| `npm run typecheck` | TypeScript in strict mode: catches wrong types and missing data                                                                  |
| `npm run lint`      | oxlint: catches common React mistakes                                                                                            |
| `npm test`          | Unit and screen tests (Vitest + Testing Library + fake API)                                                                      |
| `npm run e2e`       | Opens a real browser and clicks through the alert flow (Playwright). First time: `npx playwright install chromium` inside `web/` |
| `npm run format`    | Formats all files with Prettier                                                                                                  |

GitHub runs the same checks on every push and pull request (`.github/workflows/frontend.yml`).

## Project layout

```
frontend/
  shared/            Code for both web and (later) mobile
    tokens/          Design tokens exported from Figma (DTCG JSON). Replace these files to update colors.
    scripts/         build-tokens.mjs turns the token files into TypeScript (npm run tokens)
    src/schemas.ts   The API contract as zod schemas + TypeScript types
    src/format.ts    Time, label and name formatting (tested)
    src/fixtures/    Sample data from the mockups
  web/
    src/api/         API client (validates every response), endpoints, React Query hooks
    src/auth/        Login session, "remember me", role-based route guard
    src/layout/      Sidebar, top bar, red alert banner, fall alert popup + alarm
    src/features/    One folder per area: login, dashboard, alerts, incidents, system pages
    src/mocks/       Fake API (MSW) used in development and tests
    src/theme/       MUI theme built from the design tokens (day and night mode)
    e2e/             Playwright end-to-end tests
  docs/              API contract for the backend team
```

## Stack

React 19 · TypeScript 7 (strict) · Vite 8 · MUI 9 · React Router 8 · TanStack Query 5 · React Hook Form + Zod 4 · Recharts 3 · MSW 3 · Vitest 5 · Playwright · oxlint · Prettier

## What is built so far

| Screen                                                                      | Status                         |
| --------------------------------------------------------------------------- | ------------------------------ |
| AUTH-01 Login (errors, deactivated, remember me)                            | Done                           |
| SH-01/02 Layout shell (admin and caregiver sidebars)                        | Done                           |
| SH-05/06 Incoming alert popup with alarm sound                              | Done                           |
| SH-07 Active alert banner, SH-09 connection lost banner                     | Done                           |
| DASH-01 Admin dashboard                                                     | Done                           |
| DASH-02 Caregiver dashboard (only their own alerts, residents and cameras)  | Done                           |
| ALT-01 Alert queue, ALT-02 alert detail, ALT-03 classify, ALT-04 resolve    | Done                           |
| INC-01 Incident history (no filters yet), INC-03/04 detail, INC-05 add note | Done                           |
| SYS-01 404, SYS-02 403, SYS-03 crash page                                   | Done                           |
| Night mode                                                                  | Done (profile menu)            |
| Everything else in the Figma file                                           | Placeholder "coming soon" page |
