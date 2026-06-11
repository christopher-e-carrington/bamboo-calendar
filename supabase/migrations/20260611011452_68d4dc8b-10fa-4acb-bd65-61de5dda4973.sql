
CREATE POLICY "Members read household documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_household_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "Members upload household documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.is_household_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "Members update household documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_household_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
CREATE POLICY "Members delete household documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND public.is_household_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
