\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _r (clave text primary key, j jsonb);
grant all on _r to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

-- Tope bajo a mano (como lo haría el administrador con SQL).
insert into public.ia_ajuste (hogar_id, limite_diario) select id, 2 from _ids where clave = 'HA';

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _r select 'u1', public.usar_ia((select id from _ids where clave = 'HA'));
select pg_temp.igual('La primera llamada cuenta 1 de 2',
  (select ((j->>'usadas')::int = 1 and (j->>'limite')::int = 2)::int from _r where clave = 'u1'), 1);
insert into _r select 'u2', public.usar_ia((select id from _ids where clave = 'HA'));
select pg_temp.falla('La tercera supera el tope',
  $$select public.usar_ia((select id from _ids where clave = 'HA'))$$, '53400');
select pg_temp.fin();
select pg_temp.igual('Tras el rechazo sigue en 2 (no se apuntó la tercera)',
  (select usadas from public.ia_uso where hogar_id = (select id from _ids where clave = 'HA')), 2);

-- Otro hogar tiene su propio contador y el tope por defecto (40).
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _r select 'c1', public.usar_ia((select id from _ids where clave = 'HC'));
select pg_temp.igual('El hogar C usa el tope por defecto de 40',
  (select ((j->>'usadas')::int = 1 and (j->>'limite')::int = 40)::int from _r where clave = 'c1'), 1);
select pg_temp.falla('Quien no es del hogar A no puede gastar su tope',
  $$select public.usar_ia((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.falla('Un usuario no puede leer el contador directamente',
  $$select count(*) from public.ia_uso$$, '42501');
select pg_temp.falla('ni subirse el tope',
  $$update public.ia_ajuste set limite_diario = 1000$$, '42501');
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('anon no puede usar la IA',
  $$select public.usar_ia((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.fin();

rollback;
