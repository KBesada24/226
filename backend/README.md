# EagleConnect Python Backend

FastAPI replacement for the former Next.js API route backend. The frontend can keep calling `/api/...`; Next.js rewrites those requests to this service.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Environment

The backend reuses the existing app variables where possible:

```bash
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
JWT_SECRET=...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is preferred so the API can preserve the old server-side repository behavior.

## Run

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then run the frontend from the repository root:

```bash
bun install
bun run dev
```

Next proxies `/api/*` to `BACKEND_API_URL` if set, otherwise `http://127.0.0.1:8000`.

## Smoke Tests

```bash
cd backend
source .venv/bin/activate
pytest
```
