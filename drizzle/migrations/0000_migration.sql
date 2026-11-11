DROP POLICY IF EXISTS "Memory photos are publicly viewable" ON storage.objects;
CREATE POLICY "memory-photos: household members view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'memory-photos' AND EXISTS (
    SELECT 1 FROM public.memories m
    WHERE (m.photo_url = storage.objects.name OR m.photo_url LIKE '%/memory-photos/' || storage.objects.name)
      AND public.is_household_member(m.owner_id, auth.uid())
  )
);