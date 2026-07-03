
-- 1) memory-photos: private bucket policies (user-scoped folder = auth.uid()/...)
DROP POLICY IF EXISTS "memory-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Public read memory-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view memory-photos" ON storage.objects;

CREATE POLICY "memory-photos: owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "memory-photos: owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "memory-photos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "memory-photos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2) Lock down SECURITY DEFINER functions.
-- Triggers do not need EXECUTE privileges for the calling role, so revoke fully.
REVOKE ALL ON FUNCTION public.handle_new_user_household()       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_birthday_event()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_contact_birthday_event()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_contact_birthday_event()  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()        FROM PUBLIC, anon, authenticated;

-- Helper used inside RLS policies: must be callable by authenticated, but not anon.
REVOKE ALL ON FUNCTION public.is_household_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_household_member(uuid, uuid) TO authenticated;

-- Invitation RPCs: signed-in users only.
REVOKE ALL ON FUNCTION public.accept_invitation(text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, text, text, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;
