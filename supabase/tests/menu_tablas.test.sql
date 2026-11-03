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
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), $j$
 {"personas": {"upsert": [{"id": "d0000000-0000-0000-0000-000000000001", "nombre": "Diego", "tipo": "adulto", "factorRacion": 1, "activa": true}]}}
$j$::jsonb);
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

-- ---------------------------------------------------------------------------------------------
-- Ingredientes: de nombre a catálogo (los que existen se reutilizan; los nuevos se crean).
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _r select 'ing', public.resolver_ingredientes($j$
 [{"clave": "pollo", "nombre": "Pechuga de pollo", "unidad": "g", "seccion": "carne"},
  {"clave": "patata", "nombre": "Patata", "unidad": "g", "seccion": "fruta_verdura"},
  {"clave": "sal", "nombre": "  PECHUGA de pollo ", "unidad": "g", "seccion": "carne"}]
$j$::jsonb);
select pg_temp.igual('Se resuelven las 3 claves',
  (select (select count(*) from jsonb_object_keys(j)) from _r where clave = 'ing'), 3);
select pg_temp.igual('El mismo nombre (con otras mayúsculas y espacios) da el mismo ingrediente',
  (select ((j->>'pollo') = (j->>'sal'))::int from _r where clave = 'ing'), 1);
select pg_temp.falla('Una lista enorme se rechaza',
  $$select public.resolver_ingredientes((select jsonb_agg(jsonb_build_object('clave', g::text, 'nombre', 'Cosa ' || g, 'unidad', 'g')) from generate_series(1, 401) g))$$, '22023');

-- ---------------------------------------------------------------------------------------------
-- Todo el menú de una vez: 2 platos, una cena con DOS platos, nota, almuerzo, valoración, exclusión.
-- ---------------------------------------------------------------------------------------------
select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), format($j$
{
  "platos": {"upsert": [
    {"id": "10000000-0000-0000-0000-000000000001", "nombre": "Pollo con patatas", "grupo": "carne", "minutosActivos": 40,
     "pasos": "Dorar y hornear", "ultimaVez": "2026-11-01",
     "ingredientes": [{"ingredienteId": "%1$s", "cantidadPorRacion": 150, "opcional": false},
                      {"ingredienteId": "%2$s", "cantidadPorRacion": 200, "opcional": false}]},
    {"id": "10000000-0000-0000-0000-000000000002", "nombre": "Crema de calabacín", "grupo": "verdura", "ligero": true,
     "minutosActivos": 20, "porRevisar": true, "noProponer": true,
     "ingredientes": [{"ingredienteId": "%2$s", "cantidadPorRacion": 100, "opcional": true}]}
  ]},
  "excluidos": {"upsert": ["%1$s"]},
  "comidas": {"upsert": [
    {"fecha": "2026-11-05", "momento": "cena", "raciones": 3, "platos": ["10000000-0000-0000-0000-000000000002", "10000000-0000-0000-0000-000000000001"]}
  ]},
  "notas": {"upsert": [{"fecha": "2026-11-05", "momento": "cena", "texto": "o igual lomo, depende"}]},
  "almuerzos": {"upsert": [
    {"id": "20000000-0000-0000-0000-000000000001", "fecha": "2026-11-08", "texto": "Pollo con patatas", "platoId": "10000000-0000-0000-0000-000000000001"},
    {"id": "20000000-0000-0000-0000-000000000002", "fecha": "2026-11-08", "texto": "En casa de los abuelos"}
  ]},
  "valoraciones": {"upsert": [{"platoId": "10000000-0000-0000-0000-000000000001", "personaId": "d0000000-0000-0000-0000-000000000001", "puntos": 5}]}
}
$j$, (select j->>'pollo' from _r where clave = 'ing'), (select j->>'patata' from _r where clave = 'ing'))::jsonb);

insert into _r select 'menu', public.leer_menu_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Se leen 2 platos con sus ingredientes',
  (select (jsonb_array_length(j->'platos') = 2
           and jsonb_array_length(p->'ingredientes') = 2 and (p->>'minutosActivos')::int = 40
           and (p->>'ultimaVez') = '2026-11-01' and (p->>'ligero') = 'false')::int
     from _r, lateral (select e p from jsonb_array_elements(j->'platos') e where e->>'nombre' = 'Pollo con patatas') x
    where clave = 'menu'), 1);
select pg_temp.igual('«ligero» se guarda como rol «guarnicion» y vuelve como ligero; porRevisar y noProponer también',
  (select ((p->>'ligero') = 'true' and (p->>'porRevisar') = 'true' and (p->>'noProponer') = 'true')::int
     from _r, lateral (select e p from jsonb_array_elements(j->'platos') e where e->>'nombre' = 'Crema de calabacín') x
    where clave = 'menu'), 1);
select pg_temp.igual('En la tabla el plato ligero es una guarnición',
  (select count(*) from public.plato where nombre = 'Crema de calabacín' and rol = 'guarnicion'), 1);
select pg_temp.igual('Los ingredientes vienen del catálogo con nombre y unidad',
  (select (jsonb_array_length(j->'ingredientes') = 2 and (j->'ingredientes'->0->>'unidad') in ('g','ml','ud'))::int
     from _r where clave = 'menu'), 1);
select pg_temp.igual('Una cena con dos platos, EN ORDEN (la crema primero)',
  (select ((j->'comidas'->0->>'fecha') = '2026-11-05' and (j->'comidas'->0->>'raciones')::numeric = 3
           and (j->'comidas'->0->'platos'->>0) = '10000000-0000-0000-0000-000000000002'
           and (j->'comidas'->0->'platos'->>1) = '10000000-0000-0000-0000-000000000001')::int from _r where clave = 'menu'), 1);
