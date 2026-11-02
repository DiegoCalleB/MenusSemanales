\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'ana@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _codigo (c text);
grant all on _codigo to authenticated;
create temp table _leido (clave text primary key, j jsonb);
grant all on _leido to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _codigo select public.crear_invitacion((select id from _ids where clave = 'HA'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select public.unirse_a_hogar((select c from _codigo));
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

-- ---------------------------------------------------------------------------------------------
-- Diego da de alta a la familia y todo lo demás, de una vez.
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), $j$
{
  "horizonte": "quincena",
  "personas": {"upsert": [
    {"id": "d0000000-0000-0000-0000-000000000001", "nombre": "Diego", "tipo": "adulto", "factorRacion": 1, "activa": true},
    {"id": "d0000000-0000-0000-0000-000000000002", "nombre": "Ana",   "tipo": "adulto", "factorRacion": 1, "activa": true, "userId": "bbbbbbbb-0000-0000-0000-00000000000b"},
    {"id": "d0000000-0000-0000-0000-000000000003", "nombre": "Alba",  "tipo": "nino",   "factorRacion": 0.5, "activa": true}
  ]},
  "dias": {"upsert": [
    {"fecha": "2026-11-03", "llegaTarde": true,  "saltado": false},
    {"fecha": "2026-11-05", "llegaTarde": false, "saltado": true}
  ]},
  "cumples": {"upsert": [
    {"id": "c0000000-0000-0000-0000-000000000001", "nombre": "Ana", "dia": 7, "mes": 11, "anio": 1984, "relacion": "familia",
     "personaId": "d0000000-0000-0000-0000-000000000002",
     "regalo": {"estado": "comprado", "anioEstado": 2026, "gustos": ["flores", "libros"]},
     "ideas": [{"id": "e0000000-0000-0000-0000-000000000001", "texto": "Perfume secreto", "origen": "persona"},
               {"id": "e0000000-0000-0000-0000-000000000002", "texto": "Escapada", "origen": "ia"}]},
    {"id": "c0000000-0000-0000-0000-000000000002", "nombre": "Alba", "dia": 4, "mes": 2, "anio": 2017,
     "personaId": "d0000000-0000-0000-0000-000000000003",
     "regalo": {"estado": "idea", "gustos": []},
     "ideas": [{"id": "e0000000-0000-0000-0000-000000000003", "texto": "Disfraz"}]}
  ]},
  "agenda": {"upsert": [
    {"id": "a0000000-0000-0000-0000-000000000001", "fecha": "2026-11-12", "hora": "18:15", "titulo": "Psicotécnico"},
    {"id": "a0000000-0000-0000-0000-000000000002", "fecha": "2026-11-17", "hasta": "2026-11-19", "titulo": "Puente"}
  ]},
  "fechas": {"upsert": [{"fecha": "2026-11-20", "titulo": "Fiesta", "emoji": "🎉"}]},
  "casa": {"upsert": [
    {"id": "b0000000-0000-0000-0000-000000000001", "titulo": "Limpiar los areneros", "emoji": "🐱", "cadaDias": 1,
     "desde": "2026-11-02", "ultimaVez": "2026-11-02", "responsableId": null},
    {"id": "b0000000-0000-0000-0000-000000000002", "titulo": "Comprar arena", "emoji": "🛒", "cadaDias": 30,
     "desde": "2026-11-09", "compra": "Arena para gatos", "responsableId": "d0000000-0000-0000-0000-000000000001"}
  ]},
  "tareas": {"upsert": [
    {"id": "f0000000-0000-0000-0000-000000000001", "personaId": "d0000000-0000-0000-0000-000000000003", "texto": "Deberes",
     "frecuencia": "diaria", "hechas": ["2026-11-01", "2026-11-02"]}
  ]}
}
$j$::jsonb);
-- (La vinculación persona↔cuenta se hará con su propia función; aquí la simula el administrador.)
select pg_temp.fin();
update public.persona set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where id = 'd0000000-0000-0000-0000-000000000002';

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _leido select 'diego', public.leer_hogar_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Se leen las 3 personas',
  (select jsonb_array_length(j->'personas') from _leido where clave = 'diego'), 3);
select pg_temp.igual('Los campos vienen en camelCase y con el tipo correcto',
  (select ((j->'personas'->0->>'nombre') = 'Alba' and (j->'personas'->0->>'tipo') = 'nino'
           and (j->'personas'->0->>'factorRacion')::numeric = 0.5 and (j->'personas'->0->>'activa')::boolean)::int
     from _leido where clave = 'diego'), 1);
select pg_temp.igual('«vinculada» dice si la persona tiene cuenta (y no se enseña la cuenta)',
  (select ((j->'personas'->1->>'vinculada')::boolean and (j->'personas'->0->>'vinculada')::boolean = false
           and j::text !~ 'bbbbbbbb-0000')::int from _leido where clave = 'diego'), 1);
