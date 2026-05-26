# Civic Ledger — Backend

Node.js + Express + MongoDB + Socket.IO backend for the Civic Ledger civic issue reporter.

Paired with the frontend at `civic-reporter/`. The two communicate over a JWT-authenticated REST API plus a Socket.IO real-time channel.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET, CLOUDINARY_*, SEED_ADMIN_*

# 3. Create the first super-admin (one-time)
npm run seed:admin

# 4. Start the dev server
npm run dev
# → http://localhost:5000
```

Health check: `GET http://localhost:5000/health`

---

## Stack

- **Express** — HTTP server
- **MongoDB** + **Mongoose** — database & ODM
- **Socket.IO** — real-time push (issue:new, issue:status, issue:reroute, notification:new)
- **JWT** (`jsonwebtoken`) — auth tokens, in `Authorization: Bearer ...`
- **bcryptjs** — password hashing
- **Cloudinary** — image storage (photos upload via `multer` memoryStorage and stream to Cloudinary)
- **Zod** — runtime request validation
- **TypeScript** — typed throughout

---

## File structure

```
src/
├── server.ts                  # entry — Mongo connect, HTTP server, Socket.IO
├── app.ts                     # Express app config (middleware, routes)
├── config/
│   ├── env.ts                 # zod-validated environment variables
│   └── cloudinary.ts          # Cloudinary SDK setup
├── models/
│   ├── User.ts                # citizen / department_admin / super_admin
│   ├── Department.ts          # pending / approved / rejected + categories[]
│   ├── Issue.ts               # GeoJSON Point, statusHistory[]
│   ├── Notification.ts
│   └── RoutingRule.ts         # optional super-admin overrides
├── middleware/
│   ├── auth.ts                # requireAuth, optionalAuth, signToken, verifyToken
│   ├── requireRole.ts         # role guard factory
│   ├── upload.ts              # multer memoryStorage (5 × 8MB)
│   └── errorHandler.ts        # central error formatter
├── routes/
│   ├── auth.ts                # /api/auth/*
│   ├── issues.ts              # /api/issues/*
│   ├── dept.ts                # /api/dept/* (department_admin only)
│   ├── admin.ts               # /api/admin/* (super_admin only)
│   └── notifications.ts       # /api/notifications/*
├── services/
│   ├── routingEngine.ts       # picks which department gets each issue
│   ├── cloudinaryUpload.ts    # buffer → Cloudinary URL
│   └── notifications.ts       # create DB row + emit socket event
├── sockets/
│   ├── index.ts               # Socket.IO setup with JWT verify, rooms
│   └── emitters.ts            # typed emit helpers
├── utils/
│   ├── asyncHandler.ts        # wraps async route handlers
│   ├── errors.ts              # AppError, BadRequestError, etc.
│   └── validators.ts          # zod schemas for request bodies
└── scripts/
    └── seedSuperAdmin.ts      # creates the initial super_admin
```

---

## Environment variables

See `.env.example`. The server fails to start if required values are missing or invalid (validated by zod in `src/config/env.ts`).

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `JWT_SECRET` | yes | ≥16 chars; use `openssl rand -base64 48` |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | yes | from cloudinary.com dashboard |
| `CORS_ORIGIN` | no | default `http://localhost:3000`; comma-separated for multiple; `*` for any (dev only) |
| `PORT` | no | default 5000 |
| `NODE_ENV` | no | `development` / `production` |
| `JWT_EXPIRES_IN` | no | default `7d` |
| `SEED_ADMIN_*` | seed only | used only by `npm run seed:admin` |

---

## API

All requests use `Content-Type: application/json` unless noted (the issue-create endpoint uses `multipart/form-data`). Authenticated endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ name, email, password, phone? }` | `{ user, token }` | — |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, token }` | — |
| GET | `/api/auth/me` | — | `{ user }` | any |
| POST | `/api/auth/department/register` | `{ deptName, deptCode, description?, adminName, adminEmail, password, categories[] }` | `{ message, departmentId }` | — |

Department admins **cannot log in** until their department is approved.

### Issues

