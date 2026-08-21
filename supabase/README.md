# HypeCheck Supabase setup

Run `hypecheck_setup.sql` in the connected Supabase project's SQL Editor before testing cloud persistence. It creates the product, profile, review, Want, social, and Storage structures expected by the HypeCheck API.

The setup intentionally enables row-level security and uses `auth.uid()` for every user-owned write. The Expo app does not contain a Supabase service-role key; it receives a normal user session from the API and uses short-lived signed upload URLs for review media.

After the SQL finishes, create a test account in the app or use the onboarding sign-up form. If email confirmation is enabled for the Supabase project, confirm the email first and then sign in.