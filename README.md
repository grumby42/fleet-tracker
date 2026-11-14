# FLTK · Fleet Tracker

Single-page live tracker for selected carriers (FedEx, Air Canada, Sun Country, Aer Lingus by default) and specific tail numbers over the US.

- **Live data:** community ADS-B feeds (airplanes.live, falls back to adsb.lol). Non-commercial use, no uptime guarantee.
- **Routes:** adsbdb.com community callsign→route database (plausible, not authoritative; flagged ⚠ when the aircraft is far off the listed route).
- **Times:** elapsed / remaining / ETA are *estimates* from great-circle distance and ground speed. Not for operational use.
- **Watchlist** (carriers, tail numbers, refresh pause) is stored only in your browser's localStorage. No keys or personal data live in this repo.

Hosting: GitHub Pages from `main` / root. Open `index.html` on phone or desktop.

Build: FLTK-20261114-0116Z (shipped 2026-11-14T01:16:34Z)
