# ElderGuard API contract (frontend ⇄ backend)

This is what the web app expects from the backend. The fake API in `web/src/mocks/handlers.ts` follows it exactly. The exact field types live in `shared/src/schemas.ts`. If the backend sends something different, the app shows "The server sent an unexpected response". The browser console then names the field that didn't match.

If the backend team prefers other paths or field names, that's fine. Change `web/src/api/endpoints.ts` and `shared/src/schemas.ts` together, and the type checker will point at every screen that needs updating.

## General rules

- Base URL: `VITE_API_BASE_URL` (default `/api`). During development, the dev server forwards `/api` to `API_PROXY_TARGET`.
- JSON in, JSON out. Field names are **camelCase**.
- Dates are ISO 8601 with a time zone, e.g. `2026-10-19T14:41:08+08:00` or `...Z`.
- IDs are strings. Incidents are addressed by their code, e.g. `INC-2026-0142`.
- Auth: `Authorization: Bearer <token>` on every request except login.
- Errors use any 4xx/5xx status with this body:

  ```json
  { "code": "invalid_credentials", "message": "Incorrect username or password." }
  ```

  `message` is shown to staff as-is, so write it in plain language. A **401** on any request logs the user out and shows "Your session ended".

## Auth

| Method | Path           | Body                     | Response          |
| ------ | -------------- | ------------------------ | ----------------- |
| POST   | `/auth/login`  | `{ username, password }` | `{ token, user }` |
| GET    | `/auth/me`     | none                     | `user`            |
| POST   | `/auth/logout` | none                     | `{ ok: true }`    |

`user` = `{ id, fullName, username, email (or null), role: "admin" | "employee", title, mustChangePassword, areas: [{ id, name, wing }] }`

`areas` lists the rooms and areas a caregiver monitors (AREA_ASSIGNMENT). It is empty for the Admin/Head.

## Who sees what

- **Admin/Head:** everything.
- **Caregiver (employee):** only incidents, cameras and residents in their assigned `areas` (matched by room). An incident in another area must return **404**, both for `GET /incidents/{code}` and for the actions on it, so a shared link doesn't reveal it.
- `GET /dashboard/summary` and `GET /activity` are Admin/Head only. They return **403** for caregivers.

Login errors the UI expects: `401 invalid_credentials`, `403 account_deactivated`, `423 account_locked`.

## Dashboard

`GET /dashboard/summary` returns:

```json
{
  "facilityName": "Demo Home for the Aged",
  "activeAlerts": { "total": 2, "new": 1, "acknowledged": 1 },
  "incidentsToday": { "total": 5, "confirmed": 2, "falseAlarms": 1 },
  "cameras": { "online": 9, "total": 11, "offline": 1, "paused": 1, "error": 0 },
  "residentsMonitored": 8,
  "falseAlarmRate7d": 0.18,
  "avgAckSeconds": 84,
  "fallsThisWeek": [{ "date": "2026-10-13", "count": 3 }, "... 7 days, oldest first"]
}
```

`GET /activity?limit=3` returns `[{ id, user: { id, fullName }, summary, createdAt }]`, newest first.

`GET /cameras` returns `[{ id, code, roomId, roomName, roomWing, resolutionFps, liveUrl, status: "online"|"offline"|"error"|"paused"|"connecting", detectionEnabled, lastSeenAt }]`. Caregivers only get the cameras in their areas.

- `resolutionFps` is a display string such as `"1080p · 15 FPS"`, or `null`.
- `liveUrl` is a URL the browser can play in a `<video>` tag (for example an MP4 or HLS gateway in front of the RTSP camera). Send `null` until streaming is ready; the camera page then shows a placeholder.
- `roomWing` is `null` for common areas (hallways, dining hall). The Live Monitoring area filter groups these as "Common areas".

`GET /residents` returns `[{ id, fullName, age, fallRisk: "low"|"moderate"|"high", room: { id, name, wing } | null, caregivers: [{ id, fullName }], hasActiveAlert, lastIncidentAt }]`. `hasActiveAlert` and `lastIncidentAt` (ISO date-time or `null`) only count incidents the caller can see.

