import { Router, type IRouter } from "express";
import { extractBearerToken, pgProxyAuth, requireAuth } from "../lib/supabase";
import { mapReviews } from "./products";

const router: IRouter = Router();

router.post("/reviews", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body as Record<string, unknown>;

  const productId = typeof b.productId === "string" ? b.productId.trim() : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });

  const rating = typeof b.rating === "number" ? b.rating : parseInt(String(b.rating), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "rating must be an integer between 1 and 5." });
  }

  if (typeof b.worthIt !== "boolean") {
    return res.status(400).json({ message: "worthIt must be a boolean." });
  }
  const worthIt = b.worthIt as boolean;

  const reviewText = typeof b.reviewText === "string" ? b.reviewText.trim() : "";
  const videoUrl = typeof b.videoUrl === "string" && b.videoUrl.trim() ? b.videoUrl.trim() : null;
  const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.trim() ? b.photoUrl.trim() : null;
  if (!reviewText && !videoUrl && !photoUrl) {
    return res.status(400).json({
      message: "Add written review text, a photo, or a video before posting.",
    });
  }

  const token = extractBearerToken(req)!;

  const response = await pgProxyAuth("/rest/v1/reviews", token, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
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

  if (response.status === 409) {
    return res.status(409).json({ message: "You have already reviewed this product." });
  }

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase review create failed");
    return res.status(502).json({ message: "Unable to save review to Supabase." });
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
  });
});

export default router;
