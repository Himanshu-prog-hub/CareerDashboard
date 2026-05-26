# Cross-Device Sync Setup Guide

Your dashboard now syncs HR contact statuses, cold email statuses, and action item checkboxes across all devices.

## Architecture

```
Browser (localStorage)
    ↕ /api/sync-state (Vercel serverless function)
    ↕ SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed)
Supabase PostgreSQL (server of truth)
```

The serverless function keeps your Supabase service role key secret — the browser only communicates via the API.

---

## Setup (5 minutes)

### 1️⃣ Create Supabase Project

1. Go to **[supabase.com](https://supabase.com)** → Sign up (free)
2. **Create new project**
   - Name: `CareerDashboard`
   - Region: closest to you (or `us-east-1` for global)
   - Password: save it (you'll need it once for SQL editor)
3. Wait for project to provision (~2 mins)

### 2️⃣ Create the Table

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste this and click **Run**:

```sql
-- Dashboard sync state table
CREATE TABLE IF NOT EXISTS public.dashboard_state (
  id TEXT PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial row
INSERT INTO public.dashboard_state (id, data) 
VALUES ('main', '{}') 
ON CONFLICT (id) DO NOTHING;

-- Make table readable/writable by service role
ALTER TABLE public.dashboard_state ENABLE ROW LEVEL SECURITY;
```

✅ You should see "Success" message.

### 3️⃣ Get Your Keys

1. Go to **Settings** (left sidebar, bottom) → **API**
2. Copy both:
   - **Project URL** (something like `https://xxxxx.supabase.co`)
   - **Service Role Key** (starts with `eyJ...`) — **keep this secret**

### 4️⃣ Add to Vercel

1. Go to **[vercel.com](https://vercel.com)** → Your **CareerDashboard** project
2. **Settings** → **Environment Variables**
3. Add two:
   - Name: `SUPABASE_URL` → Value: your Project URL
   - Name: `SUPABASE_SERVICE_ROLE_KEY` → Value: your Service Role Key
4. Click **Save**
5. Redeploy the project (Settings → Deployments → click the latest → Redeploy)

### 5️⃣ Test It

1. Open **[career-dashboard-rosy.vercel.app](https://career-dashboard-rosy.vercel.app)**
2. You should see a green **"● Synced"** pill in the top-right of the header
3. Click a HR contact status → it should say **"● Pending"** then **"● Synced"**
4. Open the dashboard on a different device → the status should be there ✅

---

## What Syncs

- ✅ **HR contact statuses** (24 contacts) — "Not Sent", "Sent", "Replied", etc.
- ✅ **Cold email statuses** (330 contacts) — same states
- ✅ **Action plan checkboxes** — which items you've checked off
- ✅ **Sync status indicator** — shows syncing/synced/error/offline state

Changes sync automatically after 2.5 seconds of inactivity, or on page unload (best-effort).

---

## Troubleshooting

### Sync pill shows "⚠ Error"
- Check Vercel **Deployments** → latest → view logs for errors
- Verify env vars are exactly correct (copy-paste, no extra spaces)
- Make sure Supabase table was created (check SQL Editor)

### Sync pill shows "○ Offline"
- Browser is offline — changes saved to localStorage, will sync when back online

### Changes not syncing
- Open browser **DevTools** → **Console** → look for `[SyncManager]` errors
- Click the sync pill to force a manual sync
- Refresh the page to fetch latest from server

---

## Advanced

### Manual Sync

Click the **sync pill** in the header to force an immediate save (useful if you want to sync before closing the browser).

### Monitoring

Each sync call logs to browser console (`[SyncManager]`). Open DevTools → Console to see sync events.

### Data Structure (Supabase)

Your state is stored as a single JSON blob in `dashboard_state`:

```json
{
  "hr1": {
    "0": "Sent",
    "5": "Replied"
  },
  "hr2": {
    "100": "Sent",
    "150": "Interview"
  },
  "actions": {
    "3": 1,
    "7": 1
  }
}
```

- `hr1`: HR contacts (indices 0-23)
- `hr2`: Cold email contacts (indices 0-329)
- `actions`: Action plan items (indices 0-N)

Only *changed* values are stored (defaults aren't included), keeping the payload small.

---

## Security

- ✅ **Service Role Key** is server-side only (in Vercel env vars)
- ✅ Browser never sees the key
- ✅ Vercel function validates all requests
- ✅ Data is in your own Supabase project

For a personal dashboard this is plenty secure. If you later add other users, enable Supabase Row Level Security (RLS) to scope data by user.
