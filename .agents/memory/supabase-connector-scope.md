---
name: Supabase connector scope
description: Documents the current connector boundary between PostgREST data access and unavailable Auth/Storage endpoints.
---

The configured Supabase connector is scoped to the PostgREST data API: table and view paths resolve relative to its REST base, while `/auth/v1/*` and `/storage/v1/*` calls return a PostgREST invalid-path response. Auth and Storage must use the project-root URL and publishable key held only by the API server.

**Why:** Product reads are live through the connector, but signup, bearer-token verification, signed media uploads, and Storage inspection require Supabase project-root endpoints. The Expo client must not receive a service-role key.

**How to apply:** Keep database-table requests on the connector's REST base. Route Auth and Storage through server-side project-root requests with the publishable key; derive identity from the caller's bearer token and return only sessions or signed/public media URLs to Expo.

For RLS-protected tables, use the server-side project-root PostgREST API as well. The connector proxy can accept a bearer header without making it the JWT evaluated by `auth.uid()`, which causes valid authenticated writes to fail RLS.

**Why:** A verified live Wants request included the user's bearer token but received PostgREST `42501` until it used the project-root `/rest/v1` request with both the publishable key and user bearer token.

**How to apply:** Keep public catalog reads on the connector if desired, but make authenticated reads and writes through `supabaseRootFetch` with `Authorization: Bearer <caller token>`.