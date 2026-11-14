# FLTK relay (Cloudflare Worker)

The community ADS-B feeds don't send CORS headers, so browsers block the tracker page from calling them directly. This Worker fetches them server-side, adds CORS headers **only for `https://grumby42.github.io`**, and strips each response down to the watched carriers and tails. That cuts phone data use by roughly 50–100×.

Cloudflare's free plan (100,000 requests/day) is plenty: a US sweep runs about 35 requests per cycle.

## Deploy (dashboard, about 5 minutes, no CLI)

1. Sign in at **dash.cloudflare.com** (a free account works).
2. **Compute (Workers)** → **Workers & Pages** → **Create** → **Create Worker** (start from "Hello World").
3. Name it `fleet-relay` → **Deploy**.
4. **Edit code**: delete the sample, paste all of `worker.js` from this folder → **Deploy**.
5. Copy the Worker URL: `https://fleet-relay.<your-subdomain>.workers.dev`.
6. Check it in a browser: `…workers.dev/health` should show **Forbidden origin**. That's correct, because the relay only answers the tracker page.
7. Open the tracker → **⚙ Watchlist** → **Relay**, paste the URL → **Test** → **Save**.

## Notes
- To allow another site, add its origin to `ALLOWED_ORIGINS` at the top of `worker.js` and redeploy.
- An upstream feed may rate-limit or block Cloudflare's shared IPs. If **Test** reports `upstream 403/429`, switch **Feed** to the other provider.
- The relay stores nothing and needs no keys.
