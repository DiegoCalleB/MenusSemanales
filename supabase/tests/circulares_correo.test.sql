\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Circulares del cole por correo (D-147).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s values ('codigo', public.codigo_circulares((select v from _s where clave = 'hogar')::uuid));
select pg_temp.igual('El código tiene 16 letras y números',
  ((select v from _s where clave = 'codigo') ~ '^[a-z0-9]{16}$')::int, 1);
select pg_temp.igual('Pedirlo otra vez da el mismo',
  (public.codigo_circulares((select v from _s where clave = 'hogar')::uuid) = (select v from _s where clave = 'codigo'))::int, 1);
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('Otro no puede ver el código de un hogar ajeno',
  $q$select public.codigo_circulares((select v from _s where clave = 'hogar')::uuid)$q$, '42501');
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Con un código que no existe, nada',
  (public.guardar_circular_correo('zzzzzzzzzzzzzzzz', 'e1', 'x', '[]') is null)::int, 1);
select pg_temp.igual('Con cosas mal escritas, no se guarda',
  (public.guardar_circular_correo((select v from _s where clave = 'codigo'), 'e0', 'x', '[{"tipo":"otra","titulo":"x"}]') = 'no-valido')::int, 1);
select pg_temp.igual('Con el código, se guarda',
  (public.guardar_circular_correo((select v from _s where clave = 'codigo'), 'e1', 'Excursión',
     '[{"tipo":"cita","titulo":"Excursión al zoo","fecha":"2026-12-01","hasta":null,"hora":null}]') = 'guardada')::int, 1);
select pg_temp.igual('El mismo correo otra vez, no se duplica',
  (public.guardar_circular_correo((select v from _s where clave = 'codigo'), 'e1', 'Excursión', '[]') = 'repetida')::int, 1);
select pg_temp.falla('anon no lee las circulares',
  $q$select * from public.circular_correo$q$, '42501');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('La familia la ve pendiente',
  (select count(*)::int from public.circular_correo where revisada_en is null), 1);
select pg_temp.igual('También por la función, con lo leído',
  (select (j->0->>'asunto' = 'Excursión' and j->0->'items'->0->>'titulo' = 'Excursión al zoo')::int
     from (select public.circulares_pendientes((select v from _s where clave = 'hogar')::uuid) j) x), 1);
select pg_temp.igual('Y la marca como revisada',
  public.revisar_circular_correo((select id from public.circular_correo limit 1))::int, 1);
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Otro hogar no la ve',
  (select count(*)::int from public.circular_correo), 0);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('nuevo', public.codigo_circulares((select v from _s where clave = 'hogar')::uuid, true));
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.igual('Al cambiar la dirección, la vieja deja de valer',
  (public.guardar_circular_correo((select v from _s where clave = 'codigo'), 'e2', 'x', '[]') is null)::int, 1);
select pg_temp.fin();

rollback;
\echo 'circulares_correo: OK'