`GET /residents/{id}` returns one resident with extra profile fields:

```json
{
  "...": "every field from the list above",
  "sex": "female",
  "birthDate": "1942-03-12",
  "mobilityAid": "Walker",
  "careNotes": "Needs help standing up at night.",
  "emergencyContacts": [
    { "id": "…", "fullName": "Maricel Santos", "relationship": "Daughter", "phone": "0918 555 0172" }
  ]
}
```

`sex`, `birthDate`, `mobilityAid`, `careNotes` and `relationship` may be `null`. A caregiver asking for a resident outside their areas gets **404**.

## Incidents (alerts)

An alert and an incident are the same record (see the ERD). Status flow:

```
new → acknowledged → confirmed → resolved
                   ↘ false_alarm (closed)
```

| Method | Path                            | Body                                                                | Response         |
| ------ | ------------------------------- | ------------------------------------------------------------------- | ---------------- |
| GET    | `/incidents?scope=active`       | none                                                                | `incident[]`     |
| GET    | `/incidents?scope=all&limit=50` | none                                                                | `incident[]`     |
| GET    | `/incidents/{code}`             | none                                                                | `incidentDetail` |
| POST   | `/incidents/{code}/acknowledge` | none                                                                | `incidentDetail` |
| POST   | `/incidents/{code}/classify`    | `{ classification: "confirmed"\|"false_alarm", falseAlarmReason? }` | `incidentDetail` |
| POST   | `/incidents/{code}/resolve`     | `{ outcome, responseSummary? }`                                     | `incidentDetail` |
| POST   | `/incidents/{code}/notes`       | `{ body }`                                                          | `incidentDetail` |

### SOS

`POST /incidents/sos` with `{ roomId, residentId?, note? }` creates an incident with `type: "sos"`, `status: "new"`, `sentBy` = the caller, `camera: null`, `confidence: null`, and returns `incidentDetail` (status 201). The note, if any, becomes the first response note. A caregiver can only send from a room in their `areas` (otherwise **403**). Every other on-duty staff member then sees it through the usual active-incidents poll.

`GET /rooms` returns `[{ id, name, wing }]`: every room and area for the Admin/Head, the assigned ones for a caregiver. The SOS form uses it for the location list.

- `acknowledge` on an alert someone else already acknowledged must return **409** `already_acknowledged`, with a message naming who did it. Two caregivers can press the button at the same moment, and this is how the second one finds out.
- `classify` is only allowed from `acknowledged`; `resolve` only from `confirmed` (otherwise 409 `invalid_state`).
- `false_alarm` closes the incident (set `resolvedAt`/`resolvedBy`).

`incident`:

```json
{
  "code": "INC-2026-0142",
  "type": "fall",
  "status": "new",
  "resident": { "id": "…", "fullName": "Remedios Santos", "age": 84, "fallRisk": "high" },
  "room": { "id": "…", "name": "Room 101", "wing": "East Wing" },
  "camera": { "id": "…", "code": "CAM-01" },
  "sentBy": null,
  "confidence": 0.87,
  "snapshotUrl": null,
  "clipUrl": null,
  "detectedAt": "…",
  "acknowledgedAt": null,
  "acknowledgedBy": null,
  "resolvedAt": null,
  "resolvedBy": null,
  "escalatedAt": null,
  "falseAlarmReason": null,
  "outcome": null
}
```

For SOS: `type: "sos"`, `camera: null`, `confidence: null`, and `sentBy: { id, fullName }`.

`incidentDetail` = `incident` + `events: [{ id, action, occurredAt, user, detail }]` + `notes: [{ id, body, author, createdAt }]`.
`action` is one of `detected | acknowledged | classified | resolved | escalated`.

## Cameras & Devices (setup, Admin/Head only)

