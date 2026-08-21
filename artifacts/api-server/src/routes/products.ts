import { Router, type IRouter } from "express";
import { pgProxy } from "../lib/supabase";

const router: IRouter = Router();

// Columns that exist on both `products` and `product_summaries`.
// `product_summaries` adds rating/review_count/worth_the_hype on top.
const SUMMARY_COLS = "id,name,description,price,category,image_url,store_url,retailer,rating,review_count,worth_the_hype";
const FALLBACK_COLS = "id,name,description,price,category,image_url,store_url,retailer";

/**
 * Map a raw Supabase row to a ProductSummary response object.
 * All aggregate fields are null-safe: a product without reviews returns
 * null for rating/worthTheHype and 0 for reviewCount.
 */
function toProductSummary(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    category: String(r.category ?? ""),
    price: typeof r.price === "number" ? r.price : parseFloat(String(r.price ?? "0")) || 0,
    retailer: typeof r.retailer === "string" ? r.retailer : null,
    imageUrl: typeof r.image_url === "string" ? r.image_url : null,
    rating: typeof r.rating === "number" ? r.rating : r.rating != null ? parseFloat(String(r.rating)) || null : null,
    reviewCount: typeof r.review_count === "number" ? r.review_count : parseInt(String(r.review_count ?? "0"), 10) || 0,
    worthTheHype: typeof r.worth_the_hype === "number" ? r.worth_the_hype : r.worth_the_hype != null ? parseFloat(String(r.worth_the_hype)) || null : null,
  };
}

/**
 * Map a raw Supabase row to a ProductDetail response object.
 */
function toProductDetail(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: typeof r.description === "string" ? r.description : null,
    price: typeof r.price === "number" ? r.price : parseFloat(String(r.price ?? "0")) || 0,
    category: String(r.category ?? ""),
    retailer: typeof r.retailer === "string" ? r.retailer : null,
    imageUrl: typeof r.image_url === "string" ? r.image_url : null,
    storeUrl: typeof r.store_url === "string" ? r.store_url : null,
    rating: typeof r.rating === "number" ? r.rating : r.rating != null ? parseFloat(String(r.rating)) || null : null,
    reviewCount: typeof r.review_count === "number" ? r.review_count : parseInt(String(r.review_count ?? "0"), 10) || 0,
    worthTheHype: typeof r.worth_the_hype === "number" ? r.worth_the_hype : r.worth_the_hype != null ? parseFloat(String(r.worth_the_hype)) || null : null,
  };
}

// ---------------------------------------------------------------------------
// GET /products  – list / search
// ---------------------------------------------------------------------------
router.get("/products", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  // Build query string for product_summaries (preferred) or products (fallback)
  function buildQs(selectCols: string) {
    let qs = `select=${encodeURIComponent(selectCols)}&limit=${limit}&offset=${offset}&order=name.asc`;
    if (q) {
      qs += `&or=(name.ilike.${encodeURIComponent(`*${q}*`)},category.ilike.${encodeURIComponent(`*${q}*`)},retailer.ilike.${encodeURIComponent(`*${q}*`)})`;
    }
    return qs;
  }

  // Try product_summaries view first (includes aggregates).
  let response = await pgProxy(
    `/rest/v1/product_summaries?${buildQs(SUMMARY_COLS)}`,
    { headers: { Prefer: "count=exact" } },
  );

  // PostgREST returns 404 when the view/table doesn't exist at all.
  // Treat that as a provisioning issue – return a clear 502, not an empty list.
  if (response.status === 404) {
    // Try the base products table as a fallback.
    response = await pgProxy(
      `/rest/v1/products?${buildQs(FALLBACK_COLS)}`,
      { headers: { Prefer: "count=exact" } },
    );

    if (response.status === 404) {
      req.log.error("Neither product_summaries view nor products table exists in Supabase");
      return res.status(502).json({
        message:
          "products table not found in Supabase. Run the hypecheck_setup.sql setup script to provision the schema.",
      });
    }
  }

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase products list failed");
    return res.status(502).json({ message: `Unable to load products from Supabase (HTTP ${response.status}).` });
  }

  // PostgREST returns total count in Content-Range: 0-19/42
  const contentRange = response.headers.get("content-range") ?? "";
  const total = parseInt(contentRange.split("/")[1] ?? "-1", 10);

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const items = rows.map(toProductSummary);

  return res.json({ items, total: total >= 0 ? total : items.length });
});

