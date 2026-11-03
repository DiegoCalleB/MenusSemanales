\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _t (clave text primary key, token text);
grant all on _t to authenticated, anon;
create temp table _r (clave text primary key, j jsonb);
grant all on _r to authenticated, anon;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
-- El documento viejo dice una cosa; las tablas, otra. Manda lo de las tablas.
select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 0,
  '{"personas":[{"id":"viejo","nombre":"Viejo","tipo":"adulto","activa":true}],
    "comidas":[{"fecha":"2026-11-09","plato":{"nombre":"Del documento"}}]}'::jsonb);
insert into _t select 'A', public.enlace_calendario((select id from _ids where clave = 'HA'));
select pg_temp.fin();

-- Datos en tablas (como propietario; en la app llegan por los motores).
insert into public.persona (id, hogar_id, nombre, tipo)
values ('dddddddd-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'Diego', 'adulto');
insert into public.plato (id, hogar_id, nombre, rol)
values ('eeeeeeee-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'Sopa', 'principal'),
       ('eeeeeeee-0000-0000-0000-000000000002', (select id from _ids where clave = 'HA'), 'Tortilla', 'principal');
insert into public.comida_planificada (id, hogar_id, fecha, momento, raciones)
values ('ffffffff-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), '2026-11-10', 'cena', 3);
insert into public.comida_plato (comida_id, hogar_id, plato_id, orden)
values ('ffffffff-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'eeeeeeee-0000-0000-0000-000000000002', 1),
       ('ffffffff-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'eeeeeeee-0000-0000-0000-000000000001', 0);
insert into public.almuerzo (hogar_id, fecha, texto) values ((select id from _ids where clave = 'HA'), '2026-11-10', 'Paella');
insert into public.apunte (hogar_id, fecha, hora, titulo) values ((select id from _ids where clave = 'HA'), '2026-11-12', '18:15', 'Psicotécnico');
insert into public.fecha_senalada (hogar_id, fecha, titulo, emoji) values ((select id from _ids where clave = 'HA'), '2026-11-20', 'Fiesta', '🎉');
insert into public.tarea_casa (hogar_id, titulo, cada_dias, desde) values ((select id from _ids where clave = 'HA'), 'Sábanas', 14, '2026-11-02');
insert into public.cumple (id, hogar_id, persona_id, nombre, dia, mes, anio)
values ('99999999-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'dddddddd-0000-0000-0000-000000000001', 'Diego', 7, 11, 1984);
insert into public.cumple_regalo (cumple_id, hogar_id, estado, anio_estado, gustos)
values ('99999999-0000-0000-0000-000000000001', (select id from _ids where clave = 'HA'), 'comprado', 2026, array['flores secretas']);

-- Como anon (el servidor del calendario).
select pg_temp.como(null);
insert into _r select 'r', public.estado_para_calendario((select token from _t where clave = 'A'));
select pg_temp.fin();

select pg_temp.igual('Las personas salen de la tabla, no del documento',
  (select ((j->'personas'->0->>'nombre') = 'Diego' and jsonb_array_length(j->'personas') = 1)::int from _r where clave = 'r'), 1);
select pg_temp.igual('La cena sale de las tablas: un registro por plato y en orden (no el del documento)',
  (select ((j->'cenas'->0->>'nombre') = 'Sopa' and (j->'cenas'->1->>'nombre') = 'Tortilla' and jsonb_array_length(j->'cenas') = 2)::int from _r where clave = 'r'), 1);
select pg_temp.igual('Comida del mediodía, apunte con hora, fecha señalada, tarea de casa y cumpleaños',
  (select ((j->'almuerzos'->0->>'texto') = 'Paella'
        and (j->'agenda'->0->>'hora') = '18:15' and (j->'agenda'->0->>'titulo') = 'Psicotécnico'
        and (j->'eventos'->'2026-11-20'->>'titulo') = 'Fiesta'
        and (j->'casa'->0->>'titulo') = 'Sábanas' and (j->'casa'->0->>'cadaDias')::int = 14
        and (j->'cumples'->0->>'nombre') = 'Diego' and (j->'cumples'->0->>'mes')::int = 11)::int
     from _r where clave = 'r'), 1);
select pg_temp.igual('No sale el regalo ni los gustos',
  (select (j::text !~ 'flores secretas' and j::text !~ 'comprado')::int from _r where clave = 'r'), 1);
select pg_temp.igual('No sale nada del documento viejo',
  (select (j::text !~ 'Del documento' and j::text !~ 'Viejo')::int from _r where clave = 'r'), 1);
select pg_temp.igual('Solo las claves de siempre',
  (select (select count(*)::int from jsonb_object_keys(j) k where k in
     ('agenda','almuerzos','casa','cenas','cumples','eventos','personas')) from _r where clave = 'r'), 7);
select pg_temp.igual('Y ninguna más',
  (select count(*)::int from _r, jsonb_object_keys(j) where clave = 'r'), 7);
select pg_temp.igual('Token inventado: nada',
  (select (public.estado_para_calendario(repeat('0', 64)) is null)::int), 1);

rollback;
