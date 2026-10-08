create table if not exists public.assistant_usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists assistant_usage_events_created_at_idx
  on public.assistant_usage_events (created_at);

create index if not exists assistant_usage_events_user_created_at_idx
  on public.assistant_usage_events (user_id, created_at);

alter table public.assistant_usage_events enable row level security;

revoke all on public.assistant_usage_events from anon, authenticated;

create or replace function public.consume_assistant_quota()
returns table (
  allowed boolean,
  limit_code text,
  global_used integer,
  hour_used integer,
  ten_minute_used integer,
  global_remaining integer,
  hour_remaining integer,
  ten_minute_remaining integer,
  warning text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', timezone('UTC', now())) at time zone 'UTC';
  v_global_used integer;
  v_hour_used integer;
  v_ten_minute_used integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialize quota checks so concurrent users cannot pass the global cap together.
  perform pg_advisory_xact_lock(845331, 1);

  delete from public.assistant_usage_events
  where created_at < v_now - interval '2 days';

  select count(*)::integer into v_global_used
  from public.assistant_usage_events
  where created_at >= v_day_start;

  select count(*)::integer into v_hour_used
  from public.assistant_usage_events
  where user_id = v_user_id and created_at >= v_now - interval '1 hour';

  select count(*)::integer into v_ten_minute_used
  from public.assistant_usage_events
  where user_id = v_user_id and created_at >= v_now - interval '10 minutes';

  allowed := v_global_used < 50 and v_hour_used < 20 and v_ten_minute_used < 5;
  limit_code := case
    when v_global_used >= 50 then 'global_daily'
    when v_hour_used >= 20 then 'account_hourly'
    when v_ten_minute_used >= 5 then 'account_ten_minutes'
    else null
  end;

  if allowed then
    insert into public.assistant_usage_events (user_id) values (v_user_id);
    v_global_used := v_global_used + 1;
    v_hour_used := v_hour_used + 1;
    v_ten_minute_used := v_ten_minute_used + 1;
  end if;

  global_used := v_global_used;
  hour_used := v_hour_used;
  ten_minute_used := v_ten_minute_used;
  global_remaining := greatest(0, 50 - v_global_used);
  hour_remaining := greatest(0, 20 - v_hour_used);
  ten_minute_remaining := greatest(0, 5 - v_ten_minute_used);
  warning := null;

  if allowed and v_global_used >= 40 then
    warning := 'Il ne reste que ' || global_remaining || ' requêtes aujourd’hui pour toute l’équipe.';
  end if;
  if allowed and (v_hour_used >= 16 or v_ten_minute_used >= 4) then
    warning := concat_ws(' ', warning, 'Vous approchez de votre limite personnelle (' || hour_remaining || ' par heure, ' || ten_minute_remaining || ' sur 10 minutes).');
  end if;

  return next;
end;
$$;

revoke all on function public.consume_assistant_quota() from public, anon;
grant execute on function public.consume_assistant_quota() to authenticated;
