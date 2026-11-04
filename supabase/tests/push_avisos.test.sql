\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _t (clave text primary key, token text);
grant all on _t to authenticated, anon;
create temp table _r (clave text primary key, j jsonb);
grant all on _r to authenticated, anon;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _t select 'A', public.enlace_calendario((select id from _ids where clave = 'HA'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- Diego guarda la suscripción de su móvil.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select public.guardar_suscripcion_push((select id from _ids where clave = 'HA'),
  'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001', repeat('p', 40), repeat('a', 20));
select pg_temp.igual('Se guarda la suscripción', (select count(*)::int from public.push_suscripcion), 1);
-- Renovarla no la duplica.
select public.guardar_suscripcion_push((select id from _ids where clave = 'HA'),
  'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001', repeat('q', 40), repeat('b', 20));
select pg_temp.igual('Renovarla no duplica y cambia las claves',
  (select count(*)::int from public.push_suscripcion where p256dh = repeat('q', 40)), 1);
select pg_temp.igual('Sigue habiendo una sola', (select count(*)::int from public.push_suscripcion), 1);
select pg_temp.falla('Una dirección que no es https no vale',
  format($$select public.guardar_suscripcion_push('%s', 'http://inseguro.example.test/push/abcdefghij', %L, %L)$$,
    (select id from _ids where clave = 'HA'), repeat('p', 40), repeat('a', 20)), '23514');
select pg_temp.falla('No se puede suscribir a un hogar ajeno',
  format($$select public.guardar_suscripcion_push('%s', 'https://fcm.googleapis.com/fcm/send/otro-0002', %L, %L)$$,
    (select id from _ids where clave = 'HB'), repeat('p', 40), repeat('a', 20)), '42501');
select pg_temp.fin();

-- Otro usuario no ve la suscripción de Diego ni puede quitarla.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Otro usuario no la ve', (select count(*)::int from public.push_suscripcion), 0);
select public.quitar_suscripcion_push('https://fcm.googleapis.com/fcm/send/movil-de-diego-0001');
select pg_temp.fin();
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Otro usuario no puede quitar la de Diego', (select count(*)::int from public.push_suscripcion), 1);
select pg_temp.fin();

-- El servidor del aviso diario, sin sesión, con el token del calendario.
select pg_temp.como(null);
insert into _r select 'con', public.suscripciones_para_avisos((select token from _t where clave = 'A'));
insert into _r select 'mal', public.suscripciones_para_avisos(repeat('0', 64));
select pg_temp.fin();
select pg_temp.igual('Con el token del calendario devuelve la suscripción',
  (select ((j->0->>'endpoint') = 'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001' and jsonb_array_length(j) = 1)::int from _r where clave = 'con'), 1);
select pg_temp.igual('Con un token inventado, nada',
  (select jsonb_array_length(j) from _r where clave = 'mal'), 0);

-- Olvidar una suscripción caducada.
select pg_temp.como(null);
select public.olvidar_suscripcion_push(repeat('0', 64), 'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001');
select pg_temp.fin();
select pg_temp.igual('Con un token inventado no borra nada', (select count(*)::int from public.push_suscripcion), 1);
select pg_temp.como(null);
select public.olvidar_suscripcion_push((select token from _t where clave = 'A'), 'https://fcm.googleapis.com/fcm/send/movil-de-diego-0001');
select pg_temp.fin();
select pg_temp.igual('Con el token bueno la olvida', (select count(*)::int from public.push_suscripcion), 0);

rollback;