| Method | Path                     | Body                                                             | Response                    |
| ------ | ------------------------ | ---------------------------------------------------------------- | --------------------------- |
| GET    | `/cameras/{id}/settings` | none                                                             | `cameraSettings`            |
| POST   | `/cameras`               | `{ code, source, roomId, place, privacyBlur, detectionEnabled }` | `cameraSettings`, 201       |
| PATCH  | `/cameras/{id}`          | same as POST                                                     | `cameraSettings`            |
| DELETE | `/cameras/{id}`          | none                                                             | 204, no body                |
| POST   | `/cameras/test`          | `{ source }`                                                     | `{ width, height }`, or 400 |

`cameraSettings` = `{ id, code, source, roomId, place: "room" | "bathroom", privacyBlur: "off" | "person" | "whole", detectionEnabled }`

- `source` is an `rtsp://` or `http(s)://` link, or a device number such as `"0"`. It can contain a password, so only
  the Admin/Head ever receives it.
- A bathroom camera always uses `privacyBlur: "whole"`, whatever is sent.
- `code` must be unique (any case): it is used in links such as `/monitoring/CAM-01`. **409** otherwise.
- DELETE returns **409** when the camera has alerts in the incident history (turn detection off instead).
- `/cameras/test` reads one picture from the source and returns its size, or **400** with a message.

## Rooms & Areas

| Method | Path          | Body             | Response                                         |
| ------ | ------------- | ---------------- | ------------------------------------------------ |
| GET    | `/rooms`      | none             | `[{ id, name, wing }]` (caregivers: only theirs) |
| POST   | `/rooms`      | `{ name, wing }` | `{ id, name, wing }`, 201 (Admin/Head)           |
| PATCH  | `/rooms/{id}` | `{ name, wing }` | `{ id, name, wing }` (Admin/Head)                |
| DELETE | `/rooms/{id}` | none             | 204, no body (Admin/Head)                        |

- `wing` is optional (`null`), e.g. for a dining hall. One wing can't have two rooms with the same name (any case): **409**.
- Renaming a room renames it on its cameras. Past incidents keep the name they had.
- DELETE returns **409** with a message while residents or cameras are in the room, or when the room has incident
  history (rename it instead). Deleting also removes it from staff area assignments.

## Users & Access (Admin/Head only)

Every route here returns **403** for employees.

| Method | Path                         | Body                                           | Response                           |
| ------ | ---------------------------- | ---------------------------------------------- | ---------------------------------- |
| GET    | `/users`                     | none                                           | `staffMember[]` (sorted by name)   |
| GET    | `/users/{id}`                | none                                           | `staffMember`                      |
| POST   | `/users`                     | `{ fullName, username, email, role, areaIds }` | `{ user, temporaryPassword }`, 201 |
| PATCH  | `/users/{id}`                | `{ fullName, email, role, areaIds }`           | `staffMember`                      |
| POST   | `/users/{id}/deactivate`     | none                                           | `staffMember`                      |
| POST   | `/users/{id}/reactivate`     | none                                           | `staffMember`                      |
| POST   | `/users/{id}/reset-password` | none                                           | `{ user, temporaryPassword }`      |

`staffMember` = `user` plus `isActive`, `lastLoginAt` (null if they never logged in) and `createdAt`.

- `email` is optional (`null`). Usernames are lowercase letters, numbers, `.`, `-` and `_`, and can't be changed.
- `areaIds` are room ids. They are ignored for the Admin/Head, who sees everything.
- The temporary password is returned only in these two responses. The person must change it at their next login
  (`mustChangePassword: true`), and a reset makes the old password stop working.
- **409** when the username or email is already used, or when the change would leave no active Admin/Head.
  **400** when the Admin/Head tries to deactivate their own account.
- A deactivated account can't log in, and its open sessions get **401**.

## Live updates

The app currently polls `GET /incidents?scope=active` every 5 seconds (`ALERT_POLL_MS` in `web/src/api/config.ts`). This works with any backend. Later, a WebSocket or Server-Sent Events stream can replace it, and only `web/src/api/queries.ts` would change.
