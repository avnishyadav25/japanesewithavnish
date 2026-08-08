# On-Page SEO & Schema — 52 / 50

## On-Page
- **Critical:** og:url + canonical on wrong domain (env fix).
- **High:** stub meta descriptions at scale — `/learn/kanji/*` → "尻 - butt", `/learn/vocabulary/*` → "ときどき", many `/blog/study_guide/*` 24–65 chars.
- **Medium:** og:image/twitter:image missing on ~33/39 pages. Root layout sets `openGraph.images=['/logo.png']` but page-level metadata redefines `openGraph` without images → dropped.
- **Low:** a few `/guide/*` titles >60 chars (truncate). 
- **Good:** unique titles, 1 H1/page, clean URLs, JLPT level pages have unique titles + self-referencing canonicals.

## Schema
- **High:** missing BreadcrumbList, Article, Course/EducationalOccupationalProgram, Product/Offer, FAQPage, WebSite+SearchAction.
- **Medium:** Organization JSON-LD minimal — url=netlify.app, sameAs=[], no logo.
