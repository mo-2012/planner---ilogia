-- iLogia Planner — schema migration (FOR REVIEW ONLY — do NOT run on production without approval).
-- Project: zugwicbbfbefbbwugfxq (shared iLogia Supabase). All tables are namespaced planner_*.
-- Every table has RLS enabled with owner-only policies. No service-role key is ever used client-side.

-- 1) Subjects & lessons
create table if not exists planner_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#136F58',
  created_at timestamptz not null default now()
);

create table if not exists planner_lessons (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references planner_subjects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  done boolean not null default false,
  done_at timestamptz,
  sort_order int not null default 0
);

-- 2) Tasks
create table if not exists planner_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references planner_subjects(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  due_date date,
  priority text not null default 'med' check (priority in ('low','med','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  est_hours numeric(4,1) not null default 1 check (est_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Weekly timetable sessions (recurring weekly template)
create table if not exists planner_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references planner_subjects(id) on delete cascade,
  lesson_id uuid references planner_lessons(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Saturday
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440),
  note text not null default '',
  check (end_min > start_min)
);

-- 4) Study plans
create table if not exists planner_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  total_hours smallint not null check (total_hours > 0),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists planner_plan_subjects (
  plan_id uuid not null references planner_plans(id) on delete cascade,
  subject_id uuid not null references planner_subjects(id) on delete cascade,
  primary key (plan_id, subject_id)
);

-- 5) Exams
create table if not exists planner_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references planner_subjects(id) on delete cascade,
  plan_id uuid references planner_plans(id) on delete set null,
  topic text not null default '',
  exam_date date not null,
  exam_time time,
  notes text not null default ''
);

-- 6) Goals
create table if not exists planner_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('daily','weekly')),
  metric text not null check (metric in ('hours','lessons')),
  target smallint not null check (target > 0),
  period date,                       -- day (daily) or week-start (weekly); null = repeating
  closed boolean not null default false,
  achieved boolean,
  created_at timestamptz not null default now()
);

-- 7) Study logs (timer sessions, manual entries, lesson completions)
create table if not exists planner_study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references planner_subjects(id) on delete set null,
  minutes smallint not null default 0 check (minutes between 0 and 1440),
  logged_date date not null default (now() at time zone 'Africa/Cairo')::date,
  source text not null default 'manual' check (source in ('timer','manual','lesson')),
  lesson_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists planner_study_logs_user_date on planner_study_logs(user_id, logged_date);

-- 8) User settings
create table if not exists planner_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  study_days smallint[] not null default '{0,1,2,3,4}',
  day_start time not null default '16:00',
  day_end time not null default '21:00',
  pomodoro jsonb not null default '{"focus":25,"break":5,"cycles":4}',
  notif boolean not null default false,
  theme text not null default 'light' check (theme in ('light','dark')),
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table planner_subjects      enable row level security;
alter table planner_lessons       enable row level security;
alter table planner_tasks         enable row level security;
alter table planner_sessions      enable row level security;
alter table planner_plans         enable row level security;
alter table planner_plan_subjects enable row level security;
alter table planner_exams         enable row level security;
alter table planner_goals         enable row level security;
alter table planner_study_logs    enable row level security;
alter table planner_user_settings enable row level security;

-- owner-only policies (all verbs)
create policy own on planner_subjects      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_tasks         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_sessions      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_plans         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_exams         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_goals         for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_study_logs    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy own on planner_user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- child tables check ownership through the parent row
create policy own on planner_lessons for all
  using (exists (select 1 from planner_subjects s where s.id = subject_id and s.user_id = auth.uid()))
  with check (exists (select 1 from planner_subjects s where s.id = subject_id and s.user_id = auth.uid()));

create policy own on planner_plan_subjects for all
  using (exists (select 1 from planner_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from planner_plans p where p.id = plan_id and p.user_id = auth.uid()));
