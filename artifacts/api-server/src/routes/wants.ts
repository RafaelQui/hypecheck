import { Router, type IRouter } from "express";
import { extractBearerToken, requireAuth, supabaseRootFetch } from "../lib/supabase";
import type { Request, Response as ExpressResponse } from "express";

const router: IRouter = Router();
const table = "/rest/v1/wants";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PostgrestError = {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
};

function userAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function readPostgrestError(response: globalThis.Response): Promise<PostgrestError> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    return {
      code: typeof body.code === "string" ? body.code : null,
      message: typeof body.message === "string" ? body.message : null,
      details: typeof body.details === "string" ? body.details : null,
      hint: typeof body.hint === "string" ? body.hint : null,
    };
  } catch {
    return { code: null, message: null, details: null, hint: null };
  }
}

async function sendPostgrestError(
  req: Request,
  res: ExpressResponse,
  operation: "load" | "save" | "remove" | "verify product" | "verify profile",
  response: globalThis.Response,
  context: { userId: string; productId?: string; tokenIncluded: boolean },
) {
  const error = await readPostgrestError(response);
  const diagnostic = {
    httpStatus: response.status,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    userId: context.userId,
    productId: context.productId ?? null,
    tokenIncluded: context.tokenIncluded,
  };
  req.log.error({ operation, supabase: diagnostic }, "Supabase Wants request failed");

  const exactMessage = [
    `Supabase Wants ${operation} failed (HTTP ${response.status})`,
    `code=${error.code ?? "none"}`,
    `message=${error.message ?? "none"}`,
    `details=${error.details ?? "none"}`,
    `hint=${error.hint ?? "none"}`,
  ].join("; ");

  return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
    message: exactMessage,
    supabase: diagnostic,
  });
}

router.get("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const token = extractBearerToken(req)!;
  const response = await supabaseRootFetch(
    `${table}?select=product_id,created_at&user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`,
    { headers: userAuthHeaders(token) },
  );

  if (!response.ok) {
    return sendPostgrestError(req, res, "load", response, {
      userId: user.id,
      tokenIncluded: Boolean(token),
    });
  }

  const rows = (await response.json()) as Array<{ product_id: string; created_at: string }>;
  return res.json({
    items: rows.map((row) => ({ productId: row.product_id, createdAt: row.created_at })),
  });
});

router.post("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });
  if (!uuidPattern.test(productId)) {
    return res.status(400).json({
      message: "productId must be a real UUID from public.products; a local/mock product ID was received.",
      diagnostic: { productId, userId: user.id },
    });
  }

  const token = extractBearerToken(req)!;
  const context = { userId: user.id, productId, tokenIncluded: Boolean(token) };

  const [profileResponse, productResponse] = await Promise.all([
    supabaseRootFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`, {
      headers: userAuthHeaders(token),
    }),
    supabaseRootFetch(`/rest/v1/products?id=eq.${encodeURIComponent(productId)}&select=id&limit=1`, {
      headers: userAuthHeaders(token),
    }),
  ]);

  if (!profileResponse.ok) {
    return sendPostgrestError(req, res, "verify profile", profileResponse, context);
  }
  const profileRows = (await profileResponse.json()) as Array<{ id: string }>;
  if (profileRows[0]?.id !== user.id) {
    return res.status(409).json({
      message: "Verified Supabase user UUID does not have a matching public.profiles.id row.",
      diagnostic: context,
    });
  }

  if (!productResponse.ok) {
    return sendPostgrestError(req, res, "verify product", productResponse, context);
  }
  const productRows = (await productResponse.json()) as Array<{ id: string }>;
  if (productRows[0]?.id !== productId) {
    return res.status(404).json({
      message: "The requested product UUID does not exist in public.products.",
      diagnostic: context,
    });
  }

  const existingResponse = await supabaseRootFetch(
    `${table}?select=product_id,created_at&user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(productId)}&limit=1`,
    { headers: userAuthHeaders(token) },
  );
  if (!existingResponse.ok) {
    return sendPostgrestError(req, res, "load", existingResponse, context);
  }
  const existingRows = (await existingResponse.json()) as Array<{ product_id: string; created_at: string }>;
  if (existingRows.length) {
    return res.status(200).json({
      productId: existingRows[0].product_id,
      createdAt: existingRows[0].created_at,
      alreadySaved: true,
      diagnostic: { ...context, rlsPassed: true },
    });
  }

  const response = await supabaseRootFetch(table, {
    method: "POST",
    headers: {
      ...userAuthHeaders(token),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({ user_id: user.id, product_id: productId }),
  });

  if (!response.ok) {
    return sendPostgrestError(req, res, "save", response, context);
  }

  const insertedRows = (await response.json()) as Array<{ product_id: string; created_at: string }>;
  if (!insertedRows.length) {
    return res.status(409).json({
      message: "Supabase accepted the Wants request but did not return an inserted row; the unique (user_id, product_id) constraint may already match an existing Want.",
      diagnostic: context,
    });
  }

  return res.status(201).json({
    productId: insertedRows[0].product_id,
    createdAt: insertedRows[0].created_at,
    diagnostic: { ...context, rlsPassed: true, inserted: true },
  });
});

router.delete("/wants", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const productId = typeof req.query.productId === "string" ? req.query.productId : "";
  if (!productId) return res.status(400).json({ message: "productId is required." });

  const token = extractBearerToken(req)!;
  const response = await supabaseRootFetch(
    `${table}?user_id=eq.${encodeURIComponent(user.id)}&product_id=eq.${encodeURIComponent(productId)}`,
    { method: "DELETE", headers: userAuthHeaders(token) },
  );

  if (!response.ok) {
    return sendPostgrestError(req, res, "remove", response, {
      userId: user.id,
      productId,
      tokenIncluded: Boolean(token),
    });
  }

  return res.status(204).send();
});

export default router;
