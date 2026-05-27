# Civic Ledger — Civic Issue Reporter (Frontend)

A public registry for civic reports. Citizens log issues — potholes, garbage, broken streetlights, drainage, electrical hazards — with photos and GPS. The system auto-routes each report to the right department. Everyone tracks status in real-time.

**This is the frontend only** (Next.js 14 + TypeScript + Tailwind). You build the backend as a separate service (Node.js + Express + MongoDB + Socket.IO).

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.local.example .env.local
# Edit .env.local and point NEXT_PUBLIC_API_URL at your backend
# (default expects http://localhost:5000)

# 3. Run
npm run dev
# → http://localhost:3000
```

## Aesthetic

A civic registry / editorial print look — Fraunces serif for display, Inter Tight for body, JetBrains Mono for metadata. Paper-warm background (`#f5f1e8`), ink black (`#0a0a0a`), rust orange accent (`#b8442e`) used sparingly for signal. A subtle paper-grain noise overlay across the whole page. Civic signage meets archival registry, not Silicon Valley pastels.

## Routes

| Route | Purpose | Auth |
|---|---|---|
| `/` | Landing page with hero & explainer | Public |
| `/login` | Universal sign-in (role-aware redirect) | Public |
| `/signup` | Citizen account creation | Public |
| `/dept/register` | Department self-registration (pending super-admin approval) | Public |
| `/map` | Live map of all city issues, color-coded by status | Public |
| `/citizen` | Citizen dashboard — their reports + nearby issues | Citizen |
| `/citizen/report` | New issue form — geolocation, up to 5 photos, category | Citizen |
| `/citizen/issues/[id]` | Issue detail with photos, timeline, map | Citizen |
| `/dept` | Department queue with filters & stats | Dept admin |
| `/dept/issues/[id]` | Issue detail with status-update + reroute panel | Dept admin |
| `/admin` | Tabs: department approvals, reroute queue, stats | Super-admin |
| `/notifications` | All notifications, mark all read | Any |
| `/profile` | View and edit account, change password, role-aware stats | Any |
| `/analytics` | Interactive map analytics — pins colored by department, role-scoped data | Dept admin, Super-admin |
| `/forum` | Community forum — trending / newest / top tabs, upvote, comment | Public (read) / signed in (write) |
| `/forum/issues/[id]` | Public issue detail — upvote, comment, view photos & timeline | Public (read) / signed in (write) |

Role-based redirects on login:
- `citizen` → `/citizen`
- `department_admin` → `/dept`
- `super_admin` → `/admin`

## Components

- **`<AuthProvider/>`** — fetches current user from `/api/auth/me` on mount
- **`<RoleGuard allowed={[...]}/>`** — wraps protected pages, redirects unauthorized users
- **`<Navbar/>`** — auth-aware top nav with unread notification count
- **`<IssueCard/>`** — issue card for lists
- **`<StatusBadge/>`** — color-coded status pill
- **`<IssuesMap/>`** — read-only Leaflet map with custom pins + popups (client-only)
- **`<LocationPicker/>`** — interactive Leaflet map for picking a location (client-only)

## Hooks & lib

- **`useAuthStore`** (Zustand at `src/store/auth.ts`) — `user`, `loading`, `setUser`, `setLoading`
- **`useSocket(callback)`** — Socket.IO client, auto-connects when logged in, passes JWT
- **`useGeolocation()`** — browser geolocation; returns `{ position, error, loading, fetch, setPosition }`
- **`api<T>(path, opts)`** — fetch wrapper at `src/lib/api.ts`; auto-attaches `Authorization: Bearer ...`
- **`setToken / getToken / clearToken`** — localStorage helpers
- **`cn(...)`** — `clsx + tailwind-merge` (at `src/lib/cn.ts`)
- **`types.ts`** — `User`, `Role`, `Issue`, `Department`, `Notification`, `Category`, plus `CATEGORY_LABELS` and `STATUS_LABELS`

## Real-time events (Socket.IO)

The frontend connects to `NEXT_PUBLIC_SOCKET_URL` with the JWT in `auth.token`. The backend should emit:

```
issue:new       → broadcast to dept room when an issue is routed to them
issue:status    → emitted to the citizen's user room on every status change
issue:reroute   → emitted to "super_admin" room when a dept flags an issue
```

The frontend listens for these in the citizen dashboard, citizen detail page, and department dashboard.

## API contract expected from the backend

All requests go to `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`).
JWT is sent as `Authorization: Bearer <token>` automatically.

```
# Auth
POST   /api/auth/signup                       { name, email, password, phone? }   → { user, token }
POST   /api/auth/login                        { email, password }                 → { user, token }
GET    /api/auth/me                                                              → { user }
POST   /api/auth/department/register          { deptName, deptCode, description?,
                                                adminName, adminEmail, password,
                                                categories: Category[] }          → { message }

# Citizen — issues
POST   /api/issues                            (multipart: title, description, category, lat, lng, photos[])
                                              → the created issue
GET    /api/issues                            → { issues: Issue[] }   (public — for /map)
GET    /api/issues/mine                       → { issues: Issue[] }
GET    /api/issues/nearby                     → { issues: Issue[] }
GET    /api/issues/:id                        → { issue: Issue }

# Department admin (filtered to their dept by middleware)
GET    /api/dept/issues                       → { issues: Issue[] }
PATCH  /api/dept/issues/:id/status            { status, note? }
POST   /api/dept/issues/:id/reroute           { note? }

# Super-admin
GET    /api/admin/departments[?status=...]    → { departments: Department[] }
PATCH  /api/admin/departments/:id/approve
PATCH  /api/admin/departments/:id/reject
GET    /api/admin/issues/reroute-queue        → { issues: Issue[] }
PATCH  /api/admin/issues/:id/assign           { departmentId }
GET    /api/admin/stats                       → { issues: Issue[] }   (or aggregated counts)

# Notifications
GET    /api/notifications                     → { notifications: Notification[] }
GET    /api/notifications/unread-count        → { count: number }
POST   /api/notifications/read-all
```

## Folder structure

```
src/
├── app/
│   ├── layout.tsx                              # root layout w/ AuthProvider + Toaster
│   ├── globals.css                             # design tokens + utility classes
│   ├── page.tsx                                # landing
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── map/page.tsx
│   ├── notifications/page.tsx
│   ├── citizen/
│   │   ├── page.tsx                            # dashboard
│   │   ├── report/page.tsx                     # new issue
│   │   └── issues/[id]/page.tsx                # detail
│   ├── dept/
│   │   ├── page.tsx                            # queue
│   │   ├── register/page.tsx                   # public registration
│   │   └── issues/[id]/page.tsx                # detail + actions
│   └── admin/page.tsx                          # super-admin tabs
├── components/                                 # all PascalCase
├── hooks/                                      # useGeolocation, useSocket
├── lib/                                        # api, cn, types
└── store/auth.ts                               # Zustand
```

## Notes for the backend

1. **CORS** — allow your Vercel frontend URL (or `*` in dev).
2. **Multer + Cloudinary** — handle multipart at `POST /api/issues`. Upload each photo and persist the URLs on the issue document.
3. **Socket.IO** — verify JWT on connection. On connect, join the user's personal room (`user:{userId}`), their department room if applicable (`dept:{departmentId}`), and `super_admin` if a super-admin.
4. **Routing engine** — runs after issue creation. Reads a `RoutingRule` collection or matches the issue's `category` to the first approved `Department` whose `categories` includes that category. Sets `assignedDepartment` and `status: 'assigned'`. If no match, leaves `status: 'needs_reroute'`.
5. **Department admin scoping** — middleware on every `/api/dept/*` route that filters by `req.user.department`.
6. **Super-admin seeding** — write a CLI seed script; never expose super-admin signup via API.

## Deployment

- **Frontend**: Vercel (one-click). Set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` in project settings.
- **Backend**: Render free tier — supports persistent Socket.IO connections (Vercel's serverless functions don't).
- **Database**: MongoDB Atlas free tier (M0 cluster).
- **Images**: Cloudinary free tier (upload from the backend, store the URL on the issue).

## License

MIT
