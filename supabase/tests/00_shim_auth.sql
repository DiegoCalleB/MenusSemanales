-- Imita lo mínimo de Supabase que necesitan las migraciones y los tests:
-- roles, esquema auth (users, uid) y esquema extensions con pgcrypto.
-- SOLO para Postgres de pruebas (local/CI); nunca se aplica a Supabase.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon')          then create role anon          nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role')  then create role service_role  nologin bypassrls; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (id uuid primary key, email text);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase concede POR DEFECTO todos los privilegios a anon, authenticated y service_role sobre
-- cualquier tabla, secuencia o función que se cree en public. Las pruebas deben partir de lo mismo:
-- sin esto, una migración que solo revoca a anon y a public parece segura en local y no lo es en
-- producción (hallazgo D-064).
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
