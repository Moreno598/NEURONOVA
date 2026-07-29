-- NeuroSpark: reparación idempotente de permisos y RLS del registro.
-- Esta migración no elimina datos. Debe ejecutarse después de
-- 202607270001_neurospark_schema.sql.

begin;

-- Las tablas deben existir antes de reparar permisos. Este bloque convierte
-- una migración previa incompleta en un error explícito, en vez de dejar un
-- esquema parcialmente protegido.
do $$
begin
    if to_regclass('public.user_profiles') is null then
        raise exception
            'Falta public.user_profiles. Ejecuta primero 202607270001_neurospark_schema.sql.'
            using errcode = '42P01';
    end if;

    if to_regclass('public.correos') is null then
        raise exception
            'Falta public.correos. Ejecuta primero 202607270001_neurospark_schema.sql.'
            using errcode = '42P01';
    end if;
end
$$;

-- PostgREST necesita acceso al esquema y a las tablas. anon no recibe acceso
-- a datos familiares; authenticated recibe solo las operaciones necesarias;
-- service_role conserva acceso CRUD completo para el Worker.
grant usage on schema public to anon, authenticated, service_role;

alter table public.user_profiles enable row level security;
alter table public.correos enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
revoke all on table public.correos from anon, authenticated;

grant select on table public.user_profiles to authenticated;
grant insert (email, state_data, user_id, user_email, alias, full_name, age, mode, is_primary)
    on table public.user_profiles to authenticated;
grant update (state_data, alias, full_name, updated_at)
    on table public.user_profiles to authenticated;
grant delete on table public.user_profiles to authenticated;

grant select on table public.correos to authenticated;
grant insert (user_email, parent_email, child_user_id, alias, full_name, age, mode, is_primary)
    on table public.correos to authenticated;
grant update (alias, full_name, updated_at)
    on table public.correos to authenticated;
grant delete on table public.correos to authenticated;

grant select, insert, update, delete
    on table public.user_profiles, public.correos to service_role;

-- Las columnas identity necesitan permiso sobre sus secuencias cuando una
-- inserción se realiza mediante PostgREST.
do $$
declare
    sequence_name text;
begin
    foreach sequence_name in array array[
        pg_get_serial_sequence('public.user_profiles', 'id'),
        pg_get_serial_sequence('public.correos', 'id')
    ]
    loop
        if sequence_name is not null then
            execute format(
                'grant usage, select on sequence %s to authenticated, service_role',
                sequence_name
            );
        end if;
    end loop;
end
$$;

-- Se eliminan todas las políticas heredadas de estas dos tablas para evitar
-- combinaciones OR inesperadas entre migraciones antiguas y nuevas.
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

-- user_profiles: estudiante y padre pueden leer la fila familiar. El
-- estudiante puede crear únicamente su propia fila y solo modificar campos
-- no sensibles. El administrador conserva la compatibilidad existente.
create policy ns_profiles_select_family
on public.user_profiles
for select
to authenticated
using (
    is_primary
    and (
        user_id = (select auth.uid())
        or parent_user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
);

create policy ns_profiles_insert_self
on public.user_profiles
for insert
to authenticated
with check (
    is_primary
    and user_id = (select auth.uid())
    and lower(coalesce(user_email, email, ''))
        = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy ns_profiles_update_student
on public.user_profiles
for update
to authenticated
using (
    is_primary
    and (
        user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
)
with check (
    is_primary
    and (
        user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
);

create policy ns_profiles_delete_admin
on public.user_profiles
for delete
to authenticated
using (
    lower(coalesce((select auth.jwt() ->> 'email'), ''))
        = 'sparkneuro64@gmail.com'
);

-- correos: el vínculo puede ser leído por sus dos integrantes. La inserción
-- heredada solo puede crear el vínculo del estudiante autenticado. Las
-- columnas sensibles no tienen permiso UPDATE y DELETE queda limitado al
-- administrador.
create policy ns_correos_select_family
on public.correos
for select
to authenticated
using (
    is_primary
    and (
        child_user_id = (select auth.uid())
        or parent_user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
);

create policy ns_correos_insert_student
on public.correos
for insert
to authenticated
with check (
    is_primary
    and child_user_id = (select auth.uid())
    and lower(coalesce(user_email, ''))
        = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create policy ns_correos_update_student
on public.correos
for update
to authenticated
using (
    is_primary
    and (
        child_user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
)
with check (
    is_primary
    and (
        child_user_id = (select auth.uid())
        or lower(coalesce((select auth.jwt() ->> 'email'), ''))
            = 'sparkneuro64@gmail.com'
    )
);

create policy ns_correos_delete_admin
on public.correos
for delete
to authenticated
using (
    lower(coalesce((select auth.jwt() ->> 'email'), ''))
        = 'sparkneuro64@gmail.com'
);

-- Las RPC públicas conservan sus permisos explícitos. No se abre acceso
-- anónimo a las tablas.
do $$
begin
    if to_regprocedure('public.is_alias_available(text)') is not null then
        execute 'revoke all on function public.is_alias_available(text) from public';
        execute 'grant execute on function public.is_alias_available(text) to anon, authenticated, service_role';
    end if;

    if to_regprocedure('public.get_my_family_context()') is not null then
        execute 'revoke all on function public.get_my_family_context() from public';
        execute 'grant execute on function public.get_my_family_context() to authenticated, service_role';
    end if;
end
$$;

-- Solicita a PostgREST que recargue inmediatamente privilegios y políticas.
notify pgrst, 'reload schema';

commit;

