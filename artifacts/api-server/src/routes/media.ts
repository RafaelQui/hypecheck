import { Router, type IRouter } from "express";
import { connectors, extractBearerToken, requireAuth } from "../lib/supabase";

const router: IRouter = Router();

const ALLOWED_BUCKETS = new Set(["review-images", "review-videos", "avatars"]);

/**
 * POST /media/upload-url
 *
 * Returns a signed upload URL for Supabase Storage so the client can PUT
 * directly without going through our server.  We never expose the
 * service-role key; the signed URL comes from the Supabase Storage API
 * proxied through the connector.
 */
router.post("/media/upload-url", async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;

  const b = req.body as Record<string, unknown>;

  const bucket = typeof b.bucket === "string" ? b.bucket : "";
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return res.status(400).json({
      message: `bucket must be one of: ${[...ALLOWED_BUCKETS].join(", ")}.`,
    });
  }

  const filename = typeof b.filename === "string" ? b.filename.trim() : "";
  if (!filename) {
    return res.status(400).json({ message: "filename is required." });
  }

  const contentType =
    typeof b.contentType === "string" ? b.contentType : "application/octet-stream";

  // Build a namespaced storage path so files are segregated per user.
  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
  const storagePath = `${user.id}/${Date.now()}${ext}`;

  const token = extractBearerToken(req)!;

  let response: Awaited<ReturnType<typeof connectors.proxy>>;
  try {
    response = await connectors.proxy(
      "supabase",
      `/storage/v1/object/upload/sign/${bucket}/${storagePath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ expiresIn: 600 }),
      },
    );
  } catch {
    return res
      .status(502)
      .json({ message: "Unable to reach Supabase Storage. Check connector configuration." });
  }

  if (!response.ok) {
    req.log.error({ status: response.status, bucket }, "Supabase storage signed-url failed");

    let detail = "";
    try {
      const errBody = (await response.json()) as Record<string, unknown>;
      detail = typeof errBody.message === "string" ? errBody.message : "";
    } catch {
      // ignore parse failures
    }

    return res.status(502).json({
      message: detail
        ? `Supabase Storage returned ${response.status}: ${detail}`
        : `Supabase Storage returned ${response.status}. The bucket "${bucket}" may not exist or RLS may deny access.`,
    });
  }

  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return res.status(502).json({ message: "Supabase Storage returned an unparseable response." });
  }

  // Supabase Storage response casing varies by endpoint/version. The connector
  // commonly returns `url`, which is a relative Storage URL; normalize it into
  // a signed URL that Expo can PUT to directly.
  const rawSignedUrl =
    typeof data.signedURL === "string"
      ? data.signedURL
      : typeof data.signedUrl === "string"
        ? data.signedUrl
        : typeof data.url === "string"
          ? data.url
          : null;
  if (!rawSignedUrl) {
    return res.status(502).json({ message: "Supabase Storage did not return a signed URL." });
  }

  let uploadUrl = rawSignedUrl;
  let publicBaseUrl: string | null = null;
  if (!/^https?:\/\//i.test(rawSignedUrl)) {
    try {
      const config = await connectors.getCliConfig("supabase");
      publicBaseUrl = config.host.replace(/\/$/, "");
      const storagePathname = rawSignedUrl.startsWith("/storage/v1/")
        ? rawSignedUrl
        : `/storage/v1${rawSignedUrl.startsWith("/") ? "" : "/"}${rawSignedUrl}`;
      uploadUrl = `${publicBaseUrl}${storagePathname}`;
    } catch {
      return res.status(502).json({
        message: "Supabase Storage returned a relative signed URL, but its public host could not be resolved.",
      });
    }
  } else {
    try {
      publicBaseUrl = new URL(rawSignedUrl).origin;
    } catch {
      // The URL has already passed an http(s) check; retain it if parsing fails.
    }
  }

  if (!publicBaseUrl) {
    return res.status(502).json({
      message: "Supabase Storage returned a signed URL without a usable public host.",
    });
  }
  const mediaUrl = `${publicBaseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;

  return res.json({
    uploadUrl,
    storagePath,
    mediaUrl,
    expiresIn: 600,
  });
});

export default router;
