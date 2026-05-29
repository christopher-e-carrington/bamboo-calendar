
-- Profiles within a household (owned by an auth user)
create table public.household_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'shared' check (role in ('parent','kid','shared')),
  color text not null default '#7BA37A',
  initials text not null default 'FA',
  pin text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index household_profiles_owner_idx on public.household_profiles(owner_id);

grant select, insert, update, delete on public.household_profiles to authenticated;
grant all on public.household_profiles to service_role;

alter table public.household_profiles enable row level security;

create policy "Owners read profiles"
  on public.household_profiles for select to authenticated
  using (auth.uid() = owner_id);
create policy "Owners insert profiles"
  on public.household_profiles for insert to authenticated
  with check (auth.uid() = owner_id);
create policy "Owners update profiles"
  on public.household_profiles for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners delete profiles"
  on public.household_profiles for delete to authenticated
  using (auth.uid() = owner_id);

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.household_profiles(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create index events_owner_idx on public.events(owner_id);
create index events_profile_idx on public.events(profile_id);
create index events_start_idx on public.events(start_at);

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

alter table public.events enable row level security;

create policy "Owners read events"
  on public.events for select to authenticated using (auth.uid() = owner_id);
create policy "Owners insert events"
  on public.events for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners update events"
  on public.events for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners delete events"
  on public.events for delete to authenticated using (auth.uid() = owner_id);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.household_profiles(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create index tasks_owner_idx on public.tasks(owner_id);
create index tasks_profile_idx on public.tasks(profile_id);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

create policy "Owners read tasks"
  on public.tasks for select to authenticated using (auth.uid() = owner_id);
create policy "Owners insert tasks"
  on public.tasks for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners update tasks"
  on public.tasks for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Owners delete tasks"
  on public.tasks for delete to authenticated using (auth.uid() = owner_id);

-- Seed default profiles on signup
create or replace function public.handle_new_user_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_profiles (owner_id, name, role, color, initials, sort_order) values
    (new.id, 'Family',  'shared', '#7BA37A', 'FA', 0),
    (new.id, 'Mom',     'parent', '#A7C29A', 'MO', 1),
    (new.id, 'Dad',     'parent', '#C9A36B', 'DA', 2),
    (new.id, 'Kid',     'kid',    '#E8B774', 'K1', 3),
    (new.id, 'Kitchen', 'shared', '#9CB89A', 'KI', 4);
  return new;
end;
$$;

create trigger on_auth_user_created_household
after insert on auth.users
for each row execute function public.handle_new_user_household();