select pg_temp.igual('El horizonte y los días',
  (select ((j->>'horizonte') = 'quincena' and (j->'llegoTarde') = '["2026-11-03"]'::jsonb
           and (j->'saltados') = '["2026-11-05"]'::jsonb)::int from _leido where clave = 'diego'), 1);
select pg_temp.igual('Diego ve el regalo y las ideas de Ana (no es quien cumple)',
  (select ((j->'cumples'->1->>'nombre') = 'Ana' and (j->'cumples'->1->'regalo'->>'estado') = 'comprado'
           and (j->'cumples'->1->'regalo'->'gustos') = '["flores","libros"]'::jsonb
           and jsonb_array_length(j->'cumples'->1->'ideas') = 2
           and (j->'cumples'->1->'ideas'->1->>'origen') = 'ia')::int from _leido where clave = 'diego'), 1);
select pg_temp.igual('Los cumpleaños salen por mes y día (febrero antes que noviembre)',
  (select ((j->'cumples'->0->>'nombre') = 'Alba' and (j->'cumples'->0->>'anio') = '2017')::int from _leido where clave = 'diego'), 1);
select pg_temp.igual('La agenda: hora «HH:MM», rango y sin hora',
  (select ((j->'agenda'->0->>'hora') = '18:15' and (j->'agenda'->1->>'hasta') = '2026-11-19' and (j->'agenda'->1->'hora') = 'null'::jsonb)::int
     from _leido where clave = 'diego'), 1);
select pg_temp.igual('Fechas señaladas, tareas de la casa y por persona',
  (select ((j->'fechas'->0->>'emoji') = '🎉'
           and (j->'casa'->0->>'compra') = 'Arena para gatos' and (j->'casa'->1->'responsableId') = 'null'::jsonb
           and (j->'tareas'->0->'hechas') = '["2026-11-01","2026-11-02"]'::jsonb)::int from _leido where clave = 'diego'), 1);
select pg_temp.fin();

-- El vínculo de la cuenta no se puede cambiar por la puerta de los cambios.
select pg_temp.igual('«userId» en el JSON se ignora: Ana sigue vinculada a su cuenta y nadie más',
  (select count(*) from public.persona where user_id is not null and nombre = 'Ana' and user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'), 1);

-- ---------------------------------------------------------------------------------------------
-- El secreto del regalo: Ana lee y escribe todo lo suyo menos su regalo.
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _leido select 'ana', public.leer_hogar_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Ana ve los dos cumpleaños',
  (select jsonb_array_length(j->'cumples') from _leido where clave = 'ana'), 2);
select pg_temp.igual('Pero a ella le llega «regalo: null» e ideas vacías en el suyo',
  (select ((j->'cumples'->1->>'nombre') = 'Ana' and (j->'cumples'->1->'regalo') = 'null'::jsonb
           and (j->'cumples'->1->'ideas') = '[]'::jsonb and j::text !~ 'Perfume secreto' and j::text !~ 'flores')::int
     from _leido where clave = 'ana'), 1);
select pg_temp.igual('Y el del cumple de Alba sí lo ve entero',
  (select ((j->'cumples'->0->'regalo'->>'estado') = 'idea' and jsonb_array_length(j->'cumples'->0->'ideas') = 1)::int
     from _leido where clave = 'ana'), 1);
select pg_temp.falla('Ana no puede cambiar el estado de su propio regalo',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"cumples":{"upsert":[{"id":"c0000000-0000-0000-0000-000000000001","nombre":"Ana","dia":7,"mes":11,"regalo":{"estado":"entregado"}}]}}'::jsonb)$q$, '42501');
select pg_temp.falla('Ni añadirse ideas',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"cumples":{"upsert":[{"id":"c0000000-0000-0000-0000-000000000001","nombre":"Ana","dia":7,"mes":11,"ideas":[{"id":"e0000000-0000-0000-0000-0000000000ff","texto":"Colar"}]}]}}'::jsonb)$q$, '42501');
-- El hueco que había: desvincularse para dejar de ser «quien cumple».
select pg_temp.falla('Ana no puede desvincular su cumpleaños de su persona (ni por la función ni directamente)',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"cumples":{"upsert":[{"id":"c0000000-0000-0000-0000-000000000001","nombre":"Ana","dia":7,"mes":11,"personaId":null,
        "regalo":{"estado":"entregado"}}]}}'::jsonb)$q$, '42501');
select pg_temp.falla('Directamente tampoco',
  $q$update public.cumple set persona_id = null where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni asignárselo a otra persona',
  $q$update public.cumple set persona_id = 'd0000000-0000-0000-0000-000000000001' where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni borrar su cumpleaños (se llevaría el regalo)', $q$delete from public.cumple where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni borrarse a sí misma como persona (soltaría el vínculo en cascada)',
  $q$delete from public.persona where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni quitarse la cuenta de su persona',
  $q$update public.persona set user_id = null where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni vincular su persona a otra cuenta',
  $q$update public.persona set user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni crear una persona ya vinculada a una cuenta',
  $q$insert into public.persona (hogar_id, nombre, tipo, user_id) select hogar_id, 'Falsa', 'adulto', 'bbbbbbbb-0000-0000-0000-00000000000b' from public.persona limit 1$q$, '42501');
-- Y lo que sí puede: renombrarse o cambiar su ración.
update public.persona set nombre = 'Ana M.' where id = 'd0000000-0000-0000-0000-000000000002';
select pg_temp.igual('Ana sí puede cambiar su nombre', (select count(*) from public.persona where nombre = 'Ana M.'), 1);
update public.persona set nombre = 'Ana' where id = 'd0000000-0000-0000-0000-000000000002';
-- Lo que no toca el regalo, sí puede: marcar una tarea de casa como hecha, o corregir su nombre.
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), $j$
{"casa": {"upsert": [{"id": "b0000000-0000-0000-0000-000000000001", "titulo": "Limpiar los areneros", "emoji": "🐱",
                      "cadaDias": 1, "desde": "2026-11-02", "ultimaVez": "2026-11-03"}]},
 "cumples": {"upsert": [{"id": "c0000000-0000-0000-0000-000000000001", "nombre": "Ana", "dia": 7, "mes": 11, "anio": 1984,
                         "personaId": "d0000000-0000-0000-0000-000000000002"}]}}
