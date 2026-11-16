\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- El menú del cole se lee solo (D-173).
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;
insert into _s select 'secreto', secreto from privado.avisos_ajustes;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s select 'centro', public.crear_centro((select v from _s where clave = 'hogar')::uuid, 'Colegio de prueba', 'Madrid')::text;
insert into _s select 'token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid);
-- Un día apuntado a mano antes de que llegue el automático.
select public.aplicar_cambios_cole((select v from _s where clave = 'hogar')::uuid,
  '{"dias":{"upsert":[{"fecha":"2026-12-02","primero":"A mano","segundo":null,"postre":null,"guarnicion":null,"kcal":null,"grupoPrimero":null,"grupoSegundo":null}]}}'::jsonb);
select pg_temp.fin();

-- Poner la dirección del blog lo hace quien administra (aquí, el superusuario); no la app.
select pg_temp.falla('La dirección del blog solo vale si es de blogspot',
  $q$update public.centro set fuente_menu = 'https://ejemplo.com/feeds/posts/default/-/COMEDOR'$q$, '23514');
update public.centro set fuente_menu = 'https://ceipejemplo.blogspot.com/feeds/posts/default/-/COMEDOR';

select pg_temp.como(null);
select pg_temp.igual('Sin el secreto no se ve nada',
  (public.centros_con_menu_automatico(repeat('0', 64)) is null)::int, 1);
select pg_temp.igual('Con el secreto, el colegio, su blog y el enlace del hogar',
  (select (j->0->>'fuente' like 'https://ceipejemplo.blogspot.com/%'
           and (j->0->'tokens'->>0) = (select v from _s where clave = 'token'))::int
     from (select public.centros_con_menu_automatico((select v from _s where clave = 'secreto')) as j) q), 1);

select pg_temp.igual('Sin el secreto, no se carga',
  (public.registrar_menu_cole_automatico(repeat('0', 64), (select v from _s where clave = 'centro')::uuid, 'p1', 'x',
     '[{"fecha":"2026-12-01","primero":"Lentejas"}]'::jsonb) is null)::int, 1);
select pg_temp.igual('Con un colegio sin blog, tampoco',
  (public.registrar_menu_cole_automatico((select v from _s where clave = 'secreto'), gen_random_uuid(), 'p1', 'x', null) is null)::int, 1);

select pg_temp.igual('Carga los días que faltan y no pisa el apuntado a mano',
  (public.registrar_menu_cole_automatico((select v from _s where clave = 'secreto'), (select v from _s where clave = 'centro')::uuid, 'https://blog/p1', 'ok',
    '[{"fecha":"2026-12-01","primero":"Lentejas","segundo":"Tortilla","postre":"Fruta","guarnicion":null,"kcal":600,"grupoPrimero":null,"grupoSegundo":null},
      {"fecha":"2026-12-02","primero":"Del blog","segundo":null,"postre":null,"guarnicion":null,"kcal":null,"grupoPrimero":null,"grupoSegundo":null}]'::jsonb) = 'cargado:1')::int, 1);
select pg_temp.fin();
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Quedan dos días y el de a mano sigue como estaba',
  (select (count(*) = 2 and bool_and(primero = case when fecha = '2026-12-02' then 'A mano' else 'Lentejas' end))::int
     from public.menu_cole_dia where centro_id = (select v from _s where clave = 'centro')::uuid), 1);
select pg_temp.fin();
select pg_temp.como(null);

select pg_temp.igual('Anota un fallo sin cargar nada, y si se repite cuenta los intentos',
  (public.registrar_menu_cole_automatico((select v from _s where clave = 'secreto'), (select v from _s where clave = 'centro')::uuid, 'https://blog/p2', 'error: pdf') = 'error: pdf')::int, 1);
select public.registrar_menu_cole_automatico((select v from _s where clave = 'secreto'), (select v from _s where clave = 'centro')::uuid, 'https://blog/p2', 'error: pdf');
select pg_temp.igual('Lo ya visto sale con sus intentos',
  (select (jsonb_array_length(j) = 2 and exists (
              select 1 from jsonb_array_elements(j) e
               where e->>'post' = 'https://blog/p2' and (e->>'intentos')::int = 2))::int
     from (select public.fuentes_menu_vistas((select v from _s where clave = 'secreto'), (select v from _s where clave = 'centro')::uuid) as j) q), 1);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Un usuario no lee lo anotado por la carga automática',
  $q$select * from privado.menu_cole_fuente$q$, '42501');
select pg_temp.fin();
rollback;
