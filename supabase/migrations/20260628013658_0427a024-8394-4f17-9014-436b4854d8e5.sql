
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  profile_id UUID REFERENCES public.household_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  color TEXT NOT NULL DEFAULT '#7BA37A',
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members can view projects" ON public.projects FOR SELECT USING (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Household members can insert projects" ON public.projects FOR INSERT WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Household members can update projects" ON public.projects FOR UPDATE USING (public.is_household_member(owner_id, auth.uid())) WITH CHECK (public.is_household_member(owner_id, auth.uid()));
CREATE POLICY "Household members can delete projects" ON public.projects FOR DELETE USING (public.is_household_member(owner_id, auth.uid()));
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_steps TO authenticated;
GRANT ALL ON public.project_steps TO service_role;
ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members can view steps" ON public.project_steps FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_steps.project_id AND public.is_household_member(p.owner_id, auth.uid())));
CREATE POLICY "Household members can insert steps" ON public.project_steps FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_steps.project_id AND public.is_household_member(p.owner_id, auth.uid())));
CREATE POLICY "Household members can update steps" ON public.project_steps FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_steps.project_id AND public.is_household_member(p.owner_id, auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_steps.project_id AND public.is_household_member(p.owner_id, auth.uid())));
CREATE POLICY "Household members can delete steps" ON public.project_steps FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_steps.project_id AND public.is_household_member(p.owner_id, auth.uid())));
CREATE TRIGGER update_project_steps_updated_at BEFORE UPDATE ON public.project_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX projects_owner_idx ON public.projects(owner_id);
CREATE INDEX project_steps_project_idx ON public.project_steps(project_id);
