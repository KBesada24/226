# EagleConnect

**Student club discovery, membership, events, chat, and review platform**

EagleConnect is a full-stack campus engagement application for students, club leaders, and university administrators. Students can browse approved clubs, join communities, RSVP to events, chat with club members, and leave reviews. Club admins can manage club details, members, events, and invite links. University admins can approve, reject, or deactivate clubs.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-0.124-009688?style=flat-square&logo=fastapi)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38B2AC?style=flat-square&logo=tailwind-css)

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Surface](#api-surface)
- [Database](#database)
- [Testing](#testing)
- [Deployment Notes](#deployment-notes)

---

## Features

### Students

- Browse, search, and filter approved clubs by category.
- Register, log in, and keep client-side session state with JWT authentication.
- Join and leave clubs, including joining through generated invite links.
- View a personal profile with club memberships and student stats.
- Browse upcoming events and RSVP to events.
- Participate in club chat after joining a club.
- Read and create club reviews.
- Receive and mark notifications as read.

### Club Admins

- Create new clubs and submit them for platform approval.
- Manage club profile details, category, description, and cover image URL.
- Approve, reject, or remove club members.
- Create, edit, and delete club events.
- Generate reusable invite links for club membership.
- Access club-only management pages from the club detail view.

### University Admins

- Review pending club applications.
- Approve, reject with a reason, or deactivate clubs.
- View pending and active club lists from the admin dashboard.
- Run the admin role setup endpoint when needed.

---

## Architecture

EagleConnect now uses a split frontend/backend architecture:

```text
Browser
  |
  | Next.js App Router pages and React components
  v
Next.js frontend on :3000
  |
  | /api/* rewrite configured in next.config.js
  v
FastAPI backend on :8000
  |
  | Supabase Python client
  v
Supabase PostgreSQL, Storage, and Realtime
```

The frontend does not implement API route handlers directly. It calls a centralized TypeScript API client in `src/lib/api/client.ts`, which defaults to `/api`. Next.js rewrites those requests to the FastAPI service through `next.config.js`. The backend owns authentication, validation, authorization checks, data shaping, and Supabase access.

### Frontend Layers

- `src/app` contains Next.js App Router pages for home, auth, profile, admin, clubs, events, and invite links.
- `src/components` contains page-level and reusable UI components, including club, event, layout, auth, dashboard, and shadcn/Radix-based UI primitives.
- `src/lib/api` contains endpoint-specific TypeScript wrappers around the centralized fetch client.
- `src/lib/hooks` contains TanStack Query hooks for clubs, events, students, stats, admin actions, reviews, and chat.
- `src/lib/contexts/AuthContext.tsx` manages client auth state, user profile storage, login, registration, logout, and profile updates.
- `src/middleware.ts` applies CORS and security headers for API traffic passing through Next.js.

### Backend Layers

- `backend/app/main.py` defines the FastAPI app, Pydantic request models, auth helpers, authorization checks, response formatting, and API routes.
- The backend uses bcrypt for password hashing and PyJWT for 24-hour JWT access tokens.
- The backend reads and writes Supabase tables through the Supabase Python client.
- FastAPI CORS middleware allows configured frontend origins.

### Data Layer

- Supabase PostgreSQL stores students, clubs, memberships, events, RSVPs, invite tokens, messages, reviews, and notifications.
- Supabase Storage includes a public `club-assets` bucket for club assets.
- Supabase Realtime is enabled by migrations for core tables and chat messages, while the current chat UI polls every two seconds for a real-time feel.

---

## Technology Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| Next.js 14 | React framework and App Router frontend |
| React 18 | Client UI rendering |
| TypeScript 5 | Shared type safety across UI, API wrappers, and DTOs |
| Tailwind CSS 3 | Utility-first styling |
| Radix UI / shadcn-style components | Accessible component primitives |
| TanStack React Query 5 | Server state fetching, caching, mutation invalidation, polling |
| React Hook Form | Form state and validation integration |
| Zod | Schema validation support |
| Lucide React | Icons |
| Sonner | Toast notifications |
| next-themes | Theme support |

### Backend

| Technology | Purpose |
| --- | --- |
| FastAPI | REST API service |
| Uvicorn | ASGI development/runtime server |
| Pydantic 2 | Request validation and serialization |
| Supabase Python client | Database and storage access |
| PostgreSQL | Relational data store through Supabase |
| PyJWT | JWT creation and verification |
| bcrypt | Password hashing |
| python-multipart | File upload support |
| pytest / httpx | Backend smoke and API tests |

### Tooling

| Technology | Purpose |
| --- | --- |
| Bun lockfile | Current JavaScript dependency lockfile |
| npm scripts | `dev`, `build`, and `start` Next.js commands |
| Tailwind / PostCSS | CSS build pipeline |
| Supabase migrations | Database schema and storage setup |

---

## Getting Started

### Prerequisites

- Node.js 18 or newer
- Bun or npm for frontend dependencies
- Python 3.11 or newer recommended
- Supabase project
- Supabase CLI if applying migrations locally from the command line

### 1. Install Frontend Dependencies

```bash
bun install
```

If you are not using Bun:

```bash
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cd ..
```

### 3. Configure Environment

Create a root `.env.local` for the Next.js app and a backend environment file or exported shell variables for FastAPI. The same values can be reused where names overlap.

See [Environment Variables](#environment-variables).

### 4. Apply Database Migrations

Apply the SQL files in `supabase/migrations` to your Supabase project, either through the Supabase dashboard SQL editor or the Supabase CLI.

```bash
npx supabase db push
```

### 5. Run the Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend health check is available at:

```text
http://127.0.0.1:8000/health
```

### 6. Run the Frontend

In a second terminal from the repository root:

```bash
bun run dev
```

or:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Next.js proxies `/api/*` to `BACKEND_API_URL` if it is set, otherwise to `http://127.0.0.1:8000`.

---

## Environment Variables

### Frontend

Create `.env.local` in the repository root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional. Defaults to /api so Next.js rewrites can proxy requests.
NEXT_PUBLIC_API_URL=/api

# Optional. Used by next.config.js for /api/* rewrites.
BACKEND_API_URL=http://127.0.0.1:8000

# Optional. Used by Next middleware CORS handling.
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

### Backend

Export these values before starting Uvicorn, or load them from your environment manager:

```env
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
JWT_SECRET=replace-with-a-long-random-secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is preferred for the backend so server-side operations can enforce application authorization without being blocked by browser RLS policies.
- `JWT_SECRET` is required by the backend for login-protected routes.
- The frontend needs the public Supabase values because it creates a browser Supabase client for client-side Supabase features.

---

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   └── main.py              # FastAPI application and API routes
│   ├── tests/
│   │   └── test_health.py       # Backend smoke test
│   ├── README.md                # Backend-specific setup notes
│   └── requirements.txt         # Python dependencies
├── docs/                        # API docs, integration notes, Postman collection
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── (auth)/              # Login and registration pages
│   │   ├── admin/               # University admin dashboard
│   │   ├── clubs/               # Club detail, create, and manage pages
│   │   ├── events/              # Event detail pages
│   │   ├── invites/             # Invite-token join flow
│   │   ├── profile/             # Student profile page
│   │   ├── layout.tsx           # Root layout and providers
│   │   └── page.tsx             # Home, search, stats, clubs, events
│   ├── components/
│   │   ├── auth/                # Protected route helpers
│   │   ├── clubs/               # Club cards, filters, settings, chat, reviews
│   │   ├── dashboard/           # Stats cards
│   │   ├── events/              # Event cards and creation modal
│   │   ├── layout/              # Header and notifications
│   │   ├── providers/           # Theme provider
│   │   └── ui/                  # Reusable UI primitives
│   ├── lib/
│   │   ├── api/                 # Typed API client and endpoint wrappers
│   │   ├── config/              # API/security defaults
│   │   ├── contexts/            # Auth context
│   │   ├── hooks/               # React Query hooks
│   │   ├── providers/           # Query provider
│   │   ├── supabase/            # Browser Supabase client
│   │   └── utils/               # Auth, storage, and UI utilities
│   ├── middleware.ts            # Next.js API CORS/security middleware
│   └── types/                   # API and Supabase TypeScript types
├── supabase/
│   └── migrations/              # Database, RLS, realtime, invite, admin, storage changes
├── next.config.js               # Image config and /api/* backend rewrite
├── package.json                 # Frontend scripts and dependencies
└── tailwind.config.ts           # Tailwind theme configuration
```

---

## API Surface

All application API routes are implemented by FastAPI under `backend/app/main.py`. From the browser, they are called as `/api/...` through the Next.js rewrite.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Backend health check |

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a student |
| POST | `/api/auth/login` | Log in and receive a JWT |
| POST | `/api/auth/logout` | Client-compatible logout response |

### Students

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/students/{student_id}` | Get a student profile |
| PATCH | `/api/students/{student_id}` | Update the authenticated student's profile |
| GET | `/api/students/{student_id}/memberships` | List a student's club memberships |

### Clubs and Memberships

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/clubs` | List clubs with pagination, search, category, and status filtering |
| POST | `/api/clubs` | Create a club |
| GET | `/api/clubs/{club_id}` | Get club details |
| PATCH | `/api/clubs/{club_id}` | Update club details |
| DELETE | `/api/clubs/{club_id}` | Delete a club |
| GET | `/api/clubs/{club_id}/members` | List members, optionally filtered by status |
| POST | `/api/clubs/{club_id}/members` | Join/request membership |
| PATCH | `/api/clubs/{club_id}/members/{student_id}` | Approve or reject a member |
| DELETE | `/api/clubs/{club_id}/members/{student_id}` | Leave or remove a member |
| GET | `/api/clubs/{club_id}/invite` | Get or create a club invite link |
| POST | `/api/invites/{token}/join` | Join a club through an invite token |

### Events and RSVPs

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/events` | List events with pagination and filters |
| POST | `/api/events` | Create an event |
| GET | `/api/events/{event_id}` | Get event details |
| PATCH | `/api/events/{event_id}` | Update an event |
| DELETE | `/api/events/{event_id}` | Delete an event |
| GET | `/api/events/{event_id}/rsvps` | List event attendees |
| POST | `/api/events/{event_id}/rsvps` | RSVP to an event |
| DELETE | `/api/events/{event_id}/rsvps/{student_id}` | Cancel or remove an RSVP |

### Admin

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/clubs` | List clubs by admin status |
| PATCH | `/api/admin/clubs/{club_id}` | Approve, reject, or deactivate a club |
| POST | `/api/admin/setup-roles` | Promote configured accounts for admin setup |

### Stats, Notifications, Chat, Reviews, Uploads

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/stats` | Platform statistics |
| GET | `/api/stats/student/{student_id}` | Student-specific statistics |
| GET | `/api/notifications` | List notifications for the authenticated student |
| PATCH | `/api/notifications/{notification_id}` | Mark a notification as read |
| GET | `/api/clubs/{club_id}/messages` | List club chat messages |
| POST | `/api/clubs/{club_id}/messages` | Send a club chat message |
| GET | `/api/clubs/{club_id}/reviews` | List club reviews |
| POST | `/api/clubs/{club_id}/reviews` | Create a club review |
| POST | `/api/upload` | Upload an asset to Supabase Storage |

---

## Database

The Supabase schema is managed through SQL migrations in `supabase/migrations`.

Core tables:

- `students`: accounts, profile fields, password hashes, and roles.
- `clubs`: club profile data, admin owner, category, cover image URL, and approval status.
- `memberships`: many-to-many student/club membership state.
- `events`: club-owned events.
- `rsvps`: student/event attendance records.
- `invite_tokens`: generated club invite tokens.
- `messages`: club chat messages.
- `reviews`: club ratings and comments.
- `notifications`: user notifications and metadata.

Other database-related setup:

- Indexes support common category, status, date, student, and club lookups.
- RLS policies are defined for newer review, message, notification, and storage resources.
- Supabase Realtime publication entries are added for core tables and messages.
- The `club-assets` storage bucket is configured as public-readable with authenticated upload/update/delete policies.

---

## Testing

Backend smoke tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend build check:

```bash
bun run build
```

or:

```bash
npm run build
```

There are no frontend test scripts defined in `package.json` at this time.

---

## Deployment Notes

- Deploy the Next.js frontend and FastAPI backend as separate services, or use a platform that supports both runtimes.
- Set `BACKEND_API_URL` in the frontend environment to the deployed FastAPI base URL so `/api/*` rewrites target the backend.
- Set the backend Supabase and JWT environment variables in the backend hosting environment.
- Apply Supabase migrations before routing production traffic to the deployed app.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Do not expose it through any `NEXT_PUBLIC_*` variable.

---

## Team

**The Fikr Five**

- Kirollos Besada
- Mohammad Slim
- Adam Belhadj
- Timothy Mesak
- Seif Awad

---

## License

This project is developed for **CSC 226 - Web Database Applications** at College of Staten Island.
