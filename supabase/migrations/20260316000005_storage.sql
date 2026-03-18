-- ─── Storage: recipe-images bucket and RLS policies ──────────────────────────
-- Public bucket: any authenticated user can read; users write only their own folder.
-- Path convention: {user_id}/{recipe_id}/original.webp  (full image)
--                  {user_id}/{recipe_id}/thumb.webp      (thumbnail)

-- ─── Create bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,  -- 5 MB max per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

-- ─── Storage policies ─────────────────────────────────────────────────────────
-- Use drop-if-exists + create to be idempotent (public buckets auto-create
-- a default SELECT policy in some Supabase versions).

-- Public read (the bucket is public, but be explicit).
drop policy if exists "recipe-images: public read" on storage.objects;
create policy "recipe-images: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'recipe-images');

-- Authenticated users can upload to their own folder only.
-- Path must start with the caller's user ID.
drop policy if exists "recipe-images: owner can upload" on storage.objects;
create policy "recipe-images: owner can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can replace (upsert) their own images.
drop policy if exists "recipe-images: owner can update" on storage.objects;
create policy "recipe-images: owner can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own images.
drop policy if exists "recipe-images: owner can delete" on storage.objects;
create policy "recipe-images: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
