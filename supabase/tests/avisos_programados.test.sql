\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Notificaciones sin configurar nada a mano (D-139).
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;
insert into _s select 'secreto', secreto from privado.avisos_ajustes;
insert into _s values ('publica', repeat('B', 87)), ('privada', repeat('p', 43)),
                      ('otra_publica', repeat('C', 87)), ('otra_privada', repeat('q', 43));

select pg_temp.igual('Hay un secreto de 64 caracteres hexadecimales, creado al azar',
  (select (secreto ~ '^[0-9a-f]{64}$')::int from privado.avisos_ajustes), 1);

-- Como anon (lo que usa el servidor de la app).
select pg_temp.como(null);
select pg_temp.igual('Sin secreto no hay claves',
  (select (public.claves_de_avisos(repeat('0', 64)) is null)::int), 1);
select pg_temp.igual('Un secreto mal formado tampoco',
  (select (public.claves_de_avisos('hola') is null)::int), 1);
select pg_temp.igual('Ni se pueden guardar claves sin él',
  (select (public.guardar_claves_de_avisos(repeat('0', 64), (select v from _s where clave = 'publica'),
                                           (select v from _s where clave = 'privada')) is null)::int), 1);
select pg_temp.igual('Al principio no hay clave pública',
  (select (public.clave_publica_de_avisos() is null)::int), 1);
select pg_temp.igual('Con el secreto se guardan la primera vez',
  (select (public.guardar_claves_de_avisos((select v from _s where clave = 'secreto'),
            (select v from _s where clave = 'publica'), (select v from _s where clave = 'privada'))
           ->>'privada' = (select v from _s where clave = 'privada'))::int), 1);
select pg_temp.igual('Y no se pisan después: se devuelven las que había',
  (select (public.guardar_claves_de_avisos((select v from _s where clave = 'secreto'),
            (select v from _s where clave = 'otra_publica'), (select v from _s where clave = 'otra_privada'))
           ->>'publica' = (select v from _s where clave = 'publica'))::int), 1);
select pg_temp.igual('La pública la puede pedir cualquiera',
  (select (public.clave_publica_de_avisos() = (select v from _s where clave = 'publica'))::int), 1);
select pg_temp.igual('La privada, solo con el secreto',
  (select (public.claves_de_avisos((select v from _s where clave = 'secreto'))->>'privada'
           = (select v from _s where clave = 'privada'))::int), 1);
select pg_temp.falla('anon no lee la tabla de ajustes',
  $q$select * from privado.avisos_ajustes$q$, '42501');
select pg_temp.falla('anon no puede lanzar las llamadas',
  $q$select privado.lanzar_avisos()$q$, '42501');
select pg_temp.fin();

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Un usuario con sesión tampoco lee la tabla',
  $q$select secreto from privado.avisos_ajustes$q$, '42501');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select public.guardar_suscripcion_push((select id from _ids where clave = 'HA'),
  'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001', repeat('p', 40), repeat('a', 20));
select pg_temp.fin();
select pg_temp.igual('Al suscribir un móvil, el hogar tiene ya su token para los avisos',
  (select count(*)::int from public.hogar_calendario where hogar_id = (select id from _ids where clave = 'HA')), 1);

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.falla('La prueba no se puede pedir para otro hogar',
  $q$select public.pedir_prueba_push((select id from _ids where clave = 'HA'), 'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001')$q$, '42501');
select pg_temp.igual('Ni para un móvil que no es suyo',
  (select (not public.pedir_prueba_push((select id from _ids where clave = 'HB'), 'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001'))::int), 1);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('Sin sesión no se pide la prueba',
  $q$select public.pedir_prueba_push(gen_random_uuid(), 'https://x.test')$q$, '42501');
select pg_temp.fin();

rollback;
