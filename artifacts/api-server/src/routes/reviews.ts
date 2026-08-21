import { Router, type IRouter } from "express";
import { extractBearerToken, requireAuth, supabaseRootFetch } from "../lib/supabase";

const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SupabaseDiagnostic = {
  httpStatus: number;
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
};

async function readSupabaseDiagnostic(response: Response): Promise<SupabaseDiagnostic> {
  let payload: Record<string, unknown> = {};
  let raw = "";
  try {
    raw = await response.text();
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }

  const stringField = (field: string) =>
    typeof payload[field] === "string" && payload[field].trim() ? payload[field].trim() : null;

  return {
    httpStatus: response.status,
    code: stringField("code"),
    message: (stringField("message") ?? raw.trim()) || `Supabase returned HTTP ${response.status}.`,
    details: stringField("details"),
    hint: stringField("hint"),
  };
}

function diagnosticMessage(diagnostic: SupabaseDiagnostic) {
  const fragments = [
    `Supabase review insert failed (HTTP ${diagnostic.httpStatus})`,
    diagnostic.code ? `code ${diagnostic.code}` : null,
    diagnostic.message,
    diagnostic.details ? `details: ${diagnostic.details}` : null,
    diagnostic.hint ? `hint: ${diagnostic.hint}` : null,
  ].filter(Boolean);
  return fragments.join(" — ");
}

