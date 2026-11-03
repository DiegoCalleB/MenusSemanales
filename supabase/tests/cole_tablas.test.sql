\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'ana@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _codigo (c text);
grant all on _codigo to authenticated;
create temp table _r (clave text primary key, j jsonb);
grant all on _r to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _codigo select public.crear_invitacion((select id from _ids where clave = 'HA'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select public.unirse_a_hogar((select c from _codigo));   -- Ana: miembro no admin de A
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

-- Sin colegio: la lectura lo dice y escribir sin indicar colegio falla.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Sin colegio: centro nulo y sin días',
  (select ((j->'centro') = 'null'::jsonb and jsonb_array_length(j->'dias') = 0)::int
     from (select public.leer_cole_tablas((select id from _ids where clave = 'HA')) j) t), 1);
select pg_temp.falla('Escribir días sin colegio ni nombre falla',
  $$select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), '{"dias": {"upsert": []}}'::jsonb)$$, '22023');

-- La primera vez crea el colegio y vincula al hogar como curador.
select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), $j$
{"centro": {"nombre": "Colegio de prueba", "localidad": "Madrid"},
 "dias": {"upsert": [
  {"fecha": "2026-11-03", "primero": "Guiso de lentejas", "segundo": "Tortilla de patata", "postre": "Fruta",
   "guarnicion": "Ensalada", "kcal": 601, "grupoPrimero": "legumbre", "grupoSegundo": "huevo"},
  {"fecha": "2026-11-04", "primero": "Arroz tres delicias", "grupoPrimero": "arroz"}]}}
$j$::jsonb);
insert into _r select 'lectura', public.leer_cole_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Se creó el colegio y se leen los 2 días en orden',
  (select ((j->'centro'->>'nombre') = 'Colegio de prueba' and (j->'centro'->>'rol') = 'curador'
           and jsonb_array_length(j->'dias') = 2 and (j->'dias'->0->>'fecha') = '2026-11-03')::int from _r where clave = 'lectura'), 1);
select pg_temp.igual('Guarnición, kcal y grupos llegan completos; lo que falta, nulo',
  (select ((j->'dias'->0->>'guarnicion') = 'Ensalada' and (j->'dias'->0->>'kcal')::int = 601
           and (j->'dias'->0->>'grupoSegundo') = 'huevo'
           and (j->'dias'->1->'segundo') = 'null'::jsonb and (j->'dias'->1->'kcal') = 'null'::jsonb)::int
     from _r where clave = 'lectura'), 1);
select pg_temp.igual('Hay un solo colegio y el historial recoge las altas',
  (select (select count(*) from public.centro) * 10 + (select count(*) from public.menu_cole_dia_historial where operacion = 'INSERT')), 12);

-- Cambiar un día lo actualiza (y el historial lo recuerda).
select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), $j$
{"dias": {"upsert": [{"fecha": "2026-11-04", "primero": "Arroz con tomate", "grupoPrimero": "arroz"}]}}
$j$::jsonb);
select pg_temp.igual('El día se actualizó y el historial guardó el cambio',
  (select ((select primero from public.menu_cole_dia where fecha = '2026-11-04') = 'Arroz con tomate')::int
        + (select count(*) from public.menu_cole_dia_historial where operacion = 'UPDATE')::int), 2);

-- Un menú inválido se rechaza entero (grupo inexistente, sin primero ni segundo).
select pg_temp.falla('Un grupo inventado se rechaza',
  $$select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), '{"dias": {"upsert": [{"fecha": "2026-11-05", "primero": "X", "grupoPrimero": "inventado"}]}}'::jsonb)$$, '23514');
select pg_temp.falla('Un día sin primero ni segundo se rechaza',
  $$select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), '{"dias": {"upsert": [{"fecha": "2026-11-05"}]}}'::jsonb)$$, '23514');
select pg_temp.fin();

-- Borrar: el curador (hogar A) puede; Ana, del mismo hogar, también (el vínculo es del hogar).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), '{"dias": {"borrar": ["2026-11-04"]}}'::jsonb);
select pg_temp.igual('Borrado un día queda 1',
  (select jsonb_array_length(public.leer_cole_tablas((select id from _ids where clave = 'HA'))->'dias')), 1);
select pg_temp.fin();

-- Aislamiento: otro hogar ni ve ni escribe el colegio de A.
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.falla('Otro hogar no lee el cole de A',
  $$select public.leer_cole_tablas((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.falla('Otro hogar no escribe el cole de A',
  $$select public.aplicar_cambios_cole((select id from _ids where clave = 'HA'), '{"dias": {"upsert": []}}'::jsonb)$$, '42501');
select pg_temp.igual('Otro hogar ve su cole vacío',
  (select ((public.leer_cole_tablas((select id from _ids where clave = 'HC'))->'centro') = 'null'::jsonb)::int), 1);
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.falla('anon no lee el cole', $$select public.leer_cole_tablas((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.fin();

rollback;
