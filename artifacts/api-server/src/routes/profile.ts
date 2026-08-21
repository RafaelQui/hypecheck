import { Router, type IRouter } from "express";
import { extractBearerToken, pgProxyAuth, requireAuth } from "../lib/supabase";
import { mapReviews } from "./products";

const router: IRouter = Router();

router.get("/profile", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const token = extractBearerToken(req)!;

  // Fetch the profile row. Fall back gracefully if profiles table doesn't exist yet.
  const response = await pgProxyAuth(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,avatar_url,created_at&limit=1`,
    token,
  );

  if (!response.ok && response.status !== 404) {
    req.log.error({ status: response.status }, "Supabase profile fetch failed");
    // Still return basic info derived from the verified token.
  }

  let username: string | null = null;
  let avatarUrl: string | null = null;
  let createdAt = new Date().toISOString();

  if (response.ok) {
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (rows.length) {
      const p = rows[0];
      username = typeof p.username === "string" ? p.username : null;
      avatarUrl = typeof p.avatar_url === "string" ? p.avatar_url : null;
      createdAt = typeof p.created_at === "string" ? p.created_at : createdAt;
    }
  }

  return res.json({
    id: user.id,
    email: user.email,
    username,
    avatarUrl,
    createdAt,
  });
});

router.patch("/profile", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const avatarUrl = typeof req.body?.avatarUrl === "string" ? req.body.avatarUrl.trim() : "";
  if (!avatarUrl) return res.status(400).json({ message: "avatarUrl is required." });

  const token = extractBearerToken(req)!;
  const response = await pgProxyAuth(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
    token,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ avatar_url: avatarUrl }),
    },
  );

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase profile avatar update failed");
    return res.status(502).json({ message: "Unable to update your profile picture in Supabase." });
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const updated = rows[0];
  return res.json({
    id: user.id,
    email: user.email,
    username: typeof updated?.username === "string" ? updated.username : null,
    avatarUrl: typeof updated?.avatar_url === "string" ? updated.avatar_url : avatarUrl,
    createdAt: typeof updated?.created_at === "string" ? updated.created_at : new Date().toISOString(),
  });
});

router.get("/profile/reviews", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  const token = extractBearerToken(req)!;

  const selectFields =
    "id,product_id,user_id,rating,worth_it,review_text,video_url,photo_url,created_at,profiles(username,avatar_url)";

  const response = await pgProxyAuth(
    `/rest/v1/reviews?user_id=eq.${encodeURIComponent(user.id)}&select=${encodeURIComponent(selectFields)}&limit=${limit}&offset=${offset}&order=created_at.desc`,
    token,
    { headers: { Prefer: "count=exact" } },
  );

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase profile reviews failed");
    return res.status(502).json({ message: "Unable to load reviews from Supabase." });
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const total = parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const items = mapReviews(rows);

  return res.json({ items, total });
});

export default router;
