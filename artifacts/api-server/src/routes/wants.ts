import { Router, type IRouter, type Request } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const table = "/rest/v1/want_list";

function userId(req: Request) {
  return req.header("x-hypecheck-user-id") || "demo-user";
}

router.get("/wants", async (req, res) => {
  const response = await connectors.proxy(
    "supabase",
    `${table}?select=product_id,created_at&user_id=eq.${encodeURIComponent(userId(req))}&order=created_at.desc`,
    { method: "GET" },
  );
  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants read failed");
    return res.status(502).json({ message: "Unable to load Wants from Supabase." });
  }
  const rows = (await response.json()) as Array<{ product_id: string; created_at: string }>;
  return res.json({ items: rows.map((row) => ({ productId: row.product_id, createdAt: row.created_at })) });
});

router.post("/wants", async (req, res) => {
  const productId = typeof req.body?.productId === "string" ? req.body.productId : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });
  const response = await connectors.proxy("supabase", table, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ user_id: userId(req), product_id: productId }),
  });
  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants save failed");
    return res.status(502).json({ message: "Unable to save Want to Supabase." });
  }
  return res.status(201).json({ productId, createdAt: new Date().toISOString() });
});

router.delete("/wants", async (req, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });
  const response = await connectors.proxy(
    "supabase",
    `${table}?user_id=eq.${encodeURIComponent(userId(req))}&product_id=eq.${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    req.log.error({ status: response.status }, "Supabase wants delete failed");
    return res.status(502).json({ message: "Unable to remove Want from Supabase." });
  }
  return res.status(204).send();
});

export default router;