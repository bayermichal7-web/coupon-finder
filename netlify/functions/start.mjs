export default async (req) => {
  const { query } = await req.json();
  const APIFY_KEY = Netlify.env.get("APIFY_KEY");
  const CLAUDE_KEY = Netlify.env.get("CLAUDE_KEY");

  // Resolve hashtag from query
  let hashtag = query.replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
  const isHebrew = /[\u0590-\u05FF]/.test(query);

  if (isHebrew) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 30,
        system: "Convert an Israeli brand name to its most popular Instagram hashtag in English (no #, lowercase, no spaces). Return ONLY the hashtag string.",
        messages: [{ role: "user", content: query }],
      }),
    });
    const d = await r.json();
    hashtag = (d.content?.[0]?.text || hashtag).trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
  }

  // Start Apify run
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs?token=${APIFY_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtags: [hashtag], resultsLimit: 50 }),
    }
  );

  if (!runRes.ok) {
    const txt = await runRes.text();
    return new Response(JSON.stringify({ error: "Apify error: " + txt }), { status: 502, headers: { "Content-Type": "application/json" } });
  }

  const { data } = await runRes.json();
  return new Response(
    JSON.stringify({ runId: data.id, datasetId: data.defaultDatasetId, hashtag, brand: query }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config = { path: "/api/start" };
