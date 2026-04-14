export default async (req) => {
  const { datasetId, brand } = await req.json();
  const APIFY_KEY = Netlify.env.get("APIFY_KEY");
  const CLAUDE_KEY = Netlify.env.get("CLAUDE_KEY");

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_KEY}&limit=80`
  );
  const posts = await itemsRes.json();

  if (!posts || posts.length === 0) {
    return new Response(JSON.stringify({ coupons: [], influencers: [], postCount: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const influencers = [...new Set(
    posts.map(p => p.ownerUsername || p.username).filter(Boolean).map(u => "@" + u.replace("@", ""))
  )].slice(0, 30);

  const captions = posts
    .filter(p => p.caption || p.text)
    .slice(0, 35)
    .map((p, i) => {
      const cap = (p.caption || p.text || "").slice(0, 500);
      const url = p.url || (p.shortCode ? `https://instagram.com/p/${p.shortCode}` : "");
      const user = p.ownerUsername || p.username || "unknown";
      return `[${i}] @${user} | url:${url}\n${cap}`;
    })
    .join("\n\n---\n\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `Extract discount/coupon codes from Israeli Instagram influencer posts.
Return ONLY a valid JSON array. No markdown. No explanation.
Format: [{"username":"@name","code":"CODE","discount":15,"url":"https://...","note":"×ª××××¨ ×§×¦×¨ ××¢××¨××ª"}]
Rules:
- username starts with @
- code: exact coupon string as written
- discount: number percentage, 0 if unknown
- Only posts with a real coupon/promo code
- No duplicate codes â each unique code once
- note: max 8 words Hebrew
- Return [] if none found`,
      messages: [{ role: "user", content: `Brand: ${brand}\n\nPosts:\n${captions}` }],
    }),
  });

  const d = await r.json();
  const text = d.content?.[0]?.text || "[]";
  let coupons = [];
  try { coupons = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { coupons = []; }

  return new Response(
    JSON.stringify({ coupons, influencers, postCount: posts.length }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config = { path: "/api/analyze" };
