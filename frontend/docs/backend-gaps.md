# What the web app still needs from the backend

The web app now talks to the FastAPI backend in `backend/` through a translation layer
(`frontend/web/src/api/fastapi.ts`), so the names and paths can stay as they are. It was tested against
the real server (login, temporary-password change, the fall alarm popup, acknowledge, classify, resolve,
residents, cameras, dashboard).

The items below are things the backend doesn't have yet. Until they exist, the app shows an empty value
or a clear "not available yet" message. It never invents data. They are listed most important first.

## 1. Which resident fell

An alert lists everyone in the room (`residents`), not who fell. When two people share a room, the app
can't tell staff who to go to, so it shows "Unknown resident". A `resident_id` on the alert would fix this.
It could be set by the camera when it can tell, or left empty when it can't.

## 2. Caregiver area assignment

Caregivers only see the alerts, residents and cameras for their own rooms (the AREA_ASSIGNMENT table in
the ERD). The backend shows everyone everything. Needed:

- `areas: [{ id, name, area }]` on the user from `/api/auth/me` and the login response.
- Alerts, residents and cameras filtered to those rooms for employees. An alert outside their rooms should
  return **404**, so a shared link doesn't reveal it.
- `caregivers: [{ id, full_name }]` on each resident (shown on the resident profile), and `caregiver_ids`
  accepted by `POST/PATCH /api/residents`. Until then the resident form and the "Assign caregivers" dialog
  are hidden.
- `area_ids: [room ids]` accepted by `POST /api/users` and `PATCH /api/users/{id}`, and `areas` on the users
  they return. Until then, the Users & Access screens hide room assignment and say it isn't available yet.

## 3. SOS

The SOS button is ready in the app, but the backend has no SOS. Suggested:
`POST /api/alerts/sos` with `{ room_id, resident_id?, note? }`. It would create an alert with
`fall_type: "SOS"`, no camera, `sent_by` = the caller, and broadcast it like a fall alert. Until then,
the app says "Sending an SOS is not available on the server yet". Cancelling an SOS (SOS-03) would be
`POST /api/alerts/{id}/cancel-sos` with `{ reason, note }`, allowed for the sender or an admin. The SOS status
design (SOS-02) also lists who was notified and who is responding; that needs a record of each person notified,
which the app leaves out until the server has it.

## 4. Snapshot pictures

`<img>` tags can't send the login header, so `/api/alerts/{id}/snapshot` needs `?token=` the same way the
live stream does (use `viewer_from_token`). The app already adds the token to the link.

## 5. Names of who acknowledged or resolved

Alerts only return user ids (`acknowledged_by: 3`). The app looks the names up in `/api/users`, but that's
admin-only, so caregivers see "A staff member". Adding `acknowledged_by_name`, `classified_by_name` and
`resolved_by_name` to `AlertOut` would fix it.

## 6. Smaller things

| What                                                                                                                       | Why                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outcome` field on resolve                                                                                                 | The app sends the outcome (e.g. "Assisted, no injury") inside the note text for now.                                                                                                                                                                                                        |
| False alarm closes the alert                                                                                               | In the app a false alarm is closed straight away, so it sends classify and then resolve. One call would be cleaner.                                                                                                                                                                         |
| Resident details: `sex`, `birth_date`, `mobility_aid`, and emergency contacts as a list of `{ name, relationship, phone }` | Shown on the resident profile and asked for on the Add/Edit resident form. Until then the form asks for an age and one free-text contact (what the backend keeps), and the profile shows that contact without a Call button.                                                                |
| Why a resident was archived (`reason`, `note` on `POST /api/residents/{id}/archive`)                                       | The Archive dialog in the designs asks for a reason (moved out, transferred, other). Until the backend keeps it, the app archives without asking, instead of asking and dropping the answer.                                                                                                |
| Unique camera names                                                                                                        | The app opens a camera by its name (`/monitoring/CAM-01`), so two cameras with the same name would clash. The app checks this before saving, but `POST/PATCH /api/cameras` should refuse a duplicate with **409** too.                                                                      |
| Notifications (`NOTIFICATION` in the ERD): `GET /api/notifications`, read/unread                                           | The Notifications page builds its list from incidents and camera status, and remembers read/unread in the browser. A server table would add password-changed and report-ready notices and keep read state across devices.                                                                   |
| Live video while detection is off                                                                                          | The camera manager only runs cameras with `detection_enabled`, so a paused camera has no video (its stream is a grey "Detection is off" card). The app shows "No live video while fall detection is paused". Running the camera without the model would keep live video for paused cameras. |
| Area check on `/api/cameras/{id}/stream` and `/snapshot`                                                                   | Any signed-in user can open any camera's video by its id. Once caregiver areas exist (item 2), these two routes should check them too, so a caregiver only sees their own rooms.                                                                                                            |
| `last_login_at` on users                                                                                                   | Shown in the "Last login" column of Users & Access. It shows "—" until then.                                                                                                                                                                                                                |
| Camera `last_seen_at` and resolution                                                                                       | Shown as "Last seen 2:15 PM" on offline cameras and as "1080p · 15 FPS" on the camera page.                                                                                                                                                                                                 |
| Activity log (`GET /api/activity?limit=3`)                                                                                 | The admin dashboard's "Recent staff activity" card is empty without it.                                                                                                                                                                                                                     |
| Facility name                                                                                                              | The dashboard shows "ElderGuard" until there's a setting for it.                                                                                                                                                                                                                            |
| `backend/requirements.txt`                                                                                                 | So everyone installs the same versions. What I needed: `fastapi uvicorn sqlmodel python-dotenv pyjwt "pwdlib[argon2,bcrypt]" "psycopg[binary]" opencv-python-headless numpy python-multipart`, plus `ultralytics` for the model.                                                            |
| `MODEL_PATH` default                                                                                                       | It points to `C:\Elderguard\...`, so it only works on one computer. A path relative to the repo (`../elderguard/runs/fall/weights/best.pt`) works everywhere.                                                                                                                               |

## How to run the two together

1. Start the backend from `backend/` (see the main README). It listens on `http://localhost:8000`.
2. In `frontend/web/.env.local` set:

   ```
   VITE_USE_MOCKS=false
   VITE_BACKEND=fastapi
   API_PROXY_TARGET=http://localhost:8000
   ```

3. `cd frontend && npm run dev`, then open http://localhost:5173.

The first admin account's temporary password is printed once in the backend console. The app asks you to
change it on first login.
