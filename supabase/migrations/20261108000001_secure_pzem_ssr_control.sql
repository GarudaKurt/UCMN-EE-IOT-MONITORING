-- Harden the existing pzem_status relay state without creating another table.
-- `is_on` is the canonical SSR state: true = ON, false = OFF.

-- Keep this migration safe for projects where pzem_status was created manually
-- or by an earlier version of the migration.
alter table if exists public.pzem_status
  add column if not exists is_on boolean not null default true;

do $$
declare
  v_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into v_type
    from pg_attribute a
   where a.attrelid = 'public.pzem_status'::regclass
     and a.attname = 'is_on'
     and not a.attisdropped;

  if v_type is distinct from 'boolean' then
    raise exception 'public.pzem_status.is_on must be boolean, found %', coalesce(v_type, '<missing>');
  end if;
end;
$$;

-- The trigger is defined in the original pzem_status migration; repeat it here
-- so this hardening migration remains safe on an existing database.
drop trigger if exists pzem_status_set_updated_at on public.pzem_status;
create trigger pzem_status_set_updated_at
  before update on public.pzem_status
  for each row execute function public.set_updated_at();

alter table public.pzem_status enable row level security;

-- State can be read by signed-in monitoring clients. Writes go through the RPC
-- below so callers cannot update arbitrary columns or group IDs directly.
drop policy if exists pzem_status_select_authenticated on public.pzem_status;
create policy pzem_status_select_authenticated
  on public.pzem_status
  for select to authenticated
  using (true);

drop policy if exists pzem_status_update_authenticated on public.pzem_status;

create or replace function public.set_pzem_ssr_state(
  p_group_id text,
  p_is_on boolean
)
returns public.pzem_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pzem_status;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_group_id is distinct from 'rental-house' then
    raise exception 'Unsupported relay group: %', coalesce(p_group_id, '<empty>');
  end if;

  update public.pzem_status
     set is_on = p_is_on
   where group_id = p_group_id
   returning * into v_row;

  if not found then
    raise exception 'Relay row for % is missing in pzem_status', p_group_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_pzem_ssr_state(text, boolean)
  from public, anon, authenticated;
grant execute on function public.set_pzem_ssr_state(text, boolean)
  to authenticated;

comment on column public.pzem_status.is_on is
  'SSR output state: true = ON, false = OFF';

comment on function public.set_pzem_ssr_state(text, boolean) is
  'Authenticated SSR ON/OFF control for the rental-house relay; changes are emitted through Supabase Realtime.';

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'pzem_status'
  ) then
    alter publication supabase_realtime add table public.pzem_status;
  end if;
end;
$$;
