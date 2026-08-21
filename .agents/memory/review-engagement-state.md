---
name: Review engagement state
description: Keeping Helpful controls accurate when review engagement is shared data.
---

When rendering a per-user review action, return both the aggregate count and the authenticated viewer's own relationship state.

**Why:** A count cannot tell whether the current user has already voted. Treating every review as unvoted after reload makes an active Helpful button appear inactive and prevents a reliable remove action.

**How to apply:** Keep review reads public for aggregate data, but use an optional verified bearer token to enrich each review with the viewer's existing vote. Optimistic UI should update the query cache and roll back on a failed mutation, then revalidate.