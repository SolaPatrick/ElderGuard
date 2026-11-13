# ElderGuard frontend

The ElderGuard web console (Admin/Head and caregivers). It is built from the Figma hi-fi design and the ElderGuard design system. A mobile app (Expo / React Native) will be added next to it later and reuse the `shared` package.

## Quick start (Windows, macOS or Linux)

You need **Node.js 22.12 or newer** ([nodejs.org](https://nodejs.org), pick the LTS version). Check with `node -v`.

```bash
cd frontend
npm ci               # installs exactly the locked versions; run again after every git pull
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
    src/features/    One folder per area: login, dashboard, alerts, incidents, monitoring, residents, system pages
    src/mocks/       Fake API (MSW) used in development and tests
    src/theme/       MUI theme built from the design tokens (day and night mode)
    e2e/             Playwright end-to-end tests
  docs/              API contract for the backend team
```

## Stack

React 19 · TypeScript 7 (strict) · Vite 8 · MUI 9 · React Router 8 · TanStack Query 5 · React Hook Form + Zod 4 · Recharts 3 · MSW 3 · Vitest 5 · Playwright · oxlint · Prettier

## What is built so far

Web app screens. Every "Done" screen works with the built-in fake server. The last column says how much of it works with Den's FastAPI backend today; `docs/backend-gaps.md` has the details.

| Screen                                                                                                                     | Status | Den's backend                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| AUTH-01 Login (errors, deactivated, remember me), change password after a temporary one                                    | Done   | Yes                                                                         |
| SH-01/02 Layout shell (admin and caregiver sidebars), night mode                                                           | Done   | Yes                                                                         |
| SH-05/06 Incoming alert popup with alarm sound                                                                             | Done   | Yes                                                                         |
| SH-07 Active alert banner, SH-09 connection lost banner                                                                    | Done   | Yes                                                                         |
| SOS-01 Send SOS (press and hold 3 s), SOS-02 SOS status, SOS-03 cancel SOS                                                 | Done   | No, SOS is not on the server yet                                            |
| DASH-01 Admin dashboard, DASH-02 caregiver dashboard                                                                       | Done   | Partly: no staff activity card, caregivers see all rooms                    |
| ALT-01 Alert queue, ALT-02 alert detail, ALT-03 classify, ALT-04 resolve                                                   | Done   | Yes                                                                         |
| INC-01 Incident history, INC-02 filters, INC-03/04 detail, INC-05 add note                                                 | Done   | Yes                                                                         |
| MON-01 Live Monitoring grid (camera pictures every 2 s), MON-02 single camera live video                                   | Done   | Yes, except cameras with detection paused                                   |
| RES-01 to RES-07 Residents: list, add, profile, edit, assign, archive and restore                                          | Done   | Partly: age and one contact only, no caregivers or photos                   |
| ROOM-01 to ROOM-04 Rooms & areas: list, add/edit, detail, delete                                                           | Done   | Yes, no capacity                                                            |
| CAM-01 to CAM-05, CAM-07 Cameras: list, register, detail, edit, move, remove                                               | Done   | Yes                                                                         |
| USR-01 to USR-08 Users & access: list, create, detail, edit, deactivate, reset password                                    | Done   | Yes, without room assignment                                                |
| NTF-01 Notification center, PRF-04 Help & About                                                                            | Done   | Yes                                                                         |
| AUTH-07 Enable alerts and sound check, PRF-03 alert preferences (desktop notifications, alarm volume)                      | Done   | Kept on each computer, not on the server                                    |
| AUTH-09 Session expired, AUTH-10 timeout warning (password to stay signed in), SYS-04 server unreachable page              | Done   | Yes, the login end time comes from the server's token                       |
| PRF-01 My profile (read-only; the Admin/Head edits their own details in Users & access), change password from the profile  | Done   | Partly: no photo or mobile number, and staff can't edit their own details   |
| SH-03 Notification bell dropdown, SH-08 toasts (acknowledge, classify, resolve, note, snapshot)                            | Done   | Yes                                                                         |
| SYS-05 Scheduled maintenance page and banner (any HTTP 503 from the server or the proxy in front of it)                    | Done   | Den's backend never sends 503 yet, so a proxy must send it                  |
| RPT-01 Reports & analytics (date range, key figures, falls by day, room, resident and hour, outcomes, false alarm reasons) | Done   | Yes, without camera uptime (no camera history on the server)                |
| RPT-02 Generate report (7 types, date range, room), RPT-03 A4 preview, print or save as PDF, CSV download                  | Done   | Yes, without camera uptime; reports aren't saved (no history on the server) |
| SYS-01 404, SYS-02 403, SYS-03 crash page                                                                                  | Done   | n/a                                                                         |

Still to do (each is a "coming soon" page or not started):

| Screen                                                             | Waiting on           |
| ------------------------------------------------------------------ | -------------------- |
| RPT-04 Report history (saved reports)                              | Den's backend        |
| LOG-01/02 Activity log                                             | Den's backend        |
| SET-01 to SET-04 Settings                                          | Den's backend        |
| AUTH-02 to AUTH-05 Forgot password                                 | Den's backend        |
| USR-09 Permissions, USR-10 assign areas, CAM-06 device health      | Den's backend        |
| Resident photos, room capacity, camera uptime, incident PDF export | Den's backend        |
| Mobile app (M-01 to M-34)                                          | Frontend (`mobile/`) |
