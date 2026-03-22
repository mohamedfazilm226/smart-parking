# Smart Parking System

IoT-style smart parking: browse slots, book as a **customer**, verify tickets on the **in-charger** dashboard.

## Backend: InsForge

Auth, Postgres data, and RPCs run on **InsForge** (`@insforge/sdk`). The old Express + SQLite server (`server.ts`) is optional for local legacy use only.

### 1. Link project (CLI)

```bash
insforge login
insforge link   # or: insforge link --project-id <id>
```

### 2. Create database objects

Apply the SQL in `insforge/schema.sql` (tables `profiles`, `slots`, `bookings`, RLS, RPCs `create_booking`, `verify_booking`, `update_slot_status`, and seed slots).

```bash
# If your CLI supports reading a file:
insforge db query "$(cat insforge/schema.sql)"
# Otherwise paste the file contents into:
insforge db query "<sql>"
```

### 3. Environment variables

Copy `.env.example` to `.env` and set:

- **`VITE_INSFORGE_URL`** — your OSS host, e.g. `https://<appkey>.us-east.insforge.app`
- **`VITE_INSFORGE_ANON_KEY`** — public anon key from the InsForge dashboard or `insforge metadata`

Never commit `.env`.

### 4. Run the app

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### 5. Roles

- **Customer** — sign up / sign in as “Customer”; create bookings; see **My Bookings**.
- **In-charger** — sign up / sign in as “In-charger”; see all bookings in the admin panel and **verify** tickets (QR or manual ID).

Profiles are stored in `public.profiles` (`customer` | `incharger`).

## Features

- Email/password auth (with OTP step if email verification is enabled on the project)
- Slot listing by location, booking with `create_booking` RPC
- Booking history for customers
- In-charger list + QR scan + `verify_booking` RPC

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server (InsForge API) |
| `npm run build` | Production frontend bundle |
| `npm run preview` | Preview production build |
| `npm run dev:legacy-server` | Old Express + SQLite dev server |
| `npm start` | Legacy production Express server |

## Deploy (frontend)

Build static assets and deploy `dist/` to any static host (Netlify, Vercel, InsForge Deployments, etc.). Set `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY` in the host’s environment.
