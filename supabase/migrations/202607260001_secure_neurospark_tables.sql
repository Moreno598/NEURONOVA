begin;

alter table public.user_profiles enable row level security;
alter table public.correos enable row level security;

revoke all on table public.user_profiles from anon;
revoke all on table public.correos from anon;
grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select, insert, update, delete on table public.correos to authenticated;

-- Sustituye políticas heredadas/permisivas para evitar que se combinen con OR.
do $$
declare
    existing_policy record;
begin
    for existing_policy in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('user_profiles', 'correos')
    loop
        execute format(
            'drop policy if exists %I on %I.%I',
            existing_policy.policyname,
            existing_policy.schemaname,
            existing_policy.tablename
        );
    end loop;
end
$$;

drop policy if exists ns_profiles_select on public.user_profiles;
drop policy if exists ns_profiles_insert on public.user_profiles;
drop policy if exists ns_profiles_update on public.user_profiles;
drop policy if exists ns_profiles_delete on public.user_profiles;

create policy ns_profiles_select
on public.user_profiles
for select
to authenticated
using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_profiles_insert
on public.user_profiles
for insert
to authenticated
with check (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_profiles_update
on public.user_profiles
for update
to authenticated
using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
)
with check (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_profiles_delete
on public.user_profiles
for delete
to authenticated
using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

drop policy if exists ns_correos_select on public.correos;
drop policy if exists ns_correos_insert on public.correos;
drop policy if exists ns_correos_update on public.correos;
drop policy if exists ns_correos_delete on public.correos;

create policy ns_correos_select
on public.correos
for select
to authenticated
using (
    lower(user_email) = lower((select auth.jwt() ->> 'email'))
    or lower(parent_email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_correos_insert
on public.correos
for insert
to authenticated
with check (
    lower(user_email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_correos_update
on public.correos
for update
to authenticated
using (
    lower(user_email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
)
with check (
    lower(user_email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_correos_delete
on public.correos
for delete
to authenticated
using (
    lower(user_email) = lower((select auth.jwt() ->> 'email'))
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create or replace function public.get_student_email_by_parent(lookup_parent_email text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select c.user_email
    from public.correos as c
    where lower(c.parent_email) = lower(trim(lookup_parent_email))
    limit 1
$$;

revoke all on function public.get_student_email_by_parent(text) from public;
grant execute on function public.get_student_email_by_parent(text) to anon, authenticated;

commit;
