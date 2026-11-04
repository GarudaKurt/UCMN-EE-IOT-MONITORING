-- Privileged ingestion path for Node-RED (rental house only).
--
-- Node-RED calls:
--   rpc ingest_energy_readings_with_live_fields(p_device_id, p_readings)
-- with the service role key. This replaces both 20261018_fix_live_sensor_measurements
-- and the "deployed" ingest_energy_readings function the old files referred to;
-- that function was not in the repository, so it is not needed here.


-- ---------------------------------------------------------------------------
-- Daily kWh recalculation
--
-- ASSUMPTION: energy_kwh is the PZEM's cumulative counter. Daily usage is the
-- last reading of the day minus the last reading before the day (or the first
-- reading of the day when there is no earlier one), never below zero.
-- If Node-RED instead sends "kWh so far today" that resets at midnight, change
-- v_kwh below to just v_last.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_rental_kwh(p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := (p_date::timestamp at time zone 'Asia/Manila');
  v_end timestamptz := ((p_date + 1)::timestamp at time zone 'Asia/Manila');
  v_last numeric;
  v_baseline numeric;
  v_kwh numeric;
begin
  select energy_kwh
    into v_last
    from public.energy_readings_raw
   where sensor = 'Rental House'
     and energy_kwh is not null
     and recorded_at >= v_start
     and recorded_at < v_end
   order by recorded_at desc
   limit 1;

  if v_last is null then
    return;
  end if;

  select energy_kwh
    into v_baseline
    from public.energy_readings_raw
   where sensor = 'Rental House'
     and energy_kwh is not null
     and recorded_at < v_start
   order by recorded_at desc
   limit 1;

  if v_baseline is null then
    select energy_kwh
      into v_baseline
      from public.energy_readings_raw
     where sensor = 'Rental House'
       and energy_kwh is not null
       and recorded_at >= v_start
       and recorded_at < v_end
     order by recorded_at asc
     limit 1;
  end if;

  v_kwh := greatest(v_last - v_baseline, 0);

  insert into public.current_kwh_readings (reading_date, rental_kwh, total_kwh, updated_at)
  values (p_date, v_kwh, v_kwh, now())
  on conflict (reading_date) do update set
    rental_kwh = excluded.rental_kwh,
    total_kwh = excluded.total_kwh,
    updated_at = now();
end;
$$;


-- ---------------------------------------------------------------------------
-- Ingestion RPC
-- Accepts 'Rental', 'Rental House', 'rental-house' or 'rental_house' as the
-- sensor/room name and stores all of them as 'Rental House'. Accepts the
-- canonical field names and common aliases (voltage/volts, current/ampere/amps,
-- power/watts, energy/kWh).
-- ---------------------------------------------------------------------------

create or replace function public.ingest_energy_readings_with_live_fields(
  p_device_id text,
  p_readings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_sensor_raw text;
  v_sensor text;
  v_voltage numeric;
  v_current numeric;
  v_power_w numeric;
  v_energy_kwh numeric;
  v_recorded_at timestamptz;
  v_inserted_raw integer := 0;
  v_updated_live integer := 0;
  v_dates date[] := '{}';
  v_day date;
begin
  if nullif(trim(p_device_id), '') is null then
    raise exception 'p_device_id is required';
  end if;

  if jsonb_typeof(p_readings) <> 'array' then
    raise exception 'p_readings must be a JSON array';
  end if;

  for v_item in select value from jsonb_array_elements(p_readings) as items(value)
  loop
    v_sensor_raw := coalesce(v_item->>'sensor', v_item->>'room');

    if regexp_replace(lower(trim(coalesce(v_sensor_raw, ''))), '[\s_-]+', ' ', 'g')
         in ('rental', 'rental house') then
      v_sensor := 'Rental House';
    else
      raise exception 'Unsupported sensor name: %', coalesce(v_sensor_raw, '<empty>');
    end if;

    v_voltage := nullif(coalesce(v_item->>'voltage_v', v_item->>'voltage', v_item->>'volts'), '')::numeric;
    v_current := nullif(coalesce(v_item->>'current_a', v_item->>'current', v_item->>'ampere', v_item->>'amps'), '')::numeric;
    v_power_w := nullif(coalesce(v_item->>'power_w', v_item->>'power', v_item->>'watts'), '')::numeric;
    v_energy_kwh := nullif(coalesce(v_item->>'energy_kwh', v_item->>'energy', v_item->>'kWh'), '')::numeric;
    v_recorded_at := coalesce(
      nullif(v_item->>'recorded_at', '')::timestamptz,
      nullif(v_item->>'timestamp', '')::timestamptz,
      now()
    );

    insert into public.energy_readings_raw (
      device_id, sensor, voltage, current, voltage_v, current_a,
      power_w, energy_kwh, recorded_at
    ) values (
      p_device_id, v_sensor, v_voltage, v_current, v_voltage, v_current,
      v_power_w, v_energy_kwh, v_recorded_at
    ) on conflict (device_id, sensor, recorded_at) do nothing;

    if found then
      v_inserted_raw := v_inserted_raw + 1;
    end if;

    insert into public.live_sensor_readings (
      device_id, sensor, voltage, current, voltage_v, current_a,
      power_w, energy_kwh, recorded_at, updated_at
    ) values (
      p_device_id, v_sensor, v_voltage, v_current, v_voltage, v_current,
      v_power_w, v_energy_kwh, v_recorded_at, now()
    ) on conflict (device_id, sensor) do update set
      voltage = excluded.voltage,
      current = excluded.current,
      voltage_v = excluded.voltage_v,
      current_a = excluded.current_a,
      power_w = excluded.power_w,
      energy_kwh = excluded.energy_kwh,
      recorded_at = excluded.recorded_at,
      updated_at = now();

    v_updated_live := v_updated_live + 1;

    v_day := (v_recorded_at at time zone 'Asia/Manila')::date;
    if not (v_day = any(v_dates)) then
      v_dates := v_dates || v_day;
    end if;
  end loop;

  -- Keep the daily kWh table (and so the monthly target alert) current.
  foreach v_day in array v_dates
  loop
    perform public.recalculate_rental_kwh(v_day);
  end loop;

  return jsonb_build_object(
    'device_id', p_device_id,
    'inserted_readings', v_inserted_raw,
    'updated_live_readings', v_updated_live
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- Permissions
-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default, so "revoke ... from public" alone is not enough: without revoking
-- those roles too, anyone with the public anon key could call these functions
-- and write fake readings.
-- ---------------------------------------------------------------------------

revoke all on function public.ingest_energy_readings_with_live_fields(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_energy_readings_with_live_fields(text, jsonb)
  to service_role;

revoke all on function public.recalculate_rental_kwh(date)
  from public, anon, authenticated;
grant execute on function public.recalculate_rental_kwh(date)
  to service_role;

comment on function public.ingest_energy_readings_with_live_fields(text, jsonb) is
  'Inserts idempotent raw readings, updates live voltage/current/power/energy for the rental house, and refreshes the daily kWh total.';
