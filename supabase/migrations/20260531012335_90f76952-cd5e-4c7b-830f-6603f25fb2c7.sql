
CREATE TABLE public.memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  profile_id uuid,
  title text NOT NULL,
  description text,
  memory_date date NOT NULL,
  memory_time time,
  location text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read memories" ON public.memories FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert memories" ON public.memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update memories" ON public.memories FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete memories" ON public.memories FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX idx_memories_owner_date ON public.memories (owner_id, memory_date);

INSERT INTO storage.buckets (id, name, public) VALUES ('memory-photos', 'memory-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Memory photos are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'memory-photos');

CREATE POLICY "Users upload own memory photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own memory photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own memory photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'memory-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