select pg_temp.igual('Nota, exclusión y valoración',
  (select ((j->'notas'->0->>'texto') = 'o igual lomo, depende' and jsonb_array_length(j->'excluidos') = 1
           and (j->'valoraciones'->0->>'puntos')::int = 5)::int from _r where clave = 'menu'), 1);
select pg_temp.igual('Dos comidas del mediodía: una con plato y otra de texto libre',
  (select (jsonb_array_length(j->'almuerzos') = 2 and (j->'almuerzos'->1->'platoId') = 'null'::jsonb)::int
     from _r where clave = 'menu'), 1);

-- Reordenar y cambiar la cena: se sustituye la lista de platos entera.
select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), $j$
 {"comidas": {"upsert": [{"fecha": "2026-11-05", "momento": "cena", "raciones": 3,
    "platos": ["10000000-0000-0000-0000-000000000001"]}]}}
$j$::jsonb);
select pg_temp.igual('La cena queda con un solo plato',
  (select jsonb_array_length(public.leer_menu_tablas((select id from _ids where clave = 'HA'))->'comidas'->0->'platos')), 1);
-- Cambiar un plato: «ingredientes» ausente = no se tocan; presente = lista completa.
select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), $j$
 {"platos": {"upsert": [{"id": "10000000-0000-0000-0000-000000000001", "nombre": "Pollo asado con patatas", "grupo": "carne", "minutosActivos": 50}]}}
$j$::jsonb);
select pg_temp.igual('Renombrar un plato sin mandar ingredientes los conserva',
  (select (jsonb_array_length(p->'ingredientes') = 2 and (p->>'nombre') = 'Pollo asado con patatas')::int
     from (select e p from jsonb_array_elements(public.leer_menu_tablas((select id from _ids where clave = 'HA'))->'platos') e
            where e->>'nombre' like 'Pollo%') t), 1);

-- Borrados: nota, valoración, exclusión, almuerzo, cena y plato (la cena pierde ese plato).
select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), $j$
 {"notas": {"borrar": ["2026-11-05|cena"]},
  "valoraciones": {"borrar": ["10000000-0000-0000-0000-000000000001|d0000000-0000-0000-0000-000000000001"]},
  "excluidos": {"borrar": []},
  "almuerzos": {"borrar": ["20000000-0000-0000-0000-000000000002"]},
  "platos": {"borrar": ["10000000-0000-0000-0000-000000000002"]}}
$j$::jsonb);
insert into _r select 'tras', public.leer_menu_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Tras los borrados: 1 plato, sin notas ni valoraciones, 1 almuerzo',
  (select (jsonb_array_length(j->'platos') = 1 and jsonb_array_length(j->'notas') = 0
           and jsonb_array_length(j->'valoraciones') = 0 and jsonb_array_length(j->'almuerzos') = 1)::int
     from _r where clave = 'tras'), 1);
select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), $j$
 {"comidas": {"borrar": ["2026-11-05|cena"]}}
$j$::jsonb);
select pg_temp.igual('Borrar la cena se lleva sus platos pero no el plato',
  (select (select count(*) from public.comida_plato) * 10 + (select count(*) from public.plato)), 1);

-- ---------------------------------------------------------------------------------------------
-- Atomicidad y datos inválidos
-- ---------------------------------------------------------------------------------------------
select pg_temp.falla('Un plato con un ingrediente que no existe no se guarda, ni el resto',
  $$select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), '{
    "notas": {"upsert": [{"fecha": "2026-12-01", "texto": "no debe quedar"}]},
    "platos": {"upsert": [{"id": "10000000-0000-0000-0000-000000000009", "nombre": "Malo", "grupo": "carne", "minutosActivos": 10,
       "ingredientes": [{"ingredienteId": "99999999-0000-0000-0000-000000000000", "cantidadPorRacion": 1}]}]}}'::jsonb)$$, '23503');
select pg_temp.igual('Nada se coló (todo o nada)',
  (select jsonb_array_length(public.leer_menu_tablas((select id from _ids where clave = 'HA'))->'notas')), 0);
select pg_temp.falla('Una nota de más de 140 letras se rechaza',
  $$select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'),
     jsonb_build_object('notas', jsonb_build_object('upsert', jsonb_build_array(jsonb_build_object('fecha', '2026-12-01', 'texto', repeat('x', 141))))))$$, '23514');
select pg_temp.falla('Un plato repetido en la misma cena se rechaza',
  $$select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), '{"comidas": {"upsert": [{"fecha": "2026-12-02", "raciones": 2, "platos":
     ["10000000-0000-0000-0000-000000000001","10000000-0000-0000-0000-000000000001"]}]}}'::jsonb)$$, '23505');
select pg_temp.fin();

-- ---------------------------------------------------------------------------------------------
-- Aislamiento y anon
-- ---------------------------------------------------------------------------------------------
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.falla('Otro hogar no lee el menú de A',
  $$select public.leer_menu_tablas((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.falla('Otro hogar no escribe en el menú de A',
  $$select public.aplicar_cambios_menu((select id from _ids where clave = 'HA'), '{"notas": {"upsert": [{"fecha": "2026-12-01", "texto": "x"}]}}'::jsonb)$$, '42501');
select pg_temp.igual('El hogar C ve su menú vacío',
  (select jsonb_array_length(public.leer_menu_tablas((select id from _ids where clave = 'HC'))->'platos')), 0);
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.falla('anon no lee el menú', $$select public.leer_menu_tablas((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.falla('anon no resuelve ingredientes', $$select public.resolver_ingredientes('[]'::jsonb)$$, '42501');
select pg_temp.fin();

rollback;
