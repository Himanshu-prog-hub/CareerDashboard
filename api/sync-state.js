// Vercel Serverless Function — Career Dashboard State Sync
// Sits in the middle so the Supabase service-role key is never exposed to the browser.
//
// GET  /api/sync-state  → return current state JSON from Supabase
// POST /api/sync-state  → upsert full state JSON into Supabase

module.exports = async function handler(req, res) {
  // CORS (dashboard is on the same domain, but handy during local dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  // Graceful degradation — dashboard still works locally if env vars aren't set
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({
      error: 'Sync not configured',
      hint: 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables'
    });
  }

  const supaHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  };

  // ── GET: fetch state ─────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/dashboard_state?id=eq.main&select=data,updated_at`,
        { headers: supaHeaders }
      );
      if (!r.ok) throw new Error(`Supabase GET ${r.status}`);
      const rows = await r.json();
      return res.status(200).json(rows[0] || { data: {}, updated_at: null });
    } catch (err) {
      console.error('[sync-state GET]', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: save state ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      // Vercel auto-parses JSON bodies; handle edge case where it doesn't
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      const payload = JSON.stringify({
        id: 'main',
        data: body,
        updated_at: new Date().toISOString()
      });

      const r = await fetch(`${SUPABASE_URL}/rest/v1/dashboard_state`, {
        method: 'POST',
        headers: {
          ...supaHeaders,
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: payload
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Supabase POST ${r.status}: ${text}`);
      }

      return res.status(200).json({ ok: true, saved_at: new Date().toISOString() });
    } catch (err) {
      console.error('[sync-state POST]', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
