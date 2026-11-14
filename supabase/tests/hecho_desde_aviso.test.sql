\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- «Hecho» desde la notificación (D-151).
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;
insert into _s select 'secreto', secreto from privado.avisos_ajustes;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
select public.guardar_estado_hogar((select v from _s where clave = 'hogar')::uuid, 0, $j${
  "mochila": [
    {"id":"m1","personaId":"emma","texto":"Flauta","dias":[3],"fecha":null,"antes":1,"preparadas":["2026-11-11"],"soloConCole":true},
    {"id":"m2","personaId":"leo","texto":"Flauta","dias":[3],"fecha":null,"antes":1,"preparadas":[],"soloConCole":true},
    {"id":"m3","personaId":"emma","texto":"Patines","dias":[5],"fecha":null,"antes":1,"soloConCole":true}
  ],
  "otra": "cosa"
}$j$::jsonb);
insert into _s select 'token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Sin el secreto no hay código',
  (public.crear_accion_aviso(repeat('0', 64), (select v from _s where clave = 'token'),
     '[{"texto":"Flauta","personaId":"emma","para":"2026-11-18"}]') is null)::int, 1);
select pg_temp.igual('Con un token que no existe, tampoco',
  (public.crear_accion_aviso((select v from _s where clave = 'secreto'), repeat('f', 64),
     '[{"texto":"Flauta","personaId":"emma","para":"2026-11-18"}]') is null)::int, 1);
select pg_temp.igual('Con cosas mal escritas, tampoco',
  (public.crear_accion_aviso((select v from _s where clave = 'secreto'), (select v from _s where clave = 'token'),
     '[{"texto":"Flauta","para":"mañana"}]') is null)::int, 1);
insert into _s select 'codigo', public.crear_accion_aviso((select v from _s where clave = 'secreto'),
  (select v from _s where clave = 'token'),
  '[{"texto":"Flauta","personaId":"emma","para":"2026-11-18"},{"texto":"Patines","personaId":"emma","para":"2026-11-20"}]');
select pg_temp.igual('Con el secreto, un código aleatorio de 64 hexadecimales',
  ((select v from _s where clave = 'codigo') ~ '^[0-9a-f]{64}$')::int, 1);

select pg_temp.igual('Un código inventado no marca nada',
  (public.marcar_hecho_desde_aviso(repeat('a', 64)) is null)::int, 1);
select pg_temp.igual('El bueno marca las dos cosas',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigo')), 2);
select pg_temp.igual('Otra vez, ninguna (no se duplica)',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigo')), 0);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('La flauta de Emma, preparada para ese día (y la de antes sigue)',
  (select ((estado->'mochila'->0->'preparadas') = '["2026-11-11","2026-11-18"]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogar')::uuid), 1);
select pg_temp.igual('La de Leo, no (es de otra persona)',
  (select ((estado->'mochila'->1->'preparadas') = '[]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogar')::uuid), 1);
select pg_temp.igual('Los patines, aunque no tenían lista',
  (select ((estado->'mochila'->2->'preparadas') = '["2026-11-20"]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogar')::uuid), 1);
select pg_temp.igual('El resto del documento no cambia y la versión sube una vez',
  (select ((estado->>'otra') = 'cosa' and version = 2)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogar')::uuid), 1);
select pg_temp.fin();

-- Caducado: ya no vale.
update privado.aviso_accion set caduca = now() - interval '1 minute';
select pg_temp.como(null);
select pg_temp.igual('Un código caducado no vale',
  (public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigo')) is null)::int, 1);
select pg_temp.falla('anon no lee los códigos',
  $q$select * from privado.aviso_accion$q$, '42501');
select pg_temp.fin();

rollback;
\echo 'hecho_desde_aviso: OK'
