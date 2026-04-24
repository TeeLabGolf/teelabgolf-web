-- ============================================================
-- TeeLab AI — Initial Database Schema
-- Supabase (PostgreSQL)
-- Idempotent: uses IF NOT EXISTS throughout
-- ============================================================

-- 1. users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  code int unique not null,
  name text not null,
  announcement text,
  owner_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. group_members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- 4. group_join_requests
create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- 5. courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  hole_count int not null check (hole_count in (9, 18)),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. course_holes
create table if not exists public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  hole_number int not null check (hole_number >= 1 and hole_number <= 18),
  par int not null default 4 check (par >= 3 and par <= 5),
  unique (course_id, hole_number)
);

-- 7. course_tees
create table if not exists public.course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  unique (course_id, name)
);

-- 8. tee_times
create table if not exists public.tee_times (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  course_tee_id uuid references public.course_tees(id),
  created_by uuid not null references public.users(id),
  tee_off_at timestamptz not null,
  starting_hole int not null default 1 check (starting_hole in (1, 10)),
  max_players int not null check (max_players > 0),
  price decimal,
  currency text default 'USD',
  notes text,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. tee_time_players
create table if not exists public.tee_time_players (
  id uuid primary key default gen_random_uuid(),
  tee_time_id uuid not null references public.tee_times(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'waitlisted', 'withdrawn')),
  signed_up_at timestamptz not null default now(),
  unique (tee_time_id, user_id)
);

-- 10. rounds
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  tee_time_id uuid not null references public.tee_times(id) on delete cascade,
  format text not null default 'stroke' check (format in ('stroke', 'match', '2v2')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- 11. scores
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.users(id),
  hole_number int not null check (hole_number >= 1 and hole_number <= 18),
  strokes int not null check (strokes > 0),
  scored_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, player_id, hole_number)
);

-- 12. notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_groups_code on public.groups(code);
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_join_requests_group_status on public.group_join_requests(group_id, status);
create index if not exists idx_courses_status on public.courses(status);
create index if not exists idx_tee_times_group_date on public.tee_times(group_id, tee_off_at);
create index if not exists idx_tee_times_status on public.tee_times(status);
create index if not exists idx_tee_time_players_tee_time_status on public.tee_time_players(tee_time_id, status);
create index if not exists idx_tee_time_players_user on public.tee_time_players(user_id, status);
create index if not exists idx_scores_round_player on public.scores(round_id, player_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- updated_at trigger function
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.users'::regclass) then
    create trigger set_updated_at before update on public.users for each row execute function public.handle_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.groups'::regclass) then
    create trigger set_updated_at before update on public.groups for each row execute function public.handle_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.courses'::regclass) then
    create trigger set_updated_at before update on public.courses for each row execute function public.handle_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.tee_times'::regclass) then
    create trigger set_updated_at before update on public.tee_times for each row execute function public.handle_updated_at();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'set_updated_at' and tgrelid = 'public.scores'::regclass) then
    create trigger set_updated_at before update on public.scores for each row execute function public.handle_updated_at();
  end if;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_join_requests enable row level security;
alter table public.courses enable row level security;
alter table public.course_holes enable row level security;
alter table public.course_tees enable row level security;
alter table public.tee_times enable row level security;
alter table public.tee_time_players enable row level security;
alter table public.rounds enable row level security;
alter table public.scores enable row level security;
alter table public.notifications enable row level security;

-- users: read/write own row
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

-- users: group members can read each other
create policy "users_select_group_peer" on public.users
  for select using (
    exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = users.id
    )
  );

-- groups: members can read
create policy "groups_select_member" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
    )
  );

-- groups: owner/admin can update
create policy "groups_update_admin" on public.groups
  for update using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
        and group_members.user_id = auth.uid()
        and group_members.role in ('owner', 'admin')
    )
  );

-- groups: any authenticated user can create
create policy "groups_insert" on public.groups
  for insert with check (auth.uid() = owner_id);

-- group_members: members can read their group
create policy "group_members_select" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
    )
  );

-- group_members: owner/admin can insert/update/delete
create policy "group_members_insert_admin" on public.group_members
  for insert with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
    or (group_members.user_id = auth.uid() and group_members.role = 'owner')
  );

create policy "group_members_update_admin" on public.group_members
  for update using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );

create policy "group_members_delete_admin" on public.group_members
  for delete using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
    or group_members.user_id = auth.uid()
  );

-- group_join_requests: group admin can read, requester can read own
create policy "group_join_requests_select" on public.group_join_requests
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members
      where group_members.group_id = group_join_requests.group_id
        and group_members.user_id = auth.uid()
        and group_members.role in ('owner', 'admin')
    )
  );

-- group_join_requests: authenticated users can create their own
create policy "group_join_requests_insert" on public.group_join_requests
  for insert with check (auth.uid() = user_id);

-- group_join_requests: admin can update (approve/reject)
create policy "group_join_requests_update_admin" on public.group_join_requests
  for update using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_join_requests.group_id
        and group_members.user_id = auth.uid()
        and group_members.role in ('owner', 'admin')
    )
  );

