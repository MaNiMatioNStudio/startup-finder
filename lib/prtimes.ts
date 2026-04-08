/**
 * Searches PR TIMES for funding news about a company.
 *
 * Strategy (in order):
 * 1. Brave Search API  — reliable, free (2000/month), JSON response, no bot detection
 * 2. DuckDuckGo HTML   — fallback when BRAVE_SEARCH_API_KEY is not set
 *
 * Brave API docs: https://api.search.brave.com/
 * Free plan: https://brave.com/search/api/
 */

// ─── Short-name extraction ────────────────────────────────────────────────────

/** Strip legal prefixes/suffixes to get the brand name used in press release titles. */
export function shortName(companyName: string): string {
  return companyName
    .replace(/^(株式会社|合同会社|有限会社|一般社団法人|特定非営利活動法人)\s*/u, "")
    .replace(/\s*(株式会社|合同会社|有限会社|Inc\.|Ltd\.|LLC\.?)$/u, "")
    .trim();
}

/** Ordered list of queries to attempt, most specific first. */
function buildQueries(companyName: string): string[] {
  const short = shortName(companyName);
  const queries: string[] = [];

  // Short name with quotes first — matches article titles that omit "株式会社"
  if (short && short !== companyName) {
    queries.push(`site:prtimes.jp "${short}" 資金調達`);
  }
  queries.push(`site:prtimes.jp "${companyName}" 資金調達`);
  if (short && short !== companyName) {
    queries.push(`site:prtimes.jp ${short} 資金調達`);
  }
  queries.push(`site:prtimes.jp ${companyName} 資金調達`);

  return [...new Set(queries)];
}

// ─── Brave Search API ─────────────────────────────────────────────────────────

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

async function braveSearch(query: string): Promise<string | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=ja&country=JP`;
    const res = await fetch(url, {
      headers: {
        "X-Subscription-Token": apiKey,
        Accept: "application/json",
        "Accept-Encoding": "gzip",
      },
    });

    if (!res.ok) return null;

    const json = await res.json() as { web?: { results?: BraveResult[] } };
    const results: BraveResult[] = json.web?.results ?? [];

    if (results.length === 0) return null;

    // Combine titles + descriptions that contain funding keywords
    const fundingKeywords = ["資金調達", "シード", "シリーズ", "億円", "万円", "調達"];
    const relevant = results.filter((r) =>
      fundingKeywords.some((kw) => r.title.includes(kw) || r.description.includes(kw))
    );

    if (relevant.length === 0) return null;

    return relevant
      .map((r) => `【${r.title}】\n${r.description}\n${r.url}`)
      .join("\n\n");
  } catch {
    return null;
  }
}

// ─── DuckDuckGo fallback ──────────────────────────────────────────────────────

const DDG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "ja,en-US;q=0.9",
  Referer: "https://html.duckduckgo.com/",
};

async function ddgSearch(query: string): Promise<string | null> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=jp-jp`;
  try {
    const res = await fetch(url, { headers: DDG_HEADERS });
    if (!res.ok) return null;
    const html = await res.text();

    if (
      html.includes("Please complete the following challenge") ||
      html.includes("bots use DuckDuckGo") ||
      html.length < 5000
    ) {
      return null;
    }

    return extractFundingSnippets(html) || null;
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function searchFundingOnPRTimes(companyName: string): Promise<string> {
  const queries = buildQueries(companyName);
  const hasBrave = !!process.env.BRAVE_SEARCH_API_KEY;

  for (const query of queries) {
    // Try Brave first (reliable, no rate limits in normal use)
    if (hasBrave) {
      const result = await braveSearch(query);
      if (result && result.trim().length > 30) return result;
    }

    // Fallback to DDG (works at low volume, may be blocked at high volume)
    const ddgResult = await ddgSearch(query);
    if (ddgResult && ddgResult.trim().length > 30) return ddgResult;

    // Brief pause between query variants
    await new Promise((r) => setTimeout(r, hasBrave ? 500 : 2000));
  }

  return "";
}

// ─── HTML helpers (for DDG fallback) ─────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFundingSnippets(html: string): string {
  const text = htmlToText(html);
  const fundingKeywords = ["資金調達", "シード", "シリーズ", "億円", "万円", "プレシリーズ", "調達"];
  const segments: string[] = [];
  let searchPos = 0;

  while (searchPos < text.length && segments.length < 6) {
    let nearestIdx = -1;
    for (const kw of fundingKeywords) {
      const idx = text.indexOf(kw, searchPos);
      if (idx >= 0 && (nearestIdx === -1 || idx < nearestIdx)) nearestIdx = idx;
    }
    if (nearestIdx === -1) break;

    const start = Math.max(0, nearestIdx - 150);
    const end = Math.min(text.length, nearestIdx + 400);
    segments.push(text.slice(start, end));
    searchPos = end;
  }

  return segments.join("\n---\n");
}
