# HypeCheck — Test Credentials

## Emergent Web Preview (Demo Mode)
- URL: https://6cb5531a-f966-41ef-94ef-ecb8a7f82a86.preview.emergentagent.com
- Demo mode is auto-enabled when `EXPO_PUBLIC_DOMAIN` is unset (i.e. the
  Emergent web preview environment).
- **Any email + any 6+ character password** signs you in with a
  client-side-only session. Suggested test creds:
  - Email: `demo@hypecheck.dev`
  - Password: `Password123!`
- The session is persisted in `localStorage` under
  `hypecheck_supabase_session` and survives page refreshes.

## Replit / Production (real Supabase auth)
When `EXPO_PUBLIC_DOMAIN` is set, the app routes auth calls to the running
Express API server at `https://$EXPO_PUBLIC_DOMAIN/api/auth/*`, which in turn
uses Supabase. Real accounts must be created there — no shared credentials
exist for the production Supabase project.

## Clearing state
To reset the app state in the web preview, run in the browser DevTools console:
```
localStorage.clear(); location.reload();
```
