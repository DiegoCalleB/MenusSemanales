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

-- «Tomada» desde la notificación de la medicación (D-185).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogarB', public.crear_hogar('Hogar B')::text);
select public.guardar_estado_hogar((select v from _s where clave = 'hogarB')::uuid, 0, $j${
  "medicacion": [
    {"id":"x1","personaId":"diego","nombre":"Vitamina D","hora":8,"dias":[1,2,3,4,5,6,7],"tomadas":["2026-11-18"]},
    {"id":"x2","personaId":"ana","nombre":"Vitamina D","hora":8,"dias":[1,2,3,4,5,6,7],"tomadas":[]}
  ],
  "mochila": [{"id":"m1","personaId":"diego","texto":"Vitamina D","dias":[4],"fecha":null,"antes":1,"preparadas":[],"soloConCole":true}]
}$j$::jsonb);
insert into _s select 'tokenB', public.enlace_calendario((select v from _s where clave = 'hogarB')::uuid);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Un tipo que no existe no vale',
  (public.crear_accion_aviso((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenB'),
     '[{"texto":"Vitamina D","personaId":"diego","para":"2026-11-19","tipo":"otro"}]') is null)::int, 1);
insert into _s select 'codigoB', public.crear_accion_aviso((select v from _s where clave = 'secreto'),
  (select v from _s where clave = 'tokenB'),
  '[{"texto":"Vitamina D","personaId":"diego","para":"2026-11-19","tipo":"medicacion"}]');
