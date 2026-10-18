-- Corrective migration for the deployed ingestion path.
--
-- The original ingestion function can remain deployed for existing flows, but
-- it does not reliably map current/ampere and voltage into the live table.
-- Node-RED should call this RPC with the same p_device_id/p_readings shape.
-- It accepts both the canonical names and the common legacy aliases.

alter table public.live_sensor_readings
  add column if not exists voltage numeric,
  add column if not exists current numeric,
  add column if not exists voltage_v numeric,
  add column if not exists current_a numeric,
  add column if not exists power_w numeric,
  add column if not exists energy_kwh numeric,
  add column if not exists recorded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- The table may already exist from an earlier migration. CREATE TABLE IF NOT
-- EXISTS does not add columns to an existing table, so make the raw schema
-- explicit here as well.
alter table public.energy_readings_raw
  add column if not exists voltage numeric,
  add column if not exists current numeric,
  add column if not exists voltage_v numeric,
  add column if not exists current_a numeric,
  add column if not exists power_w numeric,
  add column if not exists energy_kwh numeric,
  add column if not exists recorded_at timestamptz,
  add column if not exists received_at timestamptz not null default now();

create unique index if not exists live_sensor_readings_device_sensor_uidx
  on public.live_sensor_readings (device_id, sensor);

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
  v_sensor text;
  v_voltage numeric;
  v_current numeric;
  v_power_w numeric;
  v_energy_kwh numeric;
  v_recorded_at timestamptz;
  v_inserted_raw integer := 0;
  v_updated_live integer := 0;
begin
  if nullif(trim(p_device_id), '') is null then
    raise exception 'p_device_id is required';
  end if;

  if jsonb_typeof(p_readings) <> 'array' then
    raise exception 'p_readings must be a JSON array';
  end if;

  for v_item in select value from jsonb_array_elements(p_readings) as items(value)
  loop
    v_sensor := coalesce(v_item->>'sensor', v_item->>'room');

    if v_sensor not in ('Sala', 'Living Room', 'Master Bedroom') then
      raise exception 'Unsupported sensor name: %', coalesce(v_sensor, '<empty>');
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
      device_id,
      sensor,
      voltage,
      current,
      voltage_v,
      current_a,
      power_w,
      energy_kwh,
      recorded_at
    ) values (
      p_device_id,
      v_sensor,
      v_voltage,
      v_current,
      v_voltage,
      v_current,
      v_power_w,
      v_energy_kwh,
      v_recorded_at
    ) on conflict (device_id, sensor, recorded_at) do nothing;

    if found then
      v_inserted_raw := v_inserted_raw + 1;
    end if;

    insert into public.live_sensor_readings (
      device_id,
      sensor,
      voltage,
      current,
      voltage_v,
      current_a,
      power_w,
      energy_kwh,
      recorded_at,
      updated_at
    ) values (
      p_device_id,
      v_sensor,
      v_voltage,
      v_current,
      v_voltage,
      v_current,
      v_power_w,
      v_energy_kwh,
      v_recorded_at,
      now()
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
  end loop;

  return jsonb_build_object(
    'device_id', p_device_id,
    'inserted_readings', v_inserted_raw,
    'updated_live_readings', v_updated_live
  );
end;
$$;

revoke all on function public.ingest_energy_readings_with_live_fields(text, jsonb) from public;
grant execute on function public.ingest_energy_readings_with_live_fields(text, jsonb) to service_role;

comment on function public.ingest_energy_readings_with_live_fields(text, jsonb) is
  'Inserts idempotent raw readings and updates voltage, current, power, and energy in live_sensor_readings.';
