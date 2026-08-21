import { Router, type IRouter } from "express";
import { extractBearerToken, pgProxyAuth, requireAuth, supabaseRootFetch } from "../lib/supabase";
import { mapReviews } from "./products";

const router: IRouter = Router();
const usernamePattern = /^[a-z0-9][a-z0-9_.-]{2,23}$/;

type ProfileRow = Record<string, unknown>;

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function usernameValidationMessage(username: string) {
  if (!username) return "Username is required.";
  if (!usernamePattern.test(username)) {
    return "Username must be 3–24 characters and use only lowercase letters, numbers, periods, hyphens, or underscores.";
  }
  return null;
}

function mapProfile(user: { id: string; email: string }, row?: ProfileRow) {
  return {
    id: user.id,
    email: user.email,
    username: typeof row?.username === "string" ? row.username : null,
    displayName: typeof row?.display_name === "string" ? row.display_name : null,
    bio: typeof row?.bio === "string" ? row.bio : null,
    avatarUrl: typeof row?.avatar_url === "string" ? row.avatar_url : null,
    createdAt: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

async function isUsernameAvailable(token: string, userId: string, username: string) {
  const response = await supabaseRootFetch(
    `/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) return { available: false, unavailable: true };
  const rows = (await response.json()) as Array<{ id: string }>;
  return { available: !rows.length || rows[0]?.id === userId, unavailable: false };
}

router.get("/profile", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const token = extractBearerToken(req)!;
  const response = await pgProxyAuth(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,username,display_name,bio,avatar_url,created_at&limit=1`,
    token,
  );

  if (!response.ok && response.status !== 404) {
    req.log.error({ status: response.status }, "Supabase profile fetch failed");
  }

  const rows = response.ok ? ((await response.json()) as ProfileRow[]) : [];
  return res.json(mapProfile(user, rows[0]));
});

router.get("/profile/username-availability", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const rawUsername = typeof req.query.username === "string" ? req.query.username : "";
  const username = normalizeUsername(rawUsername);
  const validationMessage = usernameValidationMessage(username);
  if (validationMessage) return res.status(400).json({ message: validationMessage });

  const result = await isUsernameAvailable(extractBearerToken(req)!, user.id, username);
  if (result.unavailable) return res.status(502).json({ message: "Unable to check username availability right now." });
  return res.json({ username, available: result.available });
});

router.patch("/profile", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const update: Record<string, string | null> = {};

  if (typeof body.username === "string") {
    const username = normalizeUsername(body.username);
    const validationMessage = usernameValidationMessage(username);
    if (validationMessage) return res.status(400).json({ message: validationMessage });

    const result = await isUsernameAvailable(extractBearerToken(req)!, user.id, username);
    if (result.unavailable) return res.status(502).json({ message: "Unable to check username availability right now." });
    if (!result.available) return res.status(409).json({ message: "That username is already taken. Try another one." });
    update.username = username;
  }

  if (typeof body.displayName === "string") {
    const displayName = body.displayName.trim();
    if (!displayName) return res.status(400).json({ message: "Display name is required." });
    if (displayName.length > 60) return res.status(400).json({ message: "Display name must be 60 characters or fewer." });
    update.display_name = displayName;
  }

  if (typeof body.bio === "string") {
    const bio = body.bio.trim();
    if (bio.length > 150) return res.status(400).json({ message: "Bio must be 150 characters or fewer." });
    update.bio = bio || null;
  }

  if (typeof body.avatarUrl === "string") {
    const avatarUrl = body.avatarUrl.trim();
    if (!avatarUrl) return res.status(400).json({ message: "Profile photo URL is invalid." });
    update.avatar_url = avatarUrl;
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ message: "Add a display name, username, bio, or profile photo before saving." });
  }

  const token = extractBearerToken(req)!;
  const response = await supabaseRootFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    },
  );

  if (!response.ok) {
    let error: Record<string, unknown> = {};
    try {
      error = (await response.json()) as Record<string, unknown>;
    } catch {
      // Preserve the HTTP status even if Supabase returned a non-JSON body.
    }
    if (error.code === "23505") return res.status(409).json({ message: "That username is already taken. Try another one." });
    req.log.error({ status: response.status, code: error.code }, "Supabase profile update failed");
    return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
      message: "Unable to update your profile right now. Please try again.",
    });
  }

  const rows = (await response.json()) as ProfileRow[];
  if (!rows.length) return res.status(409).json({ message: "Your profile could not be updated. Please try again." });
  return res.json(mapProfile(user, rows[0]));
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