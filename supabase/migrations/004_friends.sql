-- Friends / connections system

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "friendships_select" ON public.friendships FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

CREATE POLICY "friendships_insert" ON public.friendships FOR INSERT WITH CHECK (
  auth.uid() = requester_id
);

-- Only addressee can accept (update pending → accepted)
CREATE POLICY "friendships_update" ON public.friendships FOR UPDATE USING (
  auth.uid() = addressee_id AND status = 'pending'
);

-- Either party can delete (cancel request or remove friend)
CREATE POLICY "friendships_delete" ON public.friendships FOR DELETE USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
