# Images (62) & AI Search / GEO (78)

## Images
- **Medium:** ~20% of sampled images (26/128) missing/empty alt text.
- **Medium:** no dedicated 1200×630 social image.
- **Low:** assets served from raw `pub-...r2.dev` hostname (map a branded custom domain).

## AI Search Readiness (strongest category)
- **Works:** excellent `/llms.txt` (static, correct domain) · robots.txt allows OAI-SearchBot + ChatGPT-User · SSR content readable by AI crawlers · citable Q&A-style guides.
- **Medium:** domain mismatch (llms.txt = primary domain, canonical/schema = netlify.app) may fracture AI citations — resolved by env fix.
- **Low:** weak entity signals (empty sameAs, no logo).
