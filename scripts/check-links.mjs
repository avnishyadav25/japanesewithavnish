import "dotenv/config";

// Crawls the public Learn/Blog directory pages, extracts every card link, and
// reports any that don't return 200 — catching exactly the "visible card, dead
// page" bug pattern (e.g. 浴びる vocabulary, "Asking for Directions" listening).
//
// Usage: node scripts/check-links.mjs [--base=https://japanesewithavnish.com] [--concurrency=5]

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const BASE = (args.get("base") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Number(args.get("concurrency") || "5");
const TIMEOUT_MS = 10000;

const DIRECTORY_PAGES = [
  "/learn/grammar",
  "/learn/vocabulary",
  "/learn/kanji",
  "/learn/reading",
  "/learn/listening",
  "/learn/writing",
  "/blog",
];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractLinks(html, baseHref) {
  const hrefs = new Set();
  const re = /href="(\/(?:learn|blog)\/[^"#?]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== baseHref) hrefs.add(m[1]);
  }
  return Array.from(hrefs);
}

async function checkUrl(path) {
  try {
    const res = await fetchWithTimeout(`${BASE}${path}`, { redirect: "follow" });
    return { path, status: res.status, ok: res.ok };
  } catch (e) {
    return { path, status: 0, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function checkAllWithConcurrency(paths, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < paths.length) {
      const i = index++;
      results[i] = await checkUrl(paths[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

async function main() {
  console.log(`Checking links against ${BASE}\n`);

  const allLinks = new Set();
  for (const dirPath of DIRECTORY_PAGES) {
    const res = await checkUrl(dirPath);
    console.log(`${res.ok ? "OK " : "FAIL"} ${res.status || "ERR"}  ${dirPath}`);
    if (!res.ok) continue;
    const html = await (await fetchWithTimeout(`${BASE}${dirPath}`)).text();
    const links = extractLinks(html, dirPath);
    for (const l of links) allLinks.add(l);
  }

  console.log(`\nFound ${allLinks.size} unique card links across ${DIRECTORY_PAGES.length} directory pages. Checking each...\n`);

  const results = await checkAllWithConcurrency(Array.from(allLinks), CONCURRENCY);
  const broken = results.filter((r) => !r.ok);

  console.log(`Checked: ${results.length}`);
  console.log(`Broken: ${broken.length}\n`);

  if (broken.length > 0) {
    console.log("Broken links:");
    for (const b of broken) {
      console.log(`- [${b.status || "ERR"}] ${b.path}${b.error ? ` (${b.error})` : ""}`);
    }
    process.exitCode = 1;
  } else {
    console.log("No broken links found.");
  }
}

main().catch((e) => {
  console.error("Link check failed:", e);
  process.exitCode = 1;
});
