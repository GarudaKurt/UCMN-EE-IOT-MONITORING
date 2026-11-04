-- Backend for the "pause / continue" switch on the Monthly target status card.
--
-- 1. When the rental house FIRST reaches its monthly target, power is paused by
--    default: pzem_status.is_on is set to false. The decision stays 'pending',
--    so the app's alert still asks the user to continue or confirm the pause.
-- 2. The user's choice goes through one secure function that updates the
--    decision and the relay together in a single transaction.
--
-- Requires: 20261019000001_energy_target_monitoring.sql (energy_target_status)
--           20261019000002_pzem_status_rental_house.sql  (pzem_status)


-- ---------------------------------------------------------------------------
-- 1. Refresh function: same logic as before, plus the default pause.
--    "First reached" means the row is new, was within target before, or the
--    user changed the target. A user who chose 'continue' is never re-paused,
--    because their row is already target_reached with an unchanged target.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_energy_target_status(p_month_start date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_month date := date_trunc('month', timezone('Asia/Manila', now()))::date;
  v_month_start date := coalesce(p_month_start, v_current_month);
  v_next_month date := (v_month_start + interval '1 month')::date;
  v_rental numeric := 0;
  v_reached boolean;
  v_had_prev boolean;
  v_new_reach boolean;
  v_prev record;
  v_config record;
begin
  select coalesce(sum(rental_kwh), 0)
    into v_rental
    from public.current_kwh_readings
   where reading_date >= v_month_start
     and reading_date < v_next_month;

  for v_config in
    select user_id, target_kwh
      from public.setup_energy
  loop
    v_reached := v_config.target_kwh > 0 and v_rental >= v_config.target_kwh;

    select status, target_kwh
      into v_prev
      from public.energy_target_status
     where user_id = v_config.user_id
       and room_id = 'rental-house'
       and month_start = v_month_start;
    v_had_prev := found;

    v_new_reach := v_reached
      and (
        not v_had_prev
        or v_prev.status = 'within_target'
        or v_prev.target_kwh <> v_config.target_kwh
      );

    insert into public.energy_target_status (
      user_id, room_id, month_start, target_kwh, consumed_kwh,
      status, decision, reached_at, notified_at, updated_at
    ) values (
      v_config.user_id, 'rental-house', v_month_start, v_config.target_kwh, v_rental,
      case when v_reached then 'target_reached' else 'within_target' end,
      'pending',
      case when v_reached then now() end,
      case when v_reached then now() end,
      now()
    )
    on conflict (user_id, room_id, month_start) do update set
      target_kwh = excluded.target_kwh,
      consumed_kwh = excluded.consumed_kwh,
      status = case
        when energy_target_status.target_kwh <> excluded.target_kwh then excluded.status
        when energy_target_status.decision = 'pause' then 'paused'
        when energy_target_status.decision = 'continue'
          and excluded.status = 'target_reached' then 'target_reached'
        else excluded.status
      end,
      decision = case
        when energy_target_status.target_kwh <> excluded.target_kwh then 'pending'
        else energy_target_status.decision
      end,
      reached_at = case
        when energy_target_status.target_kwh <> excluded.target_kwh
          and excluded.status = 'target_reached' then now()
        when energy_target_status.reached_at is not null then energy_target_status.reached_at
        when excluded.status = 'target_reached' then now()
      end,
      notified_at = case
        when energy_target_status.target_kwh <> excluded.target_kwh
          and excluded.status = 'target_reached' then now()
        when energy_target_status.notified_at is not null then energy_target_status.notified_at
        when excluded.status = 'target_reached' then now()
      end,
      decided_at = case
        when energy_target_status.target_kwh <> excluded.target_kwh then null
        else energy_target_status.decided_at
      end,
      paused_at = case
        when energy_target_status.target_kwh <> excluded.target_kwh then null
        else energy_target_status.paused_at
      end,
      updated_at = now();

    -- Default behaviour: pause power the moment the target is first reached.
    -- Only for the current month, so refreshing a past month never cuts power.
    if v_new_reach and v_month_start = v_current_month then
      update public.pzem_status
         set is_on = false
       where group_id = 'rental-house';
    end if;
  end loop;
end;
$$;


-- ---------------------------------------------------------------------------
-- 2. Decision RPC used by the app's switch and the alert dialog.
--    continue -> relay on,  decision 'continue', status 'target_reached'
--    pause    -> relay off, decision 'pause',    status 'paused'
-- Runs as the signed-in user's id (auth.uid()), only after the target has been
-- reached, and updates both tables in one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.set_energy_target_decision(
  p_room_id text,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', timezone('Asia/Manila', now()))::date;
  v_row public.energy_target_status;
  v_status text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_room_id is distinct from 'rental-house' then
    raise exception 'Unsupported room: %', coalesce(p_room_id, '<empty>');
  end if;

  if p_decision not in ('continue', 'pause') then
    raise exception 'Decision must be continue or pause';
  end if;

  select *
    into v_row
    from public.energy_target_status
   where user_id = v_user
     and room_id = p_room_id
     and month_start = v_month
   for update;

  if not found then
    raise exception 'No target status for this month. Save your energy target first.';
  end if;

  if v_row.status = 'within_target' then
    raise exception 'The monthly target has not been reached yet.';
  end if;

  update public.pzem_status
     set is_on = (p_decision = 'continue')
   where group_id = p_room_id;

  if not found then
    raise exception 'Relay row for % is missing in pzem_status', p_room_id;
  end if;

  v_status := case when p_decision = 'pause' then 'paused' else 'target_reached' end;

  update public.energy_target_status
     set decision = p_decision,
         status = v_status,
         decided_at = now(),
         paused_at = case when p_decision = 'pause' then now() end,
         updated_at = now()
   where id = v_row.id;

  return jsonb_build_object(
    'room_id', p_room_id,
    'decision', p_decision,
    'status', v_status,
    'is_on', (p_decision = 'continue')
  );
end;
$$;

revoke all on function public.set_energy_target_decision(text, text) from public, anon;
grant execute on function public.set_energy_target_decision(text, text) to authenticated;

comment on function public.set_energy_target_decision(text, text) is
  'Records a pause/continue decision for the signed-in user and switches the rental house relay to match.';


-- ---------------------------------------------------------------------------
-- Test (optional, run by hand). Make sure test readings exist first, e.g.
-- supabase/test_fill_today.sql (4.8 kWh today).
-- ---------------------------------------------------------------------------
-- update public.setup_energy set target_kwh = 4;       -- reached -> relay paused
-- select is_on from public.pzem_status where group_id = 'rental-house';  -- false
-- select status, decision from public.energy_target_status;  -- target_reached, pending
-- update public.setup_energy set target_kwh = 100;     -- restore
-- update public.pzem_status set is_on = true where group_id = 'rental-house';
