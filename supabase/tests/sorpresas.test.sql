\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Citas sorpresa (D-217): el resumen del servidor las marca como secretas.
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s values ('token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid, false));
select public.guardar_estado_hogar((select v from _s where clave = 'hogar')::uuid, 0, $j${
  "agenda": [
    {"id": "a1", "fecha": "2026-11-27", "hasta": null, "hora": "20:00", "titulo": "Teatro Yllana", "secreta": true},
    {"id": "a2", "fecha": "2026-11-28", "hasta": null, "hora": null, "titulo": "Pediatra"}
  ]
}$j$::jsonb);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('La cita sorpresa llega marcada como secreta',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->0->>'secreta') = 'true')::int, 1);
select pg_temp.igual('La normal, no',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->1->>'secreta') = 'false')::int, 1);
select pg_temp.igual('Y el título sigue (la app decide qué decir)',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->0->>'titulo') = 'Teatro Yllana')::int, 1);
select pg_temp.fin();

-- El mismo hogar, ya con sus datos en tablas: la marca se sigue viendo (se lee del documento).
insert into public.persona (hogar_id, nombre, tipo)
  values ((select v from _s where clave = 'hogar')::uuid, 'Diego', 'adulto');
insert into public.apunte (hogar_id, fecha, hora, titulo) values
  ((select v from _s where clave = 'hogar')::uuid, '2026-11-27', '20:00', 'Teatro Yllana'),
  ((select v from _s where clave = 'hogar')::uuid, '2026-11-28', null, 'Pediatra');
select pg_temp.como(null);
select pg_temp.igual('Con datos en tablas, la sorpresa llega marcada',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->0->>'secreta') = 'true')::int, 1);
select pg_temp.igual('Con datos en tablas, la normal no',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->1->>'secreta') = 'false')::int, 1);
select pg_temp.igual('Con datos en tablas, y el título sigue',
  ((public.estado_para_calendario((select v from _s where clave = 'token'))->'agenda'->0->>'titulo') = 'Teatro Yllana')::int, 1);
select pg_temp.fin();

rollback;
