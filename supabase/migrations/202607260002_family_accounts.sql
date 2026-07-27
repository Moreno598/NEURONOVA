begin;

-- Amplía las tablas existentes sin eliminar datos ni columnas heredadas.
alter table public.user_profiles
    add column if not exists user_id uuid references auth.users(id) on delete cascade,
    add column if not exists parent_user_id uuid references auth.users(id) on delete restrict,
    add column if not exists user_email text,
    add column if not exists parent_email text,
    add column if not exists alias text,
    add column if not exists full_name text,
    add column if not exists age smallint,
    add column if not exists mode text,
    add column if not exists updated_at timestamptz not null default now();

alter table public.correos
    add column if not exists child_user_id uuid references auth.users(id) on delete cascade,
    add column if not exists parent_user_id uuid references auth.users(id) on delete restrict,
    add column if not exists alias text,
    add column if not exists full_name text,
    add column if not exists age smallint,
    add column if not exists mode text,
    add column if not exists created_at timestamptz not null default now();

-- Migra referencias que puedan inferirse de las cuentas existentes.
update public.user_profiles
set user_email = coalesce(user_email, email)
where user_email is null;

update public.user_profiles as profile
set user_id = auth_user.id
from auth.users as auth_user
where profile.user_id is null
  and lower(auth_user.email) = lower(coalesce(profile.user_email, profile.email));

update public.correos as link
set child_user_id = auth_user.id
from auth.users as auth_user
where link.child_user_id is null
  and lower(auth_user.email) = lower(link.user_email);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'ns_profiles_age_range'
          and conrelid = 'public.user_profiles'::regclass
    ) then
        alter table public.user_profiles
            add constraint ns_profiles_age_range
            check (age is null or age between 6 and 17);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'ns_profiles_mode_valid'
          and conrelid = 'public.user_profiles'::regclass
    ) then
        alter table public.user_profiles
            add constraint ns_profiles_mode_valid
            check (mode is null or mode in ('child', 'teen'));
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'ns_profiles_mode_matches_age'
          and conrelid = 'public.user_profiles'::regclass
    ) then
        alter table public.user_profiles
            add constraint ns_profiles_mode_matches_age
            check (
                age is null
                or mode is null
                or (age between 6 and 11 and mode = 'child')
                or (age between 12 and 17 and mode = 'teen')
            );
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'ns_correos_age_range'
          and conrelid = 'public.correos'::regclass
    ) then
        alter table public.correos
            add constraint ns_correos_age_range
            check (age is null or age between 6 and 17);
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'ns_correos_mode_valid'
          and conrelid = 'public.correos'::regclass
    ) then
        alter table public.correos
            add constraint ns_correos_mode_valid
            check (mode is null or mode in ('child', 'teen'));
    end if;
end
$$;

create unique index if not exists ns_profiles_user_id_unique
    on public.user_profiles (user_id)
    where user_id is not null;

create unique index if not exists ns_profiles_user_email_unique
    on public.user_profiles (lower(user_email))
    where user_email is not null;

create unique index if not exists ns_profiles_alias_unique
    on public.user_profiles (lower(alias))
    where alias is not null;

create unique index if not exists ns_profiles_parent_unique
    on public.user_profiles (parent_user_id)
    where parent_user_id is not null;

create unique index if not exists ns_correos_child_unique
    on public.correos (child_user_id)
    where child_user_id is not null;

create unique index if not exists ns_correos_user_email_unique
    on public.correos (lower(user_email));

create unique index if not exists ns_correos_parent_email_unique
    on public.correos (lower(parent_email));

-- Reemplaza la función anterior, que exponía el correo del hijo a visitantes anónimos.
drop function if exists public.get_student_email_by_parent(text);

create or replace function public.is_alias_available(candidate_alias text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        length(trim(candidate_alias)) between 3 and 24
        and not exists (
            select 1
            from public.user_profiles
            where lower(alias) = lower(trim(candidate_alias))
        )
$$;

revoke all on function public.is_alias_available(text) from public;
grant execute on function public.is_alias_available(text) to anon, authenticated;

create or replace function public.get_my_family_context()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'user_id', profile.user_id,
        'parent_user_id', profile.parent_user_id,
        'user_email', profile.user_email,
        'parent_email', profile.parent_email,
        'alias', profile.alias,
        'full_name', profile.full_name,
        'age', profile.age,
        'mode', profile.mode,
        'state_data', profile.state_data,
        'viewer_role',
            case
                when profile.parent_user_id = auth.uid() then 'parent'
                else 'student'
            end
    )
    from public.user_profiles as profile
    where profile.user_id = auth.uid()
       or profile.parent_user_id = auth.uid()
    limit 1
$$;

revoke all on function public.get_my_family_context() from public;
grant execute on function public.get_my_family_context() to authenticated;

-- Elimina todas las políticas heredadas para evitar combinaciones permisivas.
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

alter table public.user_profiles enable row level security;
alter table public.correos enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.correos from anon, authenticated;

grant select on table public.user_profiles to authenticated;
grant update (state_data, alias, full_name, updated_at)
    on table public.user_profiles to authenticated;
grant select on table public.correos to authenticated;

create policy ns_family_profiles_select
on public.user_profiles
for select
to authenticated
using (
    user_id = (select auth.uid())
    or parent_user_id = (select auth.uid())
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_family_profiles_update_student
on public.user_profiles
for update
to authenticated
using (
    user_id = (select auth.uid())
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
)
with check (
    user_id = (select auth.uid())
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

create policy ns_family_links_select
on public.correos
for select
to authenticated
using (
    child_user_id = (select auth.uid())
    or parent_user_id = (select auth.uid())
    or lower((select auth.jwt() ->> 'email')) = 'sparkneuro64@gmail.com'
);

commit;
