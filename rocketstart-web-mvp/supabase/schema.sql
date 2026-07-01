create extension if not exists pgcrypto;

create type sprint_day_policy as enum ('include', 'exclude', 'ask_each_rocket');
create type rocket_stage as enum ('planned', 'day1_structure', 'day2_build', 'day3_90', 'review', 'done', 'recovery', 'paused');
create type deliverable_status as enum ('todo', 'doing', 'done', 'skipped');
create type focus_sound_type as enum ('white', 'brown', 'rain', 'cafe', 'silent');
create type reflection_trigger as enum ('not_started', 'session_done', 'missed_block', 'day_end', 'overdue_90', 'manual');
create type blocker_reason as enum ('scope_too_big', 'not_enough_time', 'missing_materials', 'low_energy', 'fear', 'perfectionism', 'schedule_conflict', 'unclear_next_action', 'other');
create type calendar_provider as enum ('internal', 'google', 'apple');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_sprint_day_policy sprint_day_policy not null default 'ask_each_rocket',
  default_pomodoro_minutes int not null default 25,
  short_start_minutes int not null default 15,
  daily_max_rocket_starts int not null default 2,
  notification_intensity int not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal text,
  final_deadline date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rocket_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  outcome_90 text not null,
  rocket_start_date date not null,
  day2_check_date date not null,
  target_90_date date not null,
  final_deadline date,
  sprint_day_policy sprint_day_policy not null default 'ask_each_rocket',
  stage rocket_stage not null default 'planned',
  is_90_done boolean not null default false,
  confirmed_90_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.rocket_tasks(id) on delete cascade,
  title text not null,
  description text,
  is_required boolean not null default true,
  weight numeric not null default 1 check (weight >= 0),
  status deliverable_status not null default 'todo',
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.rocket_tasks(id) on delete cascade,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  title text not null,
  estimated_pomodoros numeric not null default 1 check (estimated_pomodoros >= 0),
  status deliverable_status not null default 'todo',
  completed_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.rocket_tasks(id) on delete cascade,
  subtask_id uuid references public.subtasks(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  planned_minutes int not null default 25,
  actual_minutes int,
  completed_pomodoros numeric not null default 0,
  sound_type focus_sound_type not null default 'silent',
  session_note text,
  created_at timestamptz not null default now()
);

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.rocket_tasks(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  provider calendar_provider not null default 'internal',
  external_calendar_id text,
  external_event_id text,
  sync_status text not null default 'not_synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reflection_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.rocket_tasks(id) on delete cascade,
  session_id uuid references public.focus_sessions(id) on delete set null,
  trigger reflection_trigger not null default 'manual',
  blocker blocker_reason,
  note text,
  next_minimum_action text,
  created_at timestamptz not null default now()
);

create table public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.rocket_tasks(id) on delete cascade,
  type text not null,
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  response_action text,
  created_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider calendar_provider not null,
  account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view public.rocket_task_metrics as
with subtask_estimates as (
  select task_id, user_id, coalesce(sum(estimated_pomodoros), 0) as estimated_pomodoros
  from public.subtasks
  group by task_id, user_id
), focus_actuals as (
  select task_id, user_id, coalesce(sum(completed_pomodoros), 0) as actual_pomodoros
  from public.focus_sessions
  group by task_id, user_id
), deliverable_progress as (
  select
    task_id,
    user_id,
    coalesce(sum(weight) filter (where is_required), 0) as required_weight,
    coalesce(sum(weight) filter (where is_required and status = 'done'), 0) as completed_required_weight
  from public.deliverables
  group by task_id, user_id
)
select
  rt.id as task_id,
  rt.user_id,
  coalesce(se.estimated_pomodoros, 0) as estimated_pomodoros,
  coalesce(fa.actual_pomodoros, 0) as actual_pomodoros,
  case
    when coalesce(se.estimated_pomodoros, 0) = 0 then null
    else coalesce(fa.actual_pomodoros, 0) / se.estimated_pomodoros
  end as pomodoro_usage_ratio,
  case
    when coalesce(se.estimated_pomodoros, 0) = 0 then null
    else greatest(0, 1 - abs(coalesce(fa.actual_pomodoros, 0) - se.estimated_pomodoros) / se.estimated_pomodoros)
  end as pomodoro_accuracy_score,
  coalesce(dp.completed_required_weight, 0) as completed_required_weight,
  coalesce(dp.required_weight, 0) as required_weight,
  case
    when coalesce(dp.required_weight, 0) = 0 then 0
    else coalesce(dp.completed_required_weight, 0) / dp.required_weight
  end as deliverable_progress_ratio
from public.rocket_tasks rt
left join subtask_estimates se on se.task_id = rt.id and se.user_id = rt.user_id
left join focus_actuals fa on fa.task_id = rt.id and fa.user_id = rt.user_id
left join deliverable_progress dp on dp.task_id = rt.id and dp.user_id = rt.user_id
where rt.user_id = auth.uid();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.projects enable row level security;
alter table public.rocket_tasks enable row level security;
alter table public.deliverables enable row level security;
alter table public.subtasks enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.time_blocks enable row level security;
alter table public.reflection_logs enable row level security;
alter table public.reminder_events enable row level security;
alter table public.calendar_connections enable row level security;

create policy "profiles are owned by user" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "settings are owned by user" on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "projects are owned by user" on public.projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "rocket tasks are owned by user" on public.rocket_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "deliverables are owned by user" on public.deliverables for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "subtasks are owned by user" on public.subtasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "focus sessions are owned by user" on public.focus_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "time blocks are owned by user" on public.time_blocks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reflection logs are owned by user" on public.reflection_logs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reminder events are owned by user" on public.reminder_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "calendar connections are owned by user" on public.calendar_connections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