-- courses: approved courses are public, pending visible to creator
create policy "courses_select" on public.courses
  for select using (status = 'approved' or created_by = auth.uid());

-- courses: authenticated users can create
create policy "courses_insert" on public.courses
  for insert with check (auth.uid() = created_by);

-- courses: creator can update pending courses
create policy "courses_update_creator" on public.courses
  for update using (created_by = auth.uid() and status = 'pending');

-- course_holes: readable if course is readable
create policy "course_holes_select" on public.course_holes
  for select using (
    exists (
      select 1 from public.courses
      where courses.id = course_holes.course_id
        and (courses.status = 'approved' or courses.created_by = auth.uid())
    )
  );

-- course_holes: insertable by course creator
create policy "course_holes_insert" on public.course_holes
  for insert with check (
    exists (
      select 1 from public.courses
      where courses.id = course_holes.course_id
        and courses.created_by = auth.uid()
    )
  );

-- course_tees: same as course_holes
create policy "course_tees_select" on public.course_tees
  for select using (
    exists (
      select 1 from public.courses
      where courses.id = course_tees.course_id
        and (courses.status = 'approved' or courses.created_by = auth.uid())
    )
  );

create policy "course_tees_insert" on public.course_tees
  for insert with check (
    exists (
      select 1 from public.courses
      where courses.id = course_tees.course_id
        and courses.created_by = auth.uid()
    )
  );

-- tee_times: group members can read
create policy "tee_times_select_member" on public.tee_times
  for select using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = tee_times.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- tee_times: group members can create
create policy "tee_times_insert_member" on public.tee_times
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.group_members
      where group_members.group_id = tee_times.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- tee_times: creator or admin can update
create policy "tee_times_update" on public.tee_times
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members
      where group_members.group_id = tee_times.group_id
        and group_members.user_id = auth.uid()
        and group_members.role in ('owner', 'admin')
    )
  );

-- tee_time_players: group members can read
create policy "tee_time_players_select" on public.tee_time_players
  for select using (
    exists (
      select 1 from public.tee_times tt
      join public.group_members gm on gm.group_id = tt.group_id
      where tt.id = tee_time_players.tee_time_id
        and gm.user_id = auth.uid()
    )
  );

-- tee_time_players: users can sign up themselves
create policy "tee_time_players_insert" on public.tee_time_players
  for insert with check (auth.uid() = user_id);

-- tee_time_players: user can update own, admin can update any
create policy "tee_time_players_update" on public.tee_time_players
  for update using (
    user_id = auth.uid()
    or exists (
      select 1 from public.tee_times tt
      join public.group_members gm on gm.group_id = tt.group_id
      where tt.id = tee_time_players.tee_time_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );

-- rounds: group members can read
create policy "rounds_select" on public.rounds
  for select using (
    exists (
      select 1 from public.tee_times tt
      join public.group_members gm on gm.group_id = tt.group_id
      where tt.id = rounds.tee_time_id
        and gm.user_id = auth.uid()
    )
  );

-- rounds: tee_time creator or admin can insert/update
create policy "rounds_insert" on public.rounds
  for insert with check (
    exists (
      select 1 from public.tee_times tt
      left join public.group_members gm on gm.group_id = tt.group_id and gm.user_id = auth.uid()
      where tt.id = rounds.tee_time_id
        and (tt.created_by = auth.uid() or gm.role in ('owner', 'admin'))
    )
  );

create policy "rounds_update" on public.rounds
  for update using (
    exists (
      select 1 from public.tee_times tt
      left join public.group_members gm on gm.group_id = tt.group_id and gm.user_id = auth.uid()
      where tt.id = rounds.tee_time_id
        and (tt.created_by = auth.uid() or gm.role in ('owner', 'admin'))
    )
  );

-- scores: participants can read and write
create policy "scores_select" on public.scores
  for select using (
    exists (
      select 1 from public.rounds r
      join public.tee_times tt on tt.id = r.tee_time_id
      join public.tee_time_players ttp on ttp.tee_time_id = tt.id
      where r.id = scores.round_id
        and ttp.user_id = auth.uid()
        and ttp.status = 'confirmed'
    )
  );

create policy "scores_insert" on public.scores
  for insert with check (
    exists (
      select 1 from public.rounds r
      join public.tee_times tt on tt.id = r.tee_time_id
      join public.tee_time_players ttp on ttp.tee_time_id = tt.id
      where r.id = scores.round_id
        and ttp.user_id = auth.uid()
        and ttp.status = 'confirmed'
    )
  );

create policy "scores_update" on public.scores
  for update using (
    scored_by = auth.uid()
    or exists (
      select 1 from public.rounds r
      join public.tee_times tt on tt.id = r.tee_time_id
      where r.id = scores.round_id
        and tt.created_by = auth.uid()
    )
  );

-- notifications: only own
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- ============================================================
-- Supabase Realtime
-- ============================================================

alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.tee_time_players;
alter publication supabase_realtime add table public.notifications;
