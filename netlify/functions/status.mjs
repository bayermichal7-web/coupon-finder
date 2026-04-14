export default async (req) => {
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  const APIFY_KEY = Netlify.env.get("APIFY_KEY");

  const r = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`);
  const d = await r.json();

  return new Response(
    JSON.stringify({ status: d.data?.status }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const config = { path: "/api/status" };
