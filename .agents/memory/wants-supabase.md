---
name: Wants persistence boundary
description: HypeCheck Wants currently depends on a Supabase want_list relation and real user identity before server persistence can be considered complete.
---

The Wants API boundary is implemented through the Supabase connector, but a missing `want_list` relation returns connector HTTP 404 and the app must clearly expose its local fallback rather than silently claiming cloud persistence.

**Why:** The development Supabase connection did not include the expected relation, and the app does not yet have real authentication/user identity wiring.

**How to apply:** Provision `want_list` with a unique `(user_id, product_id)` constraint and replace the demo user header before treating restart persistence as a verified Supabase behavior.