| Method | Path | Body / Query | Returns | Auth |
|---|---|---|---|---|
| POST | `/api/issues` | multipart: `title, description, category, lat, lng, photos[]` | `{ issue }` | citizen |
| GET | `/api/issues` | — | `{ issues }` (last 500) | optional |
| GET | `/api/issues/mine` | — | `{ issues }` | citizen |
| GET | `/api/issues/nearby` | `?lat=&lng=&radius=` (m, default 5000) | `{ issues }` | any |
| GET | `/api/issues/:id` | — | `{ issue }` | any (with row-level checks) |

Visibility rules on `GET /api/issues/:id`:
- citizen → only their own
- department_admin → only ones assigned to their dept
- super_admin → all

### Department admin (`/api/dept/*` requires role `department_admin`)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/dept/issues` | — | `{ issues }` (filtered to their dept) |
| PATCH | `/api/dept/issues/:id/status` | `{ status, note? }` | `{ issue }` |
| POST | `/api/dept/issues/:id/reroute` | `{ note? }` | `{ issue }` (status → `needs_reroute`) |

`status` enum: `assigned | in_progress | resolved | rejected`.

### Super-admin (`/api/admin/*` requires role `super_admin`)

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/api/admin/departments` | `?status=pending\|approved\|rejected` | `{ departments }` |
| PATCH | `/api/admin/departments/:id/approve` | — | `{ department }` |
| PATCH | `/api/admin/departments/:id/reject` | — | `{ department }` |
| GET | `/api/admin/issues/reroute-queue` | — | `{ issues }` |
| PATCH | `/api/admin/issues/:id/assign` | `{ departmentId }` | `{ issue }` |
| GET | `/api/admin/stats` | — | `{ issues }` (recent 1000 for client-side aggregation) |

### Notifications (any auth role)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/notifications` | `{ notifications }` (newest 100) |
| GET | `/api/notifications/unread-count` | `{ count }` |
| POST | `/api/notifications/read-all` | `{ ok: true }` |
| POST | `/api/notifications/:id/read` | `{ notification }` |

---

## Real-time (Socket.IO)

Clients connect to the same host/port as the HTTP server, e.g. `io('http://localhost:5000', { auth: { token } })`.

The JWT is verified on handshake. The connection is rejected if the token is invalid or expired.

On connection, the server auto-joins:
- `user:{userId}` — for every authenticated socket
- `dept:{departmentId}` — for department_admin sockets
- `super_admin` — for super_admin sockets

Events emitted from server → client:

| Event | Room | Payload |
|---|---|---|
| `issue:new` | `dept:{id}` | The full issue document |
| `issue:status` | `user:{reporterId}` | `{ issueId, status, note? }` |
| `issue:reroute` | `super_admin` | The full issue document |
| `notification:new` | `user:{id}` | The full notification document |
| `map:update` | `map` (opt-in) | The full issue document |

Client-driven events (optional):

| Event | Purpose |
|---|---|
| `join:map` | Join the city-wide map broadcast room |
| `leave:map` | Leave it |

---

## Routing engine

`src/services/routingEngine.ts`. Given a category, resolves which department gets the issue:

1. Highest-priority `RoutingRule` for the category whose department is `approved`
2. First approved department whose `categories[]` includes the category
3. If neither matches → `status: 'needs_reroute'`, `assignedDepartment: null` (super-admin manually assigns)

When a department flags an issue as "not ours", the same fallback path is used — the issue is sent to super-admin's reroute queue.

---

## Deployment notes

**Render** is the recommended host because it supports persistent Socket.IO connections on the free tier. Vercel's serverless functions do not.

1. Create a new **Web Service** on Render pointing at the GitHub repo
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add every variable from `.env.example` to the Render dashboard
5. Set `NODE_ENV=production`
6. Set `CORS_ORIGIN` to your deployed frontend URL

On first deploy, run `npm run seed:admin` once via Render's shell to create the super-admin.

---

## Development tips

- **Reset the DB** during testing: connect via `mongosh` and `db.dropDatabase()`. Indexes will rebuild on next start.
- **Re-run seed**: safe to run multiple times — only creates a super-admin if one with that email doesn't already exist.
- **Watch logs in dev**: `morgan` is set to `dev` format. In production it switches to `combined`.
- **Type checking without running**: `npm run typecheck`.

---

## License

MIT
