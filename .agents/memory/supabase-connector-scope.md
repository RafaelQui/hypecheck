---
name: Supabase connector scope
description: Documents the current connector boundary between PostgREST data access and unavailable Auth/Storage endpoints.
---

The configured Supabase connector is scoped to the PostgREST data API: table and view paths resolve relative to its REST base, while `/auth/v1/*` and `/storage/v1/*` calls return a PostgREST invalid-path response. Auth and Storage must use the project-root URL and publishable key held only by the API server.

**Why:** Product reads are live through the connector, but signup, bearer-token verification, signed media uploads, and Storage inspection require Supabase project-root endpoints. The Expo client must not receive a service-role key.

**How to apply:** Keep database-table requests on the connector's REST base. Route Auth and Storage through server-side project-root requests with the publishable key; derive identity from the caller's bearer token and return only sessions or signed/public media URLs to Expo.