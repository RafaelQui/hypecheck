/**
 * Supabase connector helpers.
 *
 * All access goes through @replit/connectors-sdk proxying to the "supabase"
 * connector.  Identity is always derived from the caller's Authorization Bearer
 * token – never from a caller-supplied header or demo fallback.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Request, Response } from "express";

const connectors = new ReplitConnectors();

// Re-export the shared connectors instance so routes don't create their own.
export { connectors };

/**
 * Extract the Bearer token from a request's Authorization header.
 * Returns null when absent or malformed.
 */
export function extractBearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? req.header("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export interface SupabaseUser {
  id: string;
  email: string;
}

export interface AuthError {
  status: number;
  message: string;
}

/**
 * Verify the Bearer token with Supabase /auth/v1/user and return the
 * authenticated user.  Never falls back to demo-user or trusts any
 * caller-supplied user-id.
 *
 * On success returns { user }.
 * On failure returns { error } with an appropriate HTTP status.
 */
export async function getAuthUser(
  req: Request,
): Promise<{ user: SupabaseUser } | { error: AuthError }> {
  const token = extractBearerToken(req);
  if (!token) {
    return { error: { status: 401, message: "Authorization Bearer token is required." } };
  }

  let response: Awaited<ReturnType<typeof connectors.proxy>>;
  try {
    response = await connectors.proxy("supabase", "/auth/v1/user", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return { error: { status: 502, message: "Unable to reach Supabase Auth. Check connector configuration." } };
  }

  if (response.status === 401 || response.status === 403) {
    return { error: { status: 401, message: "Invalid or expired token." } };
  }

  if (!response.ok) {
    return { error: { status: 502, message: `Supabase Auth returned ${response.status}.` } };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { error: { status: 502, message: "Supabase Auth returned an unparseable response." } };
  }

  const d = data as Record<string, unknown>;
  const id = typeof d.id === "string" ? d.id : null;
  const email = typeof d.email === "string" ? d.email : null;

  if (!id || !email) {
    return { error: { status: 502, message: "Supabase Auth user payload missing id or email." } };
  }

  return { user: { id, email } };
}

/**
 * Convenience: resolve auth and send a 401/502 if it fails.
 * Returns the user, or null if the response was already sent.
 */
export async function requireAuth(
  req: Request,
  res: Response,
): Promise<SupabaseUser | null> {
  const result = await getAuthUser(req);
  if ("error" in result) {
    res.status(result.error.status).json({ message: result.error.message });
    return null;
  }
  return result.user;
}

/**
 * Proxy a PostgREST REST request, attaching the user's token so RLS policies
 * are evaluated server-side.  The token is sent as the apikey + Authorization
 * header pair that PostgREST expects for JWT auth.
 */
export async function pgProxy(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<Awaited<ReturnType<typeof connectors.proxy>>> {
  const { method = "GET", headers = {}, body } = options;
  return connectors.proxy("supabase", path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body !== undefined ? { body } : {}),
  });
}

/**
 * Proxy a PostgREST REST request with the user's JWT so Supabase RLS runs as
 * that user.  PostgREST honours Bearer tokens for row-level security.
 */
export async function pgProxyAuth(
  path: string,
  token: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<Awaited<ReturnType<typeof connectors.proxy>>> {
  const { method = "GET", headers = {}, body } = options;
  return connectors.proxy("supabase", path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    ...(body !== undefined ? { body } : {}),
  });
}
