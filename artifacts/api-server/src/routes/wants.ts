import { Router, type IRouter } from "express";
import { extractBearerToken, pgProxyAuth, requireAuth } from "../lib/supabase";

const router: IRouter = Router();
const table = "/rest/v1/wants";

router.get("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const token = extractBearerToken(req)!;
  const response = await pgProxyAuth(
    `${table}?select=product_id,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
    token,
  );

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants read failed");
    return res.status(502).json({ message: "Unable to load Wants from Supabase." });
  }

  const rows = (await response.json()) as Array<{ product_id: string; created_at: string }>;
  return res.json({
    items: rows.map((row) => ({ productId: row.product_id, createdAt: row.created_at })),
  });
});

router.post("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const productId = typeof req.body?.productId === "string" ? req.body.productId : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });

  const token = extractBearerToken(req)!;
  const response = await pgProxyAuth(table, token, {
    method: "POST",
    headers: {
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ user_id: user.id, product_id: productId }),
  });

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants save failed");
    return res.status(502).json({ message: "Unable to save Want to Supabase." });
  }

  return res.status(201).json({ productId, createdAt: new Date().toISOString() });
});

router.delete("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });

  const token = extractBearerToken(req)!;
  const response = await pgProxyAuth(
    `${table}?user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(productId)}`,
    token,
    { method: "DELETE" },
  );

  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants delete failed");
    return res.status(502).json({ message: "Unable to remove Want from Supabase." });
  }

  return res.status(204).send();
});

export default router;
