-- Fix infinite recursion in group_members and groups RLS policies
-- Root cause: group_members_select queries group_members (self-reference),
-- and groups_select_member queries group_members which then loops.
-- Fix: security definer function skips RLS when checking membership.

CREATE OR REPLACE FUNCTION public.current_user_is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

-- group_members: drop recursive policy, replace with non-recursive one
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
CREATE POLICY "group_members_select" ON public.group_members FOR SELECT USING (
  user_id = auth.uid()
  OR public.current_user_is_group_member(group_id)
);

-- groups: drop policy that referenced group_members (triggered the loop), replace
DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
CREATE POLICY "groups_select_member" ON public.groups FOR SELECT USING (
  created_by = auth.uid()
  OR public.current_user_is_group_member(id)
);
