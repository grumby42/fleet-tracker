/**
 * FLTK relay — Cloudflare Worker (free plan).
 * Fetches community ADS-B feeds server-side, adds CORS headers for the GitHub Pages site,
 * and filters each response down to the watched carriers/tails so phones download kilobytes, not megabytes.
 *
 * Routes (GET only):
 *   /point/{feed}/{lat}/{lon}/{dist}?cs=FDX,ACA&hex=a00001,a835af&reg=C-GABC
 *   /hex/{feed}/{hex}
 *   /route/{callsign}
 *   /health
 * {feed} = airplanes.live | adsb.lol
 */
const ALLOWED_ORIGINS = [
  'https://grumby42.github.io',
  'http://localhost:8000', 'http://127.0.0.1:8000',
];
const UA = 'fleet-tracker relay (+https://github.com/grumby42/fleet-tracker)';
const FEEDS = {
  'airplanes.live': {
    point: (la, lo, d) => `https://api.airplanes.live/v2/point/${la}/${lo}/${d}`,
    hex: h => `https://api.airplanes.live/v2/hex/${h}`,
  },
  'adsb.lol': {
    point: (la, lo, d) => `https://api.adsb.lol/v2/lat/${la}/lon/${lo}/dist/${d}`,
    hex: h => `https://api.adsb.lol/v2/hex/${h}`,
  },
};
const NUM = /^-?\d{1,3}(\.\d{1,4})?$/;
const HEX = /^[0-9a-f]{6}$/;
const CS = /^[A-Z0-9]{2,8}$/;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(origin), ...extra },
  });
}
function list(param, re, max, upper) {
  return (param || '').split(',').map(s => upper ? s.trim().toUpperCase() : s.trim().toLowerCase())
    .filter(s => re.test(s)).slice(0, max);
}
async function upstream(url, ttl) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, cf: { cacheTtl: ttl, cacheEverything: true } });
  const text = await res.text();
  return { status: res.status, text };
}

export default {
  async fetch(req) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = ALLOWED_ORIGINS.includes(origin);
    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: okOrigin ? cors(origin) : {} });
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!okOrigin) return new Response('Forbidden origin', { status: 403 });

    const url = new URL(req.url);
    const p = url.pathname.split('/').filter(Boolean);

    try {
      if (p[0] === 'health') return json({ ok: true, feeds: Object.keys(FEEDS) }, 200, origin);

      if (p[0] === 'point' && p.length === 5) {
        const [, feed, lat, lon, dist] = p;
        if (!FEEDS[feed] || !NUM.test(lat) || !NUM.test(lon) || !/^\d{1,3}$/.test(dist) || +dist > 250) return json({ error: 'bad request' }, 400, origin);
        const prefixes = list(url.searchParams.get('cs'), /^[A-Z0-9]{3}$/, 40, true);
        const hexes = new Set(list(url.searchParams.get('hex'), HEX, 300));
        const regs = new Set(list(url.searchParams.get('reg'), /^[A-Z0-9-]{2,8}$/, 300, true).map(r => r.replace(/-/g, '')));
        const up = await upstream(FEEDS[feed].point(lat, lon, dist), 5);
        if (up.status !== 200) return json({ error: 'upstream ' + up.status }, 502, origin);
        const j = JSON.parse(up.text);
        const all = j.ac || [];
        const ac = all.filter(a => {
          const cs = (a.flight || '').trim().toUpperCase();
          const hex = (a.hex || '').toLowerCase().replace(/^~/, '');
          const reg = (a.r || '').toUpperCase().replace(/-/g, '');
          return prefixes.includes(cs.slice(0, 3)) || hexes.has(hex) || (reg && regs.has(reg));
        });
        return json({ ac, total: all.length, now: j.now, feed }, 200, origin);
      }

      if (p[0] === 'hex' && p.length === 3) {
        const [, feed, hex] = p;
        if (!FEEDS[feed] || !HEX.test(hex)) return json({ error: 'bad request' }, 400, origin);
        const up = await upstream(FEEDS[feed].hex(hex), 5);
        if (up.status !== 200) return json({ error: 'upstream ' + up.status }, up.status === 404 ? 404 : 502, origin);
        return new Response(up.text, { status: 200, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
      }

      if (p[0] === 'route' && p.length === 2) {
        const cs = p[1].toUpperCase();
        if (!CS.test(cs)) return json({ error: 'bad request' }, 400, origin);
        const up = await upstream(`https://api.adsbdb.com/v0/callsign/${cs}`, 21600);
        return new Response(up.text, { status: up.status, headers: { 'Content-Type': 'application/json', ...cors(origin) } });
      }

      return json({ error: 'not found' }, 404, origin);
    } catch (e) {
      return json({ error: 'relay error' }, 502, origin);
    }
  },
};