$j$::jsonb);
select pg_temp.igual('Ana marca hecha una tarea y su regalo queda intacto (no lo ve, no lo toca)',
  (select (ultima_vez = '2026-11-03')::int from public.tarea_casa where titulo = 'Limpiar los areneros'), 1);
select pg_temp.fin();
select pg_temp.igual('El regalo de Ana sigue igual (visto como administrador de la prueba)',
  (select count(*) from public.cumple_regalo r join public.cumple c on c.id = r.cumple_id
    where c.nombre = 'Ana' and r.estado = 'comprado' and r.gustos = array['flores','libros']), 1);
select pg_temp.igual('…y sus ideas también',
  (select count(*) from public.cumple_idea i join public.cumple c on c.id = i.cumple_id where c.nombre = 'Ana'), 2);

-- ---------------------------------------------------------------------------------------------
-- Reemplazos, bajas y «ausente = no tocar».
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), $j$
{
  "tareas": {"upsert": [{"id": "f0000000-0000-0000-0000-000000000001", "personaId": "d0000000-0000-0000-0000-000000000003",
                         "texto": "Deberes", "frecuencia": "diaria", "hechas": ["2026-11-02", "2026-11-04"]}]},
  "cumples": {"upsert": [{"id": "c0000000-0000-0000-0000-000000000001", "nombre": "Ana", "dia": 7, "mes": 11, "anio": 1984,
                          "personaId": "d0000000-0000-0000-0000-000000000002",
                          "ideas": [{"id": "e0000000-0000-0000-0000-000000000002", "texto": "Escapada de fin de semana", "origen": "persona"}]}]},
  "agenda": {"borrar": ["a0000000-0000-0000-0000-000000000002"]},
  "fechas": {"upsert": [{"fecha": "2026-11-20", "titulo": "Fiesta del cole", "emoji": "🎈"}]},
  "dias": {"upsert": [{"fecha": "2026-11-03", "llegaTarde": false, "saltado": false}], "borrar": ["2026-11-05"]}
}
$j$::jsonb);
select pg_temp.igual('Los días hechos son exactamente los que se mandan (se quita el 1 y se añade el 4)',
  (select count(*) from public.tarea_persona_hecha where fecha in ('2026-11-02', '2026-11-04'))
  + 10 * (select count(*) from public.tarea_persona_hecha where fecha = '2026-11-01'), 2);
select pg_temp.igual('Las ideas son exactamente las que se mandan (una se quita, otra se cambia)',
  (select count(*) from public.cumple_idea i join public.cumple c on c.id = i.cumple_id
    where c.nombre = 'Ana' and i.texto = 'Escapada de fin de semana' and i.origen = 'persona'), 1);
select pg_temp.igual('Sin «regalo» en el JSON, el regalo no se toca (ni los gustos)',
  (select count(*) from public.cumple_regalo r join public.cumple c on c.id = r.cumple_id where c.nombre = 'Ana' and r.estado = 'comprado'), 1);
select pg_temp.igual('Se borra un apunte y el otro queda', (select count(*) from public.apunte), 1);
select pg_temp.igual('Una fecha señalada con el mismo día se actualiza, no se duplica',
  (select count(*) from public.fecha_senalada where titulo = 'Fiesta del cole'), 1);
