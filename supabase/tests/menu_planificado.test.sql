\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into public.persona (hogar_id, nombre, tipo) select id, 'Diego', 'adulto' from _ids where clave = 'HA';
insert into _ids select 'pDiego', id from public.persona where nombre = 'Diego';
with p as (insert into public.plato (hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min)
  select id, 'Pasta con tomate', 'principal', 'pasta', 20, 30 from _ids where clave = 'HA' returning id)
insert into _ids select 'plato', id from p;
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
with p as (insert into public.plato (hogar_id, nombre, rol, grupo)
  select id, 'Plato de B', 'principal', 'carne' from _ids where clave = 'HB' returning id)
insert into _ids select 'platoB', id from p;
select pg_temp.fin();

-- Vocabulario de grupos nuevo; los antiguos ya no valen.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Grupo antiguo rechazado', $q$update public.plato set grupo = 'carne_roja'$q$, '23514');

-- Comida planificada: un miembro planifica la cena del día (una por día y momento) y le pone platos.
insert into public.comida_planificada (hogar_id, fecha, raciones)
  select id, date '2026-11-05', 3 from _ids where clave = 'HA';
select pg_temp.igual('Planifica una cena', pg_temp.cuenta('select 1 from public.comida_planificada'), 1);
select pg_temp.falla('Una sola cena por día',
  $q$insert into public.comida_planificada (hogar_id, fecha, raciones)
     select id, date '2026-11-05', 3 from _ids where clave = 'HA'$q$, '23505');
select pg_temp.falla('Raciones positivas',
  $q$insert into public.comida_planificada (hogar_id, fecha, raciones)
     select id, date '2026-11-06', 0 from _ids where clave = 'HA'$q$, '23514');
insert into public.comida_plato (comida_id, hogar_id, plato_id, orden)
  select c.id, c.hogar_id, p.id, 0 from public.comida_planificada c, _ids p where p.clave = 'plato';
select pg_temp.igual('La cena lleva un plato', pg_temp.cuenta('select 1 from public.comida_plato'), 1);
select pg_temp.falla('No se puede poner el plato de otro hogar en la cena (FK compuesta)',
  $q$insert into public.comida_plato (comida_id, hogar_id, plato_id, orden)
     select c.id, c.hogar_id, p.id, 1 from public.comida_planificada c, _ids p where p.clave = 'platoB'$q$, '23503');

-- Día y valoraciones.
insert into public.dia_hogar (hogar_id, fecha, llega_tarde) select id, date '2026-11-05', true from _ids where clave = 'HA';
insert into public.valoracion_plato (hogar_id, plato_id, persona_id, puntos)
  select h.id, p.id, d.id, 5 from _ids h, _ids p, _ids d where h.clave = 'HA' and p.clave = 'plato' and d.clave = 'pDiego';
select pg_temp.falla('Valoración entre 1 y 5',
  $q$update public.valoracion_plato set puntos = 6$q$, '23514');
select pg_temp.fin();

-- Aislamiento: B no ve ni toca nada de A.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve cenas de A', pg_temp.cuenta('select 1 from public.comida_planificada'), 0);
select pg_temp.igual('B no ve días de A', pg_temp.cuenta('select 1 from public.dia_hogar'), 0);
select pg_temp.igual('B no ve valoraciones de A', pg_temp.cuenta('select 1 from public.valoracion_plato'), 0);
select pg_temp.falla('B no puede planificar en el hogar de A',
  $q$insert into public.comida_planificada (hogar_id, fecha, raciones)
     select id, date '2026-11-07', 3 from _ids where clave = 'HA'$q$, '42501');
select pg_temp.fin();

-- anon no puede nada.
select pg_temp.como(null);
select pg_temp.falla('anon no lee cenas', $q$select * from public.comida_planificada$q$, '42501');
select pg_temp.fin();

rollback;
\echo 'menu_planificado: OK'
