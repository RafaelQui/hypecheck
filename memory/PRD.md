# HypeCheck — Product Requirements

## Original Problem Statement
User (existing project imported from Replit → GitHub → Emergent). Requested to
build/improve the main Discover swipe screen for the HypeCheck mobile app.

## Architecture
- **pnpm monorepo** in `/app` (workspace: 9 projects).
- **Mobile app:** `artifacts/hypecheck` — Expo Router + React Native + TS.
- **API server:** `artifacts/api-server` — Express 5 on port 5000.
- **Data:** Supabase (PostgreSQL) via `lib/db` + Drizzle ORM.
- **Contracts:** OpenAPI spec in `lib/api-spec`, generated Zod + React Query
  hooks in `lib/api-client-react`.

## User Personas
- **Shopper:** swipes through products, saves Wants, reads reviews.
- **Reviewer:** posts photo/video reviews with "Worth the Hype" verdict.

## Core Requirements (static)
1. Full-screen swipeable product cards on Discover.
2. Card must display: image, name, price, star rating, "Worth the Hype" %,
   review snippet + reviewer.
3. Left-swipe = Pass, right-swipe = Wants (with tap-backup buttons).
4. Tap card → Product Detail page.
5. Real Supabase data when reachable; graceful fallback to placeholders.

## What's Implemented (2026-08-26)
- ✅ Polished Discover swipe card (full-image hero + gradient scrim,
  floating Worth-the-Hype chip, category pill, price+rating row, embedded
  reviewer quote card with Follow toggle).
- ✅ Placeholder-product fallback when Supabase API isn't reachable.
- ✅ Wants work in-memory when no Supabase session (placeholder mode).
- ✅ 3-button action row: Pass (X) / Info / Want (heart) with press feedback.
- ✅ Product Detail supports placeholder products (image, reviews, worth-the-
  hype, star rating).
- ✅ Expo web preview runs on port 3000 (Emergent-hosted preview URL).
- ✅ API base URL only set when `EXPO_PUBLIC_DOMAIN` is present (Replit path);
  omitted safely on Emergent web preview.

## Backlog (P0/P1/P2)
- **P1** Wire up real product images via Supabase Storage when catalog present.
- **P1** Persist "Wants" in placeholder mode via AsyncStorage so refresh keeps them.
- **P2** Add filter drawer (category / price / min rating).
- **P2** "Undo last swipe" button.
- **P2** AI-generated review summary on Detail page.

## Preview URLs
- **Emergent web preview:** https://6cb5531a-f966-41ef-94ef-ecb8a7f82a86.preview.emergentagent.com
- **On Replit / phone (Expo Go):** run `pnpm --filter @workspace/hypecheck dev`
  in the Replit shell → scan the QR code with Expo Go.
