---
name: HypeCheck data boundary
description: Durable architectural decision for the HypeCheck Expo prototype.
---

The first HypeCheck mobile build is intentionally local-first: seeded product and review content lives in the app, and Wants are persisted with AsyncStorage so the swipe loop works immediately in Expo Go. Supabase is connected to the environment for the next persistence pass.

**Why:** Expo Go should not expose server-side connector credentials, and the first user-visible milestone is a fast, reliable discovery experience rather than a backend migration.

**How to apply:** Add Supabase-backed auth and CRUD through the shared API/server boundary when persistence work begins; keep the current local seed as a graceful offline/demo fallback.