-- Security fixes from audit MEA-196
-- C-1: Prevent privilege escalation — lock role column for non-admin users
-- M-1: Add SET search_path to are_friends() security definer function

-- ── C-1: Fix privilege escalation via role self-update ──────────────────────
-- The original policy allowed any authenticated user to update any column
-- in their own profile, including the role column (added in migration 12).
-- This replacement policy prevents role changes unless the user is already an admin.

DROP POLICY IF EXISTS "profiles: owner can update" ON public.profiles;
CREATE POLICY "profiles: owner can update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- ── M-1: Lock search_path on security-definer function ──────────────────────
CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid)
RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = user_a AND addressee_id = user_b)
           OR (requester_id = user_b AND addressee_id = user_a))
  );
$$;
