/**
 * Supabase connector helpers.
 *
 * Database reads go through the Replit Supabase PostgREST connector. Auth and
 * Storage use the project-root API with the publishable key held in server
 * secrets. Identity is always derived from the caller's Authorization Bearer
 * token – never from a caller-supplied header or demo fallback.
 */

import { ReplitConnectors } from "@replit/connectors-sdk";
import type { Request, Response as ExpressResponse } from "express";

const connectors = new ReplitConnectors();

// Re-export the shared connectors instance so routes don't create their own.
export { connectors };

function getSupabaseProjectUrl(): string {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error("SUPABASE_URL is not configured.");

  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be the Supabase project root URL.");
  }
  return url.origin;
}

function getSupabasePublishableKey(): string {
  const value = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  if (!value) throw new Error("SUPABASE_PUBLISHABLE_KEY is not configured.");
  return value;
}

/**
 * Calls a Supabase project-root API (Auth or Storage). The publishable key
 * remains server-side; Expo only receives its own session or a signed URL.
 */
export async function supabaseRootFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/")) throw new Error("Supabase API paths must start with '/'.");

  const headers = new Headers(options.headers);
  headers.set("apikey", getSupabasePublishableKey());

  return fetch(`${getSupabaseProjectUrl()}${path}`, {
    ...options,
    headers,
  });
}

export function getSupabasePublicUrl(): string {
  return getSupabaseProjectUrl();
}

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

  let response: Response;
  try {
    response = await supabaseRootFetch("/auth/v1/user", {
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
  res: ExpressResponse,
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
  // This workspace's Supabase connection is configured with `/rest/v1` as its
  // base URL. Keep routes expressive while avoiding a duplicated REST prefix.
  const dataPath = path.replace(/^\/rest\/v1(?=\/|\?)/, "") || "/";
  return connectors.proxy("supabase", dataPath, {
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
  const dataPath = path.replace(/^\/rest\/v1(?=\/|\?)/, "") || "/";
  return connectors.proxy("supabase", dataPath, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    ...(body !== undefined ? { body } : {}),
  });
}
