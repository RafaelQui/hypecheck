---
name: Supabase connector scope
description: Documents the current connector boundary between PostgREST data access and unavailable Auth/Storage endpoints.
---

The configured Supabase connector is scoped to the PostgREST data API: table and view paths resolve relative to its REST base, while `/auth/v1/*` and `/storage/v1/*` calls return a PostgREST invalid-path response.

**Why:** Product reads are live through the connector, but signup, bearer-token verification, signed media uploads, and Storage inspection cannot be verified or used through this connection alone.

**How to apply:** Normalize database-table requests for the connector’s REST base. Before claiming authentication or media flows are live, use a connection mechanism that can reach the Supabase project-root Auth and Storage APIs without exposing a service-role key to Expo.