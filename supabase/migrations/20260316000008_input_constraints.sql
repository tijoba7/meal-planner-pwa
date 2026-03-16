-- ─── Input validation constraints ────────────────────────────────────────────
-- Enforce field length limits and content rules at the database layer.
-- These mirror RECIPE_FIELD_LIMITS in src/lib/validation.ts — keep in sync.

-- ─── profiles ────────────────────────────────────────────────────────────────

alter table public.profiles
  add constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 100),
  add constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 500),
  add constraint profiles_avatar_url_length
    check (avatar_url is null or char_length(avatar_url) <= 2048);

-- ─── recipes_cloud ────────────────────────────────────────────────────────────
-- The `data` column is jsonb. Enforce a reasonable size cap to prevent
-- oversized payloads from being stored (protects storage and query perf).

alter table public.recipes_cloud
  add constraint recipes_cloud_data_size
    check (octet_length(data::text) <= 524288); -- 512 KiB per recipe

-- ─── friendships ─────────────────────────────────────────────────────────────
-- No additional field length constraints needed; PKs and enums already enforce integrity.

-- ─── reactions ───────────────────────────────────────────────────────────────

alter table public.reactions
  add constraint reactions_emoji_code_length
    check (emoji_code is null or char_length(emoji_code) <= 20);

-- ─── comments ────────────────────────────────────────────────────────────────
-- Already has: check (char_length(body) between 1 and 4000) from initial schema.

-- ─── notifications ───────────────────────────────────────────────────────────

alter table public.notifications
  add constraint notifications_type_length
    check (char_length(type) between 1 and 100),
  add constraint notifications_payload_size
    check (octet_length(payload::text) <= 65536); -- 64 KiB per notification

-- ─── households (from migration 20260316000006) ───────────────────────────────
-- The household name constraint (1-100 chars) was added in migration 6.
-- No additional constraints needed here.