select pg_temp.igual('Un día sin «llego tarde» ni «saltado» ya no ocupa fila',
  (select count(*) from public.dia_hogar), 0 + 1 - 1 + 0);
select pg_temp.fin();

-- ---------------------------------------------------------------------------------------------
-- Atomicidad y validaciones.
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Si una parte falla no se aplica ninguna (apunte que acaba antes de empezar)',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"casa":{"upsert":[{"id":"b0000000-0000-0000-0000-0000000000aa","titulo":"No debe quedar","cadaDias":7,"desde":"2026-11-02"}]},
       "agenda":{"upsert":[{"id":"a0000000-0000-0000-0000-0000000000aa","fecha":"2026-11-20","hasta":"2026-11-20","titulo":"Mal"}]}}'::jsonb)$q$, '23514');
select pg_temp.igual('…y la tarea de la primera parte tampoco quedó',
  (select count(*) from public.tarea_casa where titulo = 'No debe quedar'), 0);
select pg_temp.falla('El horizonte solo es semana o quincena',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), '{"horizonte":"mes"}'::jsonb)$q$, '23514');
select pg_temp.falla('El 31 de abril no existe',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"cumples":{"upsert":[{"id":"c0000000-0000-0000-0000-0000000000bb","nombre":"X","dia":31,"mes":4}]}}'::jsonb)$q$, '23514');
select pg_temp.falla('Los cambios deben ser un objeto', $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), '[1]'::jsonb)$q$, '22023');
select pg_temp.falla('Ni nulos', $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), null)$q$, '22023');
select pg_temp.falla('Ni enormes',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), jsonb_build_object('relleno', repeat('a', 2100000)))$q$, '54000');
select pg_temp.falla('Una tarea no puede ser de una persona de otro hogar',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
     '{"tareas":{"upsert":[{"id":"f0000000-0000-0000-0000-0000000000cc","personaId":"d9999999-0000-0000-0000-000000000009","texto":"Ajena"}]}}'::jsonb)$q$, '23503');
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), '{"clave_desconocida": {"upsert": [1]}}'::jsonb);
select pg_temp.igual('Las claves desconocidas se ignoran sin romper', 1, 1);
-- Borrar a una persona suelta sus tareas y su cumpleaños (no los borra).
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'),
  '{"personas":{"borrar":["d0000000-0000-0000-0000-000000000003"]}}'::jsonb);
select pg_temp.igual('Al borrar a Alba se van sus tareas y su cumpleaños queda sin persona',
  (select count(*) from public.tarea_persona) * 100
  + (select count(*) from public.cumple where nombre = 'Alba' and persona_id is null), 1);
select pg_temp.fin();

-- ---------------------------------------------------------------------------------------------
-- Aislamiento entre hogares y sin sesión.
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.falla('Otro hogar no lee este',
  $q$select public.leer_hogar_tablas((select id from _ids where clave = 'HA'))$q$, '42501');
select pg_temp.falla('Ni lo escribe',
  $q$select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), '{"horizonte":"semana"}'::jsonb)$q$, '42501');
-- Reutilizar el identificador de una fila ajena no la cambia ni la mueve (el upsert solo toca las del hogar).
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HC'),
  '{"casa":{"upsert":[{"id":"b0000000-0000-0000-0000-000000000002","titulo":"Secuestrada","cadaDias":1,"desde":"2026-11-02"}]}}'::jsonb);
select pg_temp.igual('Su hogar está vacío', (select jsonb_array_length(public.leer_hogar_tablas((select id from _ids where clave = 'HC'))->'personas')), 0);
select pg_temp.fin();
select pg_temp.igual('La tarea de la otra familia no cambió y nada se coló en el hogar C',
  (select count(*) from public.tarea_casa where titulo = 'Comprar arena' and hogar_id = (select id from _ids where clave = 'HA'))
  + 10 * (select count(*) from public.tarea_casa where titulo = 'Secuestrada'), 1);

select pg_temp.como(null);
select pg_temp.falla('Sin sesión no se lee', $q$select public.leer_hogar_tablas(gen_random_uuid())$q$, '42501');
select pg_temp.falla('Sin sesión no se escribe', $q$select public.aplicar_cambios_tablas(gen_random_uuid(), '{}'::jsonb)$q$, '42501');
select pg_temp.fin();

select pg_temp.igual('anon no puede ejecutar ninguna de las dos',
  (has_function_privilege('anon', 'public.leer_hogar_tablas(uuid)', 'EXECUTE')
   or has_function_privilege('anon', 'public.aplicar_cambios_tablas(uuid, jsonb)', 'EXECUTE'))::int, 0);

rollback;
\echo 'hogar_tablas: OK'
