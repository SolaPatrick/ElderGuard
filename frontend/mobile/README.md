# ElderGuard mobile app

One Expo app for both roles (caregiver and Admin/Head). It talks to Den's FastAPI backend in `backend/`
through the same API code as the web app (`frontend/shared/src/api`). There is no fake server on the phone.

## What is built so far

| Screen                                                                         | Status |
| ------------------------------------------------------------------------------ | ------ |
| M-01 Splash while the saved sign-in is checked                                 | Done   |
| M-02 Login (field errors, wrong password, deactivated account from the server) | Done   |
| M-07 Change temporary password (forced), M-30 change password (from More)      | Done   |
| M-34 Session ended notice; "Can't reach ElderGuard" with Try again             | Done   |
| Home: who is signed in and how many alerts are open (start of M-09 / M-10)     | Done   |
| M-28 More: account, notifications, residents, help, change password, log out   | Done   |
| M-13 Alerts: Active (elapsed timers, Acknowledge) and History                  | Done   |
| M-14 Full-screen alert with sound and vibration; several alerts share one      | Done   |
| M-15 Alert detail; M-16 classify, M-17 resolve, M-18 add note (bottom sheets)  | Done   |
| M-11 Cameras (status, latest picture, area filter), M-12 camera view           | Done   |
| M-22 Residents (search), M-23 resident profile (read-only, contacts, history)  | Done   |
| M-27 Notifications: All / Unread, tap opens it, Mark all as read               | Done   |
| M-31 Help & About (same help text as the web, app version, server address)     | Done   |
| SOS, push notifications, M-29 profile and settings                             | Next   |

Camera pictures come from Den's `/cameras/{id}/snapshot`: every 10 seconds in the list and every 2 seconds
in the camera view, and only while that screen is showing. Phones can't show the MJPEG stream reliably in an
image, so the app uses pictures. SOS waits for Den's backend, which has no SOS route yet.

Notifications are built from alerts and camera status, the same rules as the web, because no server keeps
notifications yet. Which ones are read is kept on the phone only, so reading one on the web does not mark it
read on the phone.

Alerts are checked every 5 seconds while the app is open, the same as the web. Alerts while the app is
closed need push notifications (M-32), which need a backend change, so they come later.

The phone stays signed in (the token is in the phone's secure storage) and is only signed out by Log out or
when the server says the session is no longer valid. No signal does not sign anyone out.

## Run it on your phone

1. Install the **Expo Go** app on the phone. The phone and the computer must be on the same Wi-Fi.
2. Start Den's backend so the phone can reach it (from `backend/`):
   `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Without `--host 0.0.0.0` it only answers the computer
   itself. On Windows, allow Python through the firewall when it asks.
3. Find the computer's Wi-Fi address (Windows: `ipconfig`, the IPv4 Address, e.g. `192.168.1.20`).
4. Create `frontend/mobile/.env.local` with that address:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api
   ```
5. From `frontend/`: `npm ci`, then `cd mobile` and `npx expo start`. Scan the QR code with the phone.

More → the bottom of the screen shows which server the app is using.

## Checks

From `frontend/`, `npm run check` also typechecks and lints this app. To check that it builds for both
phones: `npx expo export --platform android --platform ios` inside `mobile/`.

The browser preview (`npx expo start --web`) runs on a different address than the web app, so Den's server
refuses it unless that address is in `FRONTEND_ORIGINS` in `backend/app/config.py`. A phone is not affected.
