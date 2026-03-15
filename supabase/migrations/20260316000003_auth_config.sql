-- ─── Auth configuration notes ────────────────────────────────────────────────
-- These settings are managed via the Supabase Dashboard:
--   Authentication > Providers > Email
--   Authentication > Providers > (OAuth providers)
--
-- Enable in the dashboard:
--   ✓ Email + password sign-up
--   ✓ Magic link (passwordless email)
--   ✓ Confirm email (recommended for production)
--
-- Optionally enable OAuth:
--   ✓ Google (requires Google Cloud credentials)
--   ✓ Apple  (requires Apple Developer credentials)
--
-- Site URL (set in Authentication > URL Configuration):
--   Development : http://localhost:5173
--   Production  : https://your-domain.com
--
-- Redirect URLs (also in URL Configuration — add both):
--   http://localhost:5173/**
--   https://your-domain.com/**

-- Rate limits on sensitive operations (adjust in Dashboard > Auth > Rate Limits):
--   Sign-ups             : 3 per hour per IP
--   Magic link emails    : 3 per hour per email
--   Password resets      : 3 per hour per email

-- ─── Storage bucket for recipe images ────────────────────────────────────────
-- Create a public bucket called "recipe-images" in Storage > Buckets.
-- Then run the policies below.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict do nothing;

-- Authenticated users can upload to their own folder (user_id/filename).
create policy "recipe-images: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can read public recipe images.
create policy "recipe-images: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');

-- Users can delete their own uploads.
create policy "recipe-images: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
