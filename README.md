# ElderGuard

Fall detection and elder-care monitoring system.

- [`frontend/`](frontend/README.md): web console (React + TypeScript). Start here: `cd frontend && npm install && npm run dev`
- `backend/`: FastAPI + PostgreSQL server with live YOLOv8 fall detection. Copy `backend/.env.example` to `backend/.env`, fill in your own database URL and secret, then run `uvicorn app.main:app` from `backend/`.
- `elderguard/runs/fall/weights/best.pt`: the trained fall model (classes: fallen, in_bed, in_wheelchair, upright).
- `ElderGuard_Changes_Summary.pdf`: plain-language summary of the backend fixes.

Training videos, frames and the labelled dataset are not in this repo because they show real people.
