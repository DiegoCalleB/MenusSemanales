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

insert into public.persona (id, hogar_id, nombre, tipo)
select 'dddddddd-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'Alba', 'nino';
insert into public.persona (id, hogar_id, nombre, tipo)
select 'dddddddd-0000-0000-0000-000000000002', (select id from _ids where clave = 'HB'), 'Otra', 'adulto';

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');

select pg_temp.igual('Al empezar no hay premios ni canjes',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'premios')
        + jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'canjes')), 0);

select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), $j$
{"premios": {"upsert": [
  {"id": "11111111-1111-4111-8111-111111111111", "nombre": "Elegir la peli", "coste": 5, "emoji": "🎬"},
  {"id": "22222222-2222-4222-8222-222222222222", "nombre": "Postre especial", "coste": 8, "emoji": "🍨"}]}}
$j$::jsonb);
select pg_temp.igual('Se leen los 2 premios, el más barato primero',
  (select (public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'premios'->0->>'nombre' = 'Elegir la peli')::int), 1);

-- Editar un premio cambia nombre y coste sin duplicar.
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), $j$
{"premios": {"upsert": [{"id": "11111111-1111-4111-8111-111111111111", "nombre": "Elegir la peli", "coste": 6, "emoji": "🎬"}]}}
$j$::jsonb);
select pg_temp.igual('Editar el coste no duplica',
  (select count(*)::int from public.premio_hogar), 2);
select pg_temp.igual('Y guarda el coste nuevo',
  (select coste from public.premio_hogar where id = '11111111-1111-4111-8111-111111111111'), 6);

select pg_temp.falla('Dos premios con el mismo nombre chocan',
  $$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"premios": {"upsert": [{"id": "33333333-3333-4333-8333-333333333333", "nombre": " elegir la PELI ", "coste": 3, "emoji": "x"}]}}'::jsonb)$$, '23505');
select pg_temp.falla('Un coste de 0 no vale',
  $$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"premios": {"upsert": [{"id": "44444444-4444-4444-8444-444444444444", "nombre": "Gratis", "coste": 0, "emoji": "x"}]}}'::jsonb)$$, '23514');

-- Canjes: se guardan con nombre y coste de entonces; borrar el premio no los toca.
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'), format($j$
{"canjes": {"upsert": [{"id": "55555555-5555-4555-8555-555555555555", "premioId": "11111111-1111-4111-8111-111111111111",
  "nombre": "Elegir la peli", "coste": 6, "personaId": "dddddddd-0000-0000-0000-000000000001", "fecha": "%s"}]}}
$j$, (now() at time zone 'Europe/Madrid')::date)::jsonb);
select pg_temp.igual('Se lee el canje',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'canjes')), 1);
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
  '{"premios": {"borrar": ["11111111-1111-4111-8111-111111111111"]}}'::jsonb);
select pg_temp.igual('Borrar el premio deja el canje',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'canjes')), 1);
select pg_temp.falla('No se canjea a una persona de otro hogar',
  format($$select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
    '{"canjes": {"upsert": [{"id": "66666666-6666-4666-8666-666666666666", "premioId": null, "nombre": "Algo", "coste": 1,
      "personaId": "dddddddd-0000-0000-0000-000000000002", "fecha": "%s"}]}}'::jsonb)$$,
    (now() at time zone 'Europe/Madrid')::date), '23503');
select public.aplicar_cambios_registro((select id from _ids where clave = 'HA'),
  '{"canjes": {"borrar": ["55555555-5555-4555-8555-555555555555"]}}'::jsonb);
select pg_temp.igual('Devolver un canje lo quita',
  (select jsonb_array_length(public.leer_registro_tablas((select id from _ids where clave = 'HA'))->'canjes')), 0);

-- Aislamiento.
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Otro hogar no ve mis premios (RLS)', (select count(*)::int from public.premio_hogar), 0);
select pg_temp.igual('Ni mis canjes (RLS)', (select count(*)::int from public.canje_hogar), 0);
select pg_temp.falla('Ni puede escribir en mi hogar',
  format($$select public.aplicar_cambios_registro('%s', '{"premios": {"borrar": []}}'::jsonb)$$, (select id from _ids where clave = 'HA')), '42501');
select pg_temp.fin();

rollback;
