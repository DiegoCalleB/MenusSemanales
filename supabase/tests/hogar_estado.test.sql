\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _ids values ('codigo', null);
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- Primer guardado: versión esperada 0 → versión 1.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('El primer guardado crea la versión 1',
  public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 0, '{"menu": 1}'::jsonb), 1);
select pg_temp.igual('Un segundo guardado con la versión conocida sube a 2',
  public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 1, '{"menu": 2}'::jsonb), 2);
select pg_temp.falla('Guardar con una versión vieja se rechaza (otro dispositivo guardó antes)',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 1, '{"menu": 3}'::jsonb)$q$, '40001');
select pg_temp.falla('Crear de nuevo con versión 0 cuando ya existe se rechaza',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 0, '{"menu": 3}'::jsonb)$q$, '40001');
select pg_temp.falla('La versión de un hogar sin estado no vale 5',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HB'), 5, '{}'::jsonb)$q$, '42501');
select pg_temp.igual('El miembro lee el estado', pg_temp.cuenta('select 1 from public.hogar_estado'), 1);
select pg_temp.igual('El estado guardado es el último', (select (estado->>'menu')::bigint from public.hogar_estado), 2);

-- Validaciones.
select pg_temp.falla('El estado debe ser un objeto',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, '[1,2]'::jsonb)$q$, '22023');
select pg_temp.falla('El estado no puede ser nulo',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, null)$q$, '22023');
select pg_temp.falla('Un estado enorme se rechaza',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, jsonb_build_object('x', repeat('a', 1600000)))$q$, '54000');

-- Escritura directa: sin privilegios.
select pg_temp.falla('Nadie inserta directamente',
  $q$insert into public.hogar_estado (hogar_id, estado) select id, '{}' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('Nadie actualiza directamente',
  $q$update public.hogar_estado set estado = '{"hack": true}'$q$, '42501');
select pg_temp.falla('Nadie borra directamente', $q$delete from public.hogar_estado$q$, '42501');
select pg_temp.fin();

-- Aislamiento: B no ve ni guarda en el hogar de A.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve el estado de A', pg_temp.cuenta('select 1 from public.hogar_estado'), 0);
select pg_temp.falla('B no puede guardar en el hogar de A',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, '{"hack": true}'::jsonb)$q$, '42501');
select pg_temp.igual('B guarda en el suyo',
  public.guardar_estado_hogar((select id from _ids where clave = 'HB'), 0, '{"b": 1}'::jsonb), 1);
select pg_temp.fin();

-- C no pertenece a ningún hogar.
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('C no ve nada', pg_temp.cuenta('select 1 from public.hogar_estado'), 0);
select pg_temp.falla('C no puede guardar',
  $q$select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, '{}'::jsonb)$q$, '42501');
select pg_temp.fin();

-- Un nuevo miembro (C se une con invitación) ve el estado y puede guardar con la versión actual.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
update _ids set id = null where clave = 'codigo';
create temp table _codigo (c text);
grant all on _codigo to authenticated;
insert into _codigo select public.crear_invitacion((select id from _ids where clave = 'HA'));
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select public.unirse_a_hogar((select c from _codigo));
select pg_temp.igual('Tras unirse, C ve el estado', pg_temp.cuenta('select 1 from public.hogar_estado'), 1);
select pg_temp.igual('C guarda con la versión actual',
  public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 2, '{"menu": 3, "por": "C"}'::jsonb), 3);
select pg_temp.fin();

-- anon no puede nada.
select pg_temp.como(null);
select pg_temp.falla('anon no lee', $q$select * from public.hogar_estado$q$, '42501');
select pg_temp.falla('anon no guarda',
  $q$select public.guardar_estado_hogar(gen_random_uuid(), 0, '{}'::jsonb)$q$, '42501');
select pg_temp.fin();

rollback;
\echo 'hogar_estado: OK'