select pg_temp.igual('El botón marca la dosis de hoy, una sola',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigoB')), 1);
select pg_temp.igual('Otra vez, ninguna',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigoB')), 0);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('La de Diego suma hoy (y la de ayer sigue)',
  (select ((estado->'medicacion'->0->'tomadas') = '["2026-11-18","2026-11-19"]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarB')::uuid), 1);
select pg_temp.igual('La de Ana, no (es de otra persona)',
  (select ((estado->'medicacion'->1->'tomadas') = '[]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarB')::uuid), 1);
select pg_temp.igual('Lo de la mochila con el mismo nombre no se toca',
  (select ((estado->'mochila'->0->'preparadas') = '[]'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarB')::uuid), 1);
select pg_temp.fin();

-- «+1 vaso» y «Hecho» del ejercicio desde la notificación de Cuidarse (D-202).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogarC', public.crear_hogar('Hogar C')::text);
select public.guardar_estado_hogar((select v from _s where clave = 'hogarC')::uuid, 0, $j${
  "cuidado": [
    {"personaId":"diego","metaAgua":8,"avisos":true,"avisosCfg":{"agua":{"on":true,"horas":[10,15]}},"habitos":[{"id":"h1","nombre":"Leer"}],
     "ejercicio":{"nombre":"Correr","dias":[1,3,5]},
     "dias":{"2026-11-18":{"agua":3,"ejercicio":false,"habitos":["h1"]}}},
    {"personaId":"ana","metaAgua":6,"avisos":true,"habitos":[],"ejercicio":null,"dias":{}}
  ]
}$j$::jsonb);
insert into _s select 'tokenC', public.enlace_calendario((select v from _s where clave = 'hogarC')::uuid);
select pg_temp.fin();

select pg_temp.como(null);
insert into _s select 'codigoAgua', public.crear_accion_aviso((select v from _s where clave = 'secreto'),
  (select v from _s where clave = 'tokenC'),
  '[{"texto":"agua","personaId":"diego","para":"2026-11-19","tipo":"agua"}]');
select pg_temp.igual('El agua del código es un código válido',
  ((select v from _s where clave = 'codigoAgua') ~ '^[0-9a-f]{64}$')::int, 1);
select pg_temp.igual('El botón suma un vaso',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigoAgua')), 1);
select pg_temp.igual('Otro toque en el mismo aviso no suma otro (un solo uso)',
  (public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigoAgua')) is null)::int, 1);
insert into _s select 'codigoEj', public.crear_accion_aviso((select v from _s where clave = 'secreto'),
  (select v from _s where clave = 'tokenC'),
  '[{"texto":"ejercicio","personaId":"diego","para":"2026-11-19","tipo":"ejercicio"},{"texto":"agua","personaId":"ana","para":"2026-11-19","tipo":"agua"}]');
select pg_temp.igual('El ejercicio de Diego y un vaso de Ana',
  public.marcar_hecho_desde_aviso((select v from _s where clave = 'codigoEj')), 2);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Diego: un vaso hoy, día completo, y lo de ayer intacto',
  (select ((estado->'cuidado'->0->'dias'->'2026-11-19') = '{"agua":1,"ejercicio":true,"habitos":[]}'::jsonb
       and (estado->'cuidado'->0->'dias'->'2026-11-18') = '{"agua":3,"ejercicio":false,"habitos":["h1"]}'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarC')::uuid), 1);
select pg_temp.igual('Ana: un vaso, sin ejercicio, y sin tocar lo de Diego',
  (select ((estado->'cuidado'->1->'dias'->'2026-11-19') = '{"agua":1,"ejercicio":false,"habitos":[]}'::jsonb)::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarC')::uuid), 1);
select pg_temp.igual('Los hábitos y los ajustes no cambian',
  (select ((estado->'cuidado'->0->'habitos') = '[{"id":"h1","nombre":"Leer"}]'::jsonb
       and (estado->'cuidado'->0->>'metaAgua') = '8')::int
     from public.hogar_estado where hogar_id = (select v from _s where clave = 'hogarC')::uuid), 1);
select pg_temp.fin();

-- Objetivos y notas en el resumen del servidor: solo cuántos (D-203).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogarD', public.crear_hogar('Hogar D')::text);
select public.guardar_estado_hogar((select v from _s where clave = 'hogarD')::uuid, 0, jsonb_build_object(
  'objetivos', jsonb_build_array(
    jsonb_build_object('id','o1','personaId','diego','texto','SECRETO uno','hasta','2026-12-31','hechoEn',null,
      'creadoEn',to_char(current_date - 20,'YYYY-MM-DD'),'siguiente',null,'movidoEn',to_char(current_date - 9,'YYYY-MM-DD'),'cada',7),
    jsonb_build_object('id','o2','personaId','diego','texto','SECRETO dos','hasta','2026-12-31','hechoEn',null,
      'creadoEn',to_char(current_date - 30,'YYYY-MM-DD'),'siguiente',null,'movidoEn',null,'cada',null),
    jsonb_build_object('id','o3','personaId','diego','texto','SECRETO tres','hasta','2026-12-31','hechoEn',null,
      'creadoEn',to_char(current_date - 3,'YYYY-MM-DD'),'siguiente',null,'movidoEn',null,'cada',null),
    jsonb_build_object('id','o4','personaId','diego','texto','SECRETO hecho','hasta','2026-12-31','hechoEn','2026-11-01',
      'creadoEn',to_char(current_date - 90,'YYYY-MM-DD'),'siguiente',null,'movidoEn',null,'cada',null),
    jsonb_build_object('id','o5','personaId','ana','texto','SECRETO ana','hasta','2026-12-31','hechoEn',null,
      'creadoEn',to_char(current_date - 2,'YYYY-MM-DD'),'siguiente',null,'movidoEn',null,'cada',7)),
  'notas', jsonb_build_array(
    jsonb_build_object('id','n1','personaId','diego','tipo','idea','texto','SECRETO nota','sobre',null,'creadoEn','2026-11-01','procesadaEn',null),
    jsonb_build_object('id','n2','personaId','diego','tipo','idea','texto','SECRETO otra','sobre',null,'creadoEn','2026-11-01','procesadaEn','2026-11-02'),
    jsonb_build_object('id','n3','personaId','diego','tipo','recuerdo','texto','SECRETO recuerdo','sobre','ana','creadoEn','2026-11-01','procesadaEn',null))));
insert into _s select 'tokenD', public.enlace_calendario((select v from _s where clave = 'hogarD')::uuid);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Diego: 1 que se repite y ya toca, 1 parado (14+ días) y 1 idea sin resolver',
  (select (public.estado_para_calendario((select v from _s where clave = 'tokenD'))->'objetivos'->1
           = '{"personaId":"diego","tocan":1,"parados":1,"bandeja":1}'::jsonb)::int), 1);
select pg_temp.igual('Ana: nada toca todavía',
  (select (public.estado_para_calendario((select v from _s where clave = 'tokenD'))->'objetivos'->0
           = '{"personaId":"ana","tocan":0,"parados":0,"bandeja":0}'::jsonb)::int), 1);
select pg_temp.igual('Nunca sale el texto de un objetivo ni de una nota',
  (select (position('SECRETO' in public.estado_para_calendario((select v from _s where clave = 'tokenD'))::text) = 0)::int), 1);
select pg_temp.fin();

-- Avisos personales y «Posponer» (D-204).
select pg_temp.como(null);
select pg_temp.igual('El resumen lleva la configuración de avisos de quien los pidió',
  (select (public.estado_para_calendario((select v from _s where clave = 'tokenC'))->'cuidado'->0->'cfg'
           = '{"agua":{"on":true,"horas":[10,15]}}'::jsonb)::int), 1);
insert into _s select 'codigoP', public.crear_accion_aviso((select v from _s where clave = 'secreto'),
  (select v from _s where clave = 'tokenC'),
  '[{"texto":"-","personaId":"diego","para":"2026-11-19"}]');
select pg_temp.igual('Sin guardar el mensaje, no se puede posponer',
  (not public.posponer_aviso((select v from _s where clave = 'codigoP')))::int, 1);
select pg_temp.igual('Sin el secreto no se guarda el mensaje',
  (not public.recordar_aviso(repeat('0', 64), (select v from _s where clave = 'codigoP'), 'diego',
     '{"titulo":"x","cuerpo":"y","tag":"t"}'::jsonb))::int, 1);
select pg_temp.igual('Con el secreto, sí',
  public.recordar_aviso((select v from _s where clave = 'secreto'), (select v from _s where clave = 'codigoP'), 'diego',
     '{"titulo":"💧 Diego: agua","cuerpo":"Llevas 0 de 8","tag":"cuidado-diego-agua"}'::jsonb)::int, 1);
select pg_temp.igual('Un código inventado no se pospone',
  (not public.posponer_aviso(repeat('b', 64)))::int, 1);
select pg_temp.igual('El botón pospone',
  public.posponer_aviso((select v from _s where clave = 'codigoP'))::int, 1);
select pg_temp.igual('Pulsarlo otra vez mientras está pospuesto no cambia nada',
  (not public.posponer_aviso((select v from _s where clave = 'codigoP')))::int, 1);
select pg_temp.igual('Aún no toca: no sale',
  jsonb_array_length(public.avisos_pospuestos((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenC'))), 0);
select pg_temp.fin();

-- Pasa el tiempo.
update privado.aviso_accion set repetir_en = now() - interval '1 minute' where codigo = (select v from _s where clave = 'codigoP');
select pg_temp.como(null);
select pg_temp.igual('Sin el secreto no se recoge nada',
  jsonb_array_length(public.avisos_pospuestos(repeat('0', 64), (select v from _s where clave = 'tokenC'))), 0);
select pg_temp.igual('Con el secreto sale una vez, con su código y su mensaje',
  (select (jsonb_array_length(r) = 1
           and r->0->>'codigo' = (select v from _s where clave = 'codigoP')
           and r->0->>'persona' = 'diego'
           and r->0->'mensaje'->>'tag' = 'cuidado-diego-agua'
           and (r->0->>'pospuestas')::int = 1)::int
     from (select public.avisos_pospuestos((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenC')) as r) t), 1);
select pg_temp.igual('Y no vuelve a salir',
  jsonb_array_length(public.avisos_pospuestos((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenC'))), 0);
-- Hasta 3 veces.
select pg_temp.igual('Se puede posponer otra vez (2)', public.posponer_aviso((select v from _s where clave = 'codigoP'))::int, 1);
select pg_temp.fin();
update privado.aviso_accion set repetir_en = now() - interval '1 minute' where codigo = (select v from _s where clave = 'codigoP');
select pg_temp.como(null);
select public.avisos_pospuestos((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenC'));
select pg_temp.igual('Y otra (3)', public.posponer_aviso((select v from _s where clave = 'codigoP'))::int, 1);
select pg_temp.fin();
update privado.aviso_accion set repetir_en = now() - interval '1 minute' where codigo = (select v from _s where clave = 'codigoP');
select pg_temp.como(null);
select public.avisos_pospuestos((select v from _s where clave = 'secreto'), (select v from _s where clave = 'tokenC'));
select pg_temp.igual('A la cuarta, no', (not public.posponer_aviso((select v from _s where clave = 'codigoP')))::int, 1);
select pg_temp.fin();

-- Fechas que se repiten en el resumen del servidor (D-211).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogarR', public.crear_hogar('Hogar R')::text);
select public.guardar_estado_hogar((select v from _s where clave = 'hogarR')::uuid, 0, $j${
  "repetidas": [
    {"id":"r1","titulo":"Viene Yolanda","hora":null,"desde":"2026-11-25","cadaDias":14,"avisoAntes":"Dejar dinero","creadoEn":"2026-11-25","secreto":"NO SALE"}
  ]
}$j$::jsonb);
insert into _s select 'tokenR', public.enlace_calendario((select v from _s where clave = 'hogarR')::uuid);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('El resumen lleva las fechas que se repiten, con lo justo',
  (select (public.estado_para_calendario((select v from _s where clave = 'tokenR'))->'repetidas'
           = '[{"titulo":"Viene Yolanda","hora":null,"desde":"2026-11-25","cadaDias":14,"avisoAntes":"Dejar dinero"}]'::jsonb)::int), 1);
select pg_temp.igual('Y no sale nada más del documento',
  (select (position('NO SALE' in public.estado_para_calendario((select v from _s where clave = 'tokenR'))::text) = 0)::int), 1);
select pg_temp.fin();

rollback;
\echo 'hecho_desde_aviso: OK'
