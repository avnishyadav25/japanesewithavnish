# Performance (CWV) — 60/100 (heuristic)

## Field data unavailable
PSI/CrUX rate-limited (no Google API key); domain likely below CrUX traffic threshold. Add PSI key + connect GSC for real LCP/INP/CLS.

## What works
Netlify CDN + Brotli · font preloads · SSR · clean responsive mobile render.

## Medium
- AdSense (pagead2.googlesyndication) + Monetag + GTM on the homepage — CLS/INP risk and a trust mismatch on a paid subscription product. Reserve fixed ad-slot sizes; lazy-load below fold; reconsider ads on paid pages.

## Low
- ~131 KB homepage HTML, 16 hydration chunks, 16 script tags. Watch INP on interactive lesson pages.
