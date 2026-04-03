import type { VercelRequest, VercelResponse } from "@vercel/node";

const faceitHeaders = (token: string) =>
  ({ Authorization: `Bearer ${token}` }) as const;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const token =
    process.env.FACEIT_SERVER_API_KEY ?? process.env.Server_Key_jljxZQuehz;
  if (!token || token.length < 8) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }
  const raw = req.query.user;
  const username =
    typeof raw === "string"
      ? raw.trim()
      : Array.isArray(raw)
        ? raw[0]?.trim() ?? ""
        : "";
  if (!username || username.length > 128) {
    res.status(400).json({ error: "Missing or invalid user" });
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  const playerUrl = `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(username)}`;
  const playerRes = await fetch(playerUrl, { headers: faceitHeaders(token) });
  if (playerRes.status === 404) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (!playerRes.ok) {
    res.status(502).json({ error: "Faceit player service error" });
    return;
  }
  const player = (await playerRes.json()) as {
    player_id?: string;
    games?: { cs2?: { faceit_elo?: number } };
  };
  const playerId = player.player_id;
  if (!playerId) {
    res.status(502).json({ error: "Invalid player response" });
    return;
  }
  const statsUrl = `https://open.faceit.com/data/v4/players/${encodeURIComponent(playerId)}/stats/cs2`;
  const statsRes = await fetch(statsUrl, { headers: faceitHeaders(token) });
  if (!statsRes.ok) {
    res.status(502).json({ error: "Faceit stats service error" });
    return;
  }
  const stats = (await statsRes.json()) as {
    lifetime?: Record<string, string | number | undefined>;
  };
  const lifetime = stats.lifetime ?? {};
  const kd = lifetime["Average K/D Ratio"];
  const matches = lifetime["Matches"];
  const winrate = lifetime["Win Rate %"];
  const elo = player.games?.cs2?.faceit_elo;
  res.status(200).json({
    elo: elo ?? null,
    kd: kd ?? null,
    matches: matches ?? null,
    winrate: winrate ?? null,
  });
}
