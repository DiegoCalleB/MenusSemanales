\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _t (clave text primary key, token text);
grant all on _t to authenticated, anon;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select public.guardar_estado_hogar((select id from _ids where clave = 'HA'), 0, $j${
  "personas": [{"id":"ana","nombre":"Ana","tipo":"adulto","activa":true,"factorRacion":1,"secreto":"x"}],
  "comidas":  [{"fecha":"2026-11-09","etiqueta":"Cena del lunes","plato":{"nombre":"Sopa","ingredientes":[1,2,3]},"raciones":3}],
  "almuerzos":[{"id":"m1","fecha":"2026-11-08","texto":"Paella","platoId":null}],
  "eventos":  {"2026-11-20":{"titulo":"Fiesta","emoji":"🎉"}},
  "agenda":   [{"id":"a1","fecha":"2026-11-12","hasta":null,"hora":"18:15","titulo":"Psicotécnico"}],
  "casa":     [{"id":"c1","titulo":"Sábanas","emoji":"🛏️","cadaDias":14,"responsableId":null,"ultimaVez":null,"desde":"2026-11-02","aplazadaHasta":null}],
  "cumples":  [{"id":"c-ana","nombre":"Ana","dia":7,"mes":11,"anio":1984,"personaId":"ana","relacion":"familia",
                "ideas":["perfume secreto"],"gustos":["flores"],"estado":"comprado","anioEstado":2026}],
  "compras":  [{"x":"no debe salir"}],
  "despensa": [{"y":"no debe salir"}]
}$j$::jsonb);
insert into _t select 'A1', public.enlace_calendario((select id from _ids where clave = 'HA'));
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- El enlace.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('El token tiene 64 caracteres hexadecimales',
  (select (token ~ '^[0-9a-f]{64}$')::int from _t where clave = 'A1'), 1);
select pg_temp.igual('Pedirlo otra vez devuelve el mismo, no uno nuevo',
  (public.enlace_calendario((select id from _ids where clave = 'HA')) = (select token from _t where clave = 'A1'))::int, 1);
insert into _t select 'A2', public.enlace_calendario((select id from _ids where clave = 'HA'), true);
select pg_temp.igual('Renovarlo da uno distinto',
  ((select token from _t where clave = 'A2') <> (select token from _t where clave = 'A1'))::int, 1);
select pg_temp.falla('Nadie toca la tabla del token directamente',
  $q$select * from public.hogar_calendario$q$, '42501');
select pg_temp.falla('Ni escribe en ella', $q$update public.hogar_calendario set token = repeat('a', 64)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('B no puede pedir el enlace del hogar de A',
  $q$select public.enlace_calendario((select id from _ids where clave = 'HA'))$q$, '42501');
select pg_temp.falla('Ni renovarlo',
  $q$select public.enlace_calendario((select id from _ids where clave = 'HA'), true)$q$, '42501');
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('Sin sesión (anon) ni se puede ejecutar la función del enlace',
  $q$select public.enlace_calendario(gen_random_uuid())$q$, '42501');

-- La lectura por token (la hace el servidor con la clave pública).
select pg_temp.igual('El token viejo ya no vale',
  (public.estado_para_calendario((select token from _t where clave = 'A1')) is null)::int, 1);
select pg_temp.igual('El token nuevo da el resumen',
  (public.estado_para_calendario((select token from _t where clave = 'A2')) is not null)::int, 1);
select pg_temp.igual('Un token inventado, nada',
  (public.estado_para_calendario(repeat('a', 64)) is null)::int, 1);
select pg_temp.igual('Un token mal formado, nada',
  (public.estado_para_calendario('hola') is null and public.estado_para_calendario(null) is null
    and public.estado_para_calendario('') is null)::int, 1);
select pg_temp.igual('Intentos de inyección, nada',
  (public.estado_para_calendario($t$' or '1'='1$t$) is null)::int, 1);
create temp table _r (j jsonb);
grant all on _r to anon, authenticated;
insert into _r select public.estado_para_calendario((select token from _t where clave = 'A2'));
select pg_temp.igual('Trae las cenas con el nombre del plato',
  (select (j->'cenas'->0->>'nombre' = 'Sopa')::int from _r), 1);
select pg_temp.igual('Trae las comidas, la agenda, la casa y los eventos',
  (select ((j->'almuerzos'->0->>'texto') = 'Paella' and (j->'agenda'->0->>'hora') = '18:15'
     and (j->'casa'->0->>'titulo') = 'Sábanas' and (j->'eventos'->'2026-11-20'->>'titulo') = 'Fiesta')::int from _r), 1);
select pg_temp.igual('Trae los cumpleaños con quién y cuándo',
  (select ((j->'cumples'->0->>'nombre') = 'Ana' and (j->'cumples'->0->>'personaId') = 'ana'
     and (j->'cumples'->0->>'mes') = '11')::int from _r), 1);
select pg_temp.igual('NO trae las ideas, los gustos ni el estado del regalo',
  (select (j::text !~ 'perfume secreto' and j::text !~ 'flores' and j::text !~ 'comprado'
     and j::text !~ 'anioEstado')::int from _r), 1);
select pg_temp.igual('NO trae la compra, la despensa ni los ingredientes de los platos',
  (select (j::text !~ 'no debe salir' and j::text !~ 'ingredientes')::int from _r), 1);
select pg_temp.igual('De las personas, solo id, nombre, tipo y si está activa',
  (select (j->'personas'->0 = '{"id":"ana","nombre":"Ana","tipo":"adulto","activa":true}'::jsonb)::int from _r), 1);
select pg_temp.fin();

-- Un hogar sin estado guardado no rompe: devuelve null.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _t select 'B1', public.enlace_calendario((select id from _ids where clave = 'HB'));
select pg_temp.igual('Un hogar sin plan guardado no da nada, y no falla',
  (public.estado_para_calendario((select token from _t where clave = 'B1')) is null)::int, 1);
select pg_temp.fin();

rollback;
\echo 'calendario_suscrito: OK'
