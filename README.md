# Tensor MacTober Typing Championship '26

> **60 seconds. One hour. Type your way to the top.**

A production-ready event competition web application designed specifically for the organisation-wide **Tensor MacTober Typing Championship**, accommodating **180+ concurrent participants** with server-authoritative timing, live Realtime leaderboard, anti-cheat validation, and an interactive Host Control Center.

---

## 🏆 Key Features

- **Server-Authoritative Timing**: Synchronized event countdown based on PostgreSQL/Server time. Prevents client-clock manipulation, rejects late submissions, and caps tests that begin with `< 60s` remaining in the event.
- **85% Accuracy Qualification Threshold**: Attempts with `< 85%` accuracy are marked unranked, but preserved in the database for analytics.
- **Personal Best Engine**: Students can take unlimited attempts during the 1-hour window. Only their single best qualifying score is ranked (highest WPM, tie-breaker: higher accuracy, then earlier submission). A lower score never overwrites a personal best.
- **Apple-Inspired Interface**: Dark/light neutral palette (`#0B0C0E`), glassmorphism, subtle mechanical keycap styling, glowing SF-style indicators.
- **Event Anti-Cheat**: Disabled paste, passage copy prevention, keystroke verification, and server-side recalculated metrics.
- **Live Realtime Leaderboard**: Instant updates without page refresh, distinct Top 2 Grand Finalist highlights (`🥇`, `🥈`).
- **Host / Admin Control Center**: Big status dashboard, event triggers (Start, Pause, End, Reset), dynamic passage editor, participant search, complete attempt logs, reason-based disqualification & reinstatement, CSV exports (Leaderboard & All Attempts), and Demo Mode with activity simulator.
- **Grand Final 1v1 Showdown**: Dedicated `/final` route for the top 2 qualifying finalists.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, PostCSS, Lucide Icons
- **Database & Realtime**: Supabase (PostgreSQL, Realtime subscriptions, Row Level Security)
- **Deployment**: Vercel-ready

---

## 1. How to Install

```bash
# Clone the repository
cd "Touch Type Event"

# Install dependencies
npm install
```

---

## 2. Environment Variables

Create a `.env.local` file in the root of your project:

```bash
cp .env.example .env.local
```

Configure the following variables:

```ini
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Admin Authentication (Generated securely via npm run admin:setup)
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note**: If Supabase variables are not yet provided during initial local testing, the application automatically activates a resilient in-memory fallback and test simulation so you can immediately experience and verify the full championship flow.

---

## 3. How to Create Supabase Project

1. Log in to [Supabase](https://supabase.com).
2. Click **New Project** and name it `tensor-mactober`.
3. Choose your nearest database region and set a strong database password.
4. Once the project is provisioned, go to **Project Settings > API**.
5. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret key` → `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. How to Run Database Migrations

1. In your Supabase Dashboard, open the **SQL Editor** from the left navigation.
2. Open the migration file:
   [`supabase/migrations/20261020000000_init_tensor_mactober.sql`](file:///Users/aryasovakar/Documents/Touch%20Type%20Event/supabase/migrations/20261020000000_init_tensor_mactober.sql)
3. Paste the entire SQL script into the Supabase SQL Editor and click **Run**.
4. The migration will:
   - Create tables: `events`, `participants`, `attempts`.
   - Set up ultra-fast indexes optimized for 180+ concurrent users.
   - Install the server-authoritative RPC functions: `get_server_time()` and `get_event_leaderboard()`.
   - Configure Row Level Security (RLS) policies.
   - Enable Supabase Realtime publication on all tables.
   - Seed the official MacTober Championship event.

---

## 5. How to Run Locally

```bash
# Start Next.js development server
npm run dev
```

Visit [`http://localhost:3000`](http://localhost:3000) in your browser.

- **Landing Page**: [`http://localhost:3000`](http://localhost:3000)
- **Contest Arena**: [`http://localhost:3000/contest`](http://localhost:3000/contest)
- **Live Leaderboard**: [`http://localhost:3000/leaderboard`](http://localhost:3000/leaderboard)
- **Grand Final**: [`http://localhost:3000/final`](http://localhost:3000/final)
- **Host Dashboard**: [`http://localhost:3000/admin`](http://localhost:3000/admin)

---

## 6. How to Authenticate as Host/Admin

1. Run `npm run admin:setup` to generate your initial secure admin credentials.
2. Navigate to [`/admin`](http://localhost:3000/admin).
3. Enter your generated admin username and password.
4. A cryptographically signed HTTP-only secure session cookie will authenticate you.

---

## 7. How to Start an Event (Host Workflow)

1. Open `/admin`.
2. In the **Official Passage & Parameters** card:
   - Verify event duration (e.g., `60` minutes).
   - Verify typing test duration (e.g., `60` seconds).
   - Verify minimum accuracy threshold (`85.0%`).
   - Customize or confirm the official passage.
   - Click **Save Configuration**.
3. When ready to commence, click **START EVENT**.
4. The status turns to `● LIVE`, the countdown timer begins, and participants at `/contest` are unlocked to take attempts.
5. If you need to test the flow rapidly before the real event, enable **DEMO MODE** (sets 5-minute event & 10-second test) and click **Simulate Test Participants**.
6. When the 60 minutes expire (or when the host clicks **END EVENT**), the championship freezes and automatically resolves the **Top 2 Finalists**.
7. Navigate to `/final` to commence the Grand Final showdown.

---

## 8. How to Deploy to Vercel

1. Push your repository to GitHub, GitLab, or Bitbucket.
2. Import the project into [Vercel](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
4. Click **Deploy**.

---

## 🔒 Security & Rules Enforced

- **Server-Authoritative Evaluation**: WPM and accuracy are computed on the server from raw character comparisons; client-sent score values are never blindly trusted.
- **Anti-Paste**: Pasting directly into the typing area is prevented with warning feedback.
- **Anti-Copy**: Selecting and copying the competition passage is prohibited.
- **Disqualification Log**: Any participant disqualified by the host is excluded from the leaderboard immediately, with mandatory reason tracking and attempt audit preservation.
- **Service Role Isolation**: High-privilege database operations run strictly on the backend.
