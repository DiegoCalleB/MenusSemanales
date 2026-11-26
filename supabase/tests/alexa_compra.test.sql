\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Alexa → lista de la compra (D-214).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s values ('token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid, false));
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Con un token que no existe, nada',
  (public.alexa_anadir_compra(repeat('0', 64), 'leche') is null)::int, 1);
select pg_temp.igual('Con un token mal escrito, nada',
  (public.alexa_anadir_compra('x', 'leche') is null)::int, 1);
select pg_temp.igual('Vacío no vale',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), '   ') = 'no-valido')::int, 1);
select pg_temp.igual('Demasiado largo no vale',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), repeat('a', 81)) = 'no-valido')::int, 1);
select pg_temp.igual('Con el token del hogar se guarda',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), '  pan   de  molde ') = 'ok')::int, 1);
select pg_temp.igual('Y otro',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), 'leche') = 'ok')::int, 1);
select pg_temp.falla('Sin sesión no se recoge nada',
  $q$select public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('Otro hogar no recoge lo ajeno',
  $q$select public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('El miembro recoge lo pendiente, limpio y en orden',
  (public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid) = '["pan de molde","leche"]'::jsonb)::int, 1);
select pg_temp.igual('Una segunda vez ya no hay nada (cada producto se recibe una sola vez)',
  (public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid) = '[]'::jsonb)::int, 1);
select pg_temp.fin();

select pg_temp.como(null);
do $$ begin
  for i in 1..40 loop
    perform public.alexa_anadir_compra((select v from _s where clave = 'token'), 'cosa ' || i);
  end loop;
end $$;
select pg_temp.igual('Al día hay tope',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), 'otra') = 'demasiadas')::int, 1);
select pg_temp.fin();

select pg_temp.igual('La tabla no se toca directamente',
  (has_table_privilege('anon', 'public.compra_alexa', 'SELECT')
   or has_table_privilege('authenticated', 'public.compra_alexa', 'SELECT'))::int, 0);

rollback;
