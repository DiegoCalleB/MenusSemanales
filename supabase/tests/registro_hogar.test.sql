\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- Personas (como propietario de la tabla: en la app llegan por el motor de personas).
insert into public.persona (id, hogar_id, nombre, tipo)
select 'dddddddd-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'Diego', 'adulto';
insert into public.persona (id, hogar_id, nombre, tipo)
select 'dddddddd-0000-0000-0000-000000000002', (select id from _ids where clave = 'HB'), 'Otra', 'adulto';

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');

select pg_temp.igual('Al empezar no hay nada apuntado',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'filas')), 0);

select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), format($j$
{"upsert": [
  {"id": "11111111-1111-4111-8111-111111111111", "fecha": "%1$s", "que": "Cena", "personaId": "dddddddd-0000-0000-0000-000000000001"},
  {"id": "22222222-2222-4222-8222-222222222222", "fecha": "%1$s", "que": "Gatos", "personaId": "dddddddd-0000-0000-0000-000000000001"}]}
$j$, (now() at time zone 'Europe/Madrid')::date)::jsonb);
select pg_temp.igual('Se leen las 2 cosas apuntadas',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'filas')), 2);

-- Repetir lo mismo no duplica (mismo id) ni con otro id si es la misma cosa y persona (única).
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), format($j$
{"upsert": [{"id": "11111111-1111-4111-8111-111111111111", "fecha": "%1$s", "que": "Cena", "personaId": "dddddddd-0000-0000-0000-000000000001"}]}
$j$, (now() at time zone 'Europe/Madrid')::date)::jsonb);
select pg_temp.igual('Repetir el mismo id no duplica',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'filas')), 2);
select pg_temp.falla('La misma cosa del mismo día por la misma persona con otro id choca con la restricción única',
  format($$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"upsert": [{"id": "33333333-3333-4333-8333-333333333333", "fecha": "%1$s", "que": " cena ", "personaId": "dddddddd-0000-0000-0000-000000000001"}]}'::jsonb)$$,
    (now() at time zone 'Europe/Madrid')::date), '23505');

-- Quitar.
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
  '{"borrar": ["22222222-2222-4222-8222-222222222222"]}'::jsonb);
select pg_temp.igual('Quitar una deja solo la otra',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'filas')), 1);

-- Solo los últimos 60 días se leen.
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), format($j$
{"upsert": [{"id": "44444444-4444-4444-8444-444444444444", "fecha": "%1$s", "que": "Compra", "personaId": "dddddddd-0000-0000-0000-000000000001"}]}
$j$, (now() at time zone 'Europe/Madrid')::date - 90)::jsonb);
select pg_temp.igual('Lo de hace 90 días no se lee',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'filas')), 1);

-- Validación.
select pg_temp.falla('Texto de una letra no vale',
  format($$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"upsert": [{"id": "55555555-5555-4555-8555-555555555555", "fecha": "%1$s", "que": "x", "personaId": "dddddddd-0000-0000-0000-000000000001"}]}'::jsonb)$$,
    (now() at time zone 'Europe/Madrid')::date), '23514');
select pg_temp.falla('No se puede apuntar a una persona de otro hogar',
  format($$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"upsert": [{"id": "66666666-6666-4666-8666-666666666666", "fecha": "%1$s", "que": "Cena", "personaId": "dddddddd-0000-0000-0000-000000000002"}]}'::jsonb)$$,
    (now() at time zone 'Europe/Madrid')::date), '23503');

-- Aislamiento: otro hogar no ve ni escribe el mío.
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('Otro hogar no puede leer el registro del mío',
  format($$select public.leer_registro_tablas('%s')$$, (select id from _ids where clave = 'HA')), '42501');
select pg_temp.falla('Otro hogar no puede escribir en el registro del mío',
  format($$select public.aplicar_cambios_registro('%s', '{"borrar": []}'::jsonb)$$, (select id from _ids where clave = 'HA')), '42501');
select pg_temp.igual('Ni lo ve con select directo (RLS)', (select count(*)::int from public.registro_hogar), 0);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('Sin sesión (anon) no puede leer: sin permiso de ejecución',
  $$select public.leer_registro_tablas('00000000-0000-0000-0000-000000000000')$$, '42501');
select pg_temp.fin();

rollback;
