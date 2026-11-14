\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- El calendario escolar de cada curso, leído solo (D-146).
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;
insert into _s select 'secreto', secreto from privado.avisos_ajustes;

select pg_temp.como(null);
select pg_temp.igual('Al principio no hay cursos leídos ni comprobación',
  (select (public.calendarios_escolares() = '{"cursos":[],"comprobadoEn":null,"resultado":null}'::jsonb)::int), 1);
select pg_temp.igual('Sin el secreto no se guarda nada',
  (select (public.guardar_calendario_escolar(repeat('0', 64), 2027, '{"inicio":"2027-09-08"}', repeat('a', 64)) is null)::int), 1);
select pg_temp.igual('Ni se anota la comprobación',
  (select (not public.anotar_comprobacion_calendario('hola', 'x'))::int), 1);
select pg_temp.igual('Con el secreto, la primera vez es nuevo',
  (select (public.guardar_calendario_escolar((select v from _s where clave = 'secreto'), 2027,
            '{"inicio":"2027-09-08"}', repeat('a', 64)) = 'nuevo')::int), 1);
select pg_temp.igual('Lo mismo otra vez, igual',
  (select (public.guardar_calendario_escolar((select v from _s where clave = 'secreto'), 2027,
            '{"inicio":"2027-09-08"}', repeat('a', 64)) = 'igual')::int), 1);
select pg_temp.igual('Si cambia, cambiado',
  (select (public.guardar_calendario_escolar((select v from _s where clave = 'secreto'), 2027,
            '{"inicio":"2027-09-09"}', repeat('b', 64)) = 'cambiado')::int), 1);
select pg_temp.igual('Se anota la comprobación',
  (select public.anotar_comprobacion_calendario((select v from _s where clave = 'secreto'), 'cambiado 2027')::int), 1);
select pg_temp.igual('Y cualquiera lo lee: el curso y la comprobación',
  (select ((j->'cursos'->0->>'anio')::int = 2027 and (j->'cursos'->0->'curso'->>'inicio') = '2027-09-09'
        and (j->>'resultado') = 'cambiado 2027' and (j->>'comprobadoEn') is not null)::int
     from (select public.calendarios_escolares() j) x), 1);
select pg_temp.falla('anon no lee la tabla',
  $q$select * from privado.calendario_escolar$q$, '42501');
select pg_temp.falla('Un año imposible no entra',
  $q$select public.guardar_calendario_escolar((select v from _s where clave = 'secreto'), 1999, '{}', repeat('c', 64))$q$, '23514');
select pg_temp.fin();

rollback;
\echo 'calendario_escolar: OK'