// ---------------------------------------------------------------------------
// GET /products/:productId  – detail
// ---------------------------------------------------------------------------
router.get("/products/:productId", async (req, res) => {
  const { productId } = req.params;

  // Try product_summaries view first (has aggregates).
  let response = await pgProxy(
    `/rest/v1/product_summaries?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(SUMMARY_COLS)}&limit=1`,
  );

  if (response.status === 404) {
    // Fall back to base products table – no aggregates available.
    response = await pgProxy(
      `/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(FALLBACK_COLS)}&limit=1`,
    );

    if (response.status === 404) {
      req.log.error("products table not found in Supabase for detail lookup");
      return res.status(502).json({
        message:
          "products table not found in Supabase. Run the hypecheck_setup.sql setup script to provision the schema.",
      });
    }
  }

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase product detail failed");
    return res.status(502).json({ message: `Unable to load product from Supabase (HTTP ${response.status}).` });
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  if (!rows.length) {
    return res.status(404).json({ message: "Product not found." });
  }

  return res.json(toProductDetail(rows[0]));
});

// ---------------------------------------------------------------------------
// GET /products/:productId/reviews
// ---------------------------------------------------------------------------
router.get("/products/:productId/reviews", async (req, res) => {
  const { productId } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  // Verify the product exists first (head-check on products table).
  const productCheck = await pgProxy(
    `/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id&limit=1`,
  );

  if (productCheck.status === 404) {
    return res.status(502).json({
      message:
        "products table not found in Supabase. Run the hypecheck_setup.sql setup script to provision the schema.",
    });
  }

  if (!productCheck.ok) {
    req.log.error({ status: productCheck.status }, "Supabase product existence check failed");
    return res.status(502).json({ message: `Unable to verify product in Supabase (HTTP ${productCheck.status}).` });
  }

  const productRows = (await productCheck.json()) as Array<unknown>;
  if (!productRows.length) {
    return res.status(404).json({ message: "Product not found." });
  }

  const selectFields =
    "id,product_id,user_id,rating,worth_it,review_text,video_url,photo_url,created_at,profiles(username,avatar_url)";

  const response = await pgProxy(
    `/rest/v1/reviews?product_id=eq.${encodeURIComponent(productId)}&select=${encodeURIComponent(selectFields)}&limit=${limit}&offset=${offset}&order=created_at.desc`,
    { headers: { Prefer: "count=exact" } },
  );

  if (response.status === 404) {
    return res.status(502).json({
      message:
        "reviews table not found in Supabase. Run the hypecheck_setup.sql setup script to provision the schema.",
    });
  }

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase product reviews failed");
    return res.status(502).json({ message: `Unable to load reviews from Supabase (HTTP ${response.status}).` });
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const total = parseInt(contentRange.split("/")[1] ?? "-1", 10);

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const items = mapReviews(rows);

  return res.json({ items, total: total >= 0 ? total : items.length });
});

// ---------------------------------------------------------------------------
// Shared review row mapper (used by profile route too)
// ---------------------------------------------------------------------------
export function mapReviews(rows: Array<Record<string, unknown>>) {
  return rows.map((r) => {
    const profile = r.profiles as Record<string, unknown> | null | undefined;
    return {
      id: String(r.id ?? ""),
      productId: String(r.product_id ?? ""),
      userId: String(r.user_id ?? ""),
      rating: typeof r.rating === "number" ? r.rating : parseInt(String(r.rating ?? "0"), 10) || 0,
      worthIt: Boolean(r.worth_it),
      reviewText: String(r.review_text ?? ""),
      videoUrl: typeof r.video_url === "string" ? r.video_url : null,
      photoUrl: typeof r.photo_url === "string" ? r.photo_url : null,
      createdAt: String(r.created_at ?? ""),
      authorUsername: typeof profile?.username === "string" ? profile.username : null,
      authorAvatarUrl: typeof profile?.avatar_url === "string" ? profile.avatar_url : null,
    };
  });
}

export default router;