async function getHelpfulCount(reviewId: string, headers: Record<string, string>) {
  const response = await supabaseRootFetch(
    `/rest/v1/likes?review_id=eq.${encodeURIComponent(reviewId)}&select=id`,
    { headers },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<unknown>;
  return rows.length;
}

async function verifyReview(reviewId: string, headers: Record<string, string>) {
  const response = await supabaseRootFetch(
    `/rest/v1/reviews?id=eq.${encodeURIComponent(reviewId)}&select=id&limit=1`,
    { headers },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ id?: unknown }>;
  return rows.length > 0;
}

router.post("/reviews/:reviewId/helpful", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const reviewId = req.params.reviewId;
  if (!uuidPattern.test(reviewId)) {
    return res.status(400).json({ message: "That review could not be found." });
  }

  const token = extractBearerToken(req)!;
  const headers = { Authorization: `Bearer ${token}` };
  if (!(await verifyReview(reviewId, headers))) {
    return res.status(404).json({ message: "That review is no longer available." });
  }

  const existingResponse = await supabaseRootFetch(
    `/rest/v1/likes?review_id=eq.${encodeURIComponent(reviewId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
    { headers },
  );
  if (!existingResponse.ok) {
    return res.status(502).json({ message: "We could not update this Helpful vote. Please try again." });
  }
  const existingRows = (await existingResponse.json()) as Array<{ id: string }>;

  if (!existingRows.length) {
    const insertResponse = await supabaseRootFetch("/rest/v1/likes", {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal", "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, review_id: reviewId }),
    });
    if (!insertResponse.ok) {
      return res.status(502).json({ message: "We could not update this Helpful vote. Please try again." });
    }
  }

  const likeCount = await getHelpfulCount(reviewId, headers);
  if (likeCount === null) {
    return res.status(502).json({ message: "Your Helpful vote was saved, but the new total could not be loaded." });
  }
  return res.json({ reviewId, helpful: true, likeCount });
});

router.delete("/reviews/:reviewId/helpful", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const reviewId = req.params.reviewId;
  if (!uuidPattern.test(reviewId)) {
    return res.status(400).json({ message: "That review could not be found." });
  }

  const token = extractBearerToken(req)!;
  const headers = { Authorization: `Bearer ${token}` };
  const response = await supabaseRootFetch(
    `/rest/v1/likes?review_id=eq.${encodeURIComponent(reviewId)}&user_id=eq.${encodeURIComponent(user.id)}`,
    { method: "DELETE", headers },
  );
  if (!response.ok) {
    return res.status(502).json({ message: "We could not update this Helpful vote. Please try again." });
  }

  const likeCount = await getHelpfulCount(reviewId, headers);
  if (likeCount === null) {
    return res.status(502).json({ message: "Your Helpful vote was removed, but the new total could not be loaded." });
  }
  return res.json({ reviewId, helpful: false, likeCount });
});

router.post("/reviews", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body as Record<string, unknown>;
  const productId = typeof b.productId === "string" ? b.productId.trim() : "";
  if (!uuidPattern.test(productId)) {
    return res.status(400).json({ message: "productId must be a valid product UUID." });
  }

  const rating = typeof b.rating === "number" ? b.rating : parseInt(String(b.rating), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "rating must be an integer between 1 and 5." });
  }

  if (typeof b.worthIt !== "boolean") {
    return res.status(400).json({ message: "worthIt must be a boolean." });
  }
  const worthIt = b.worthIt;

  const reviewText = typeof b.reviewText === "string" ? b.reviewText.trim() : "";
  const videoUrl = typeof b.videoUrl === "string" && b.videoUrl.trim() ? b.videoUrl.trim() : null;
  const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.trim() ? b.photoUrl.trim() : null;
  if (!reviewText && !videoUrl && !photoUrl) {
    return res.status(400).json({
      message: "Add written review text, a photo, or a video before posting.",
    });
  }

  const token = extractBearerToken(req)!;
  const userHeaders = { Authorization: `Bearer ${token}` };
  const [profileResponse, productResponse] = await Promise.all([
    supabaseRootFetch(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
      { headers: userHeaders },
    ),
    supabaseRootFetch(
      `/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id&limit=1`,
      { headers: userHeaders },
    ),
  ]);

  if (!profileResponse.ok) {
    const diagnostic = await readSupabaseDiagnostic(profileResponse);
    req.log.error({ userId: user.id, supabase: diagnostic }, "Supabase profile preflight failed for review");
    return res.status(502).json({ message: diagnosticMessage(diagnostic), diagnostic });
  }
  if (!productResponse.ok) {
    const diagnostic = await readSupabaseDiagnostic(productResponse);
    req.log.error({ productId, supabase: diagnostic }, "Supabase product preflight failed for review");
    return res.status(502).json({ message: diagnosticMessage(diagnostic), diagnostic });
  }

  const [profileRows, productRows] = (await Promise.all([
    profileResponse.json(),
    productResponse.json(),
  ])) as [Array<{ id: string }>, Array<{ id: string }>];
  if (!profileRows.some((row) => row.id === user.id)) {
    return res.status(409).json({
      message: "Your account profile is not ready yet. Please sign out and sign back in, then try again.",
    });
  }
  if (!productRows.some((row) => row.id === productId)) {
    return res.status(404).json({ message: "The selected product no longer exists." });
  }

  req.log.info(
    { userId: user.id, productId, rating, worthIt, hasReviewText: Boolean(reviewText), hasPhoto: Boolean(photoUrl), hasVideo: Boolean(videoUrl) },
    "Creating authenticated review",
  );

  const response = await supabaseRootFetch("/rest/v1/reviews", {
    method: "POST",
    headers: {
      ...userHeaders,
      Prefer: "return=representation",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: productId,
      user_id: user.id,
      rating,
      worth_it: worthIt,
      review_text: reviewText,
      video_url: videoUrl,
      photo_url: photoUrl,
    }),
  });

  if (!response.ok) {
    const diagnostic = await readSupabaseDiagnostic(response);
    req.log.error({ userId: user.id, productId, supabase: diagnostic }, "Supabase review create failed");
    return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
      message: diagnosticMessage(diagnostic),
      diagnostic,
    });
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  if (!rows.length) {
    return res.status(502).json({ message: "Supabase did not return the created review." });
  }

  const r = rows[0];
  return res.status(201).json({
    id: String(r.id ?? ""),
    productId: String(r.product_id ?? ""),
    userId: String(r.user_id ?? ""),
    rating: typeof r.rating === "number" ? r.rating : rating,
    worthIt: Boolean(r.worth_it),
    reviewText: String(r.review_text ?? ""),
    videoUrl: typeof r.video_url === "string" ? r.video_url : null,
    photoUrl: typeof r.photo_url === "string" ? r.photo_url : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    authorUsername: null,
    authorAvatarUrl: null,
    likeCount: 0,
    commentCount: 0,
    viewerHasLiked: false,
  });
});

export default router;