\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'diego@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'ana@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'otra@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
create temp table _codigo (clave text primary key, c text);
grant all on _codigo to authenticated;
create temp table _leido (clave text primary key, j jsonb);
grant all on _leido to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select public.aplicar_cambios_tablas((select id from _ids where clave = 'HA'), $j$
{ "personas": {"upsert": [
    {"id": "d0000000-0000-0000-0000-000000000001", "nombre": "Diego", "tipo": "adulto", "factorRacion": 1, "activa": true},
    {"id": "d0000000-0000-0000-0000-000000000002", "nombre": "Ana",   "tipo": "adulto", "factorRacion": 1, "activa": true},
    {"id": "d0000000-0000-0000-0000-000000000003", "nombre": "Alba",  "tipo": "nino",   "factorRacion": 0.5, "activa": true}]},
  "cumples": {"upsert": [
    {"id": "c0000000-0000-0000-0000-000000000001", "nombre": "Ana", "dia": 7, "mes": 11, "relacion": "familia",
     "personaId": "d0000000-0000-0000-0000-000000000002",
     "regalo": {"estado": "comprado", "gustos": []}, "ideas": [{"id": "e0000000-0000-0000-0000-000000000001", "texto": "Sorpresa"}]}]} }
$j$::jsonb);
select pg_temp.igual('Antes de vincular nadie, mi_persona es nula',
  (select (public.mi_persona((select id from _ids where clave = 'HA')) is null)::int), 1);

-- Diego se vincula a su persona; no puede vincularse a una segunda.
select public.vincular_persona_propia((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000001');
select pg_temp.igual('Diego es Diego',
  (select (public.mi_persona((select id from _ids where clave = 'HA')) = 'd0000000-0000-0000-0000-000000000001')::int), 1);
select pg_temp.falla('Diego no puede ser también Ana',
  $$select public.vincular_persona_propia((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000002')$$, '22023');

-- Invitación para Ana.
insert into _codigo select 'ana', public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000002');
select pg_temp.falla('No se invita a una persona que ya tiene cuenta',
  $$select public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000001')$$, '22023');
select pg_temp.falla('No se invita a una persona de otro hogar / inexistente',
  $$select public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-0000000000ff')$$, '22023');
select pg_temp.fin();

-- Un nuevo código para la misma persona invalida el anterior.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _codigo select 'ana2', public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000002');
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.falla('El código anterior ya no vale',
  $$select public.unirse_a_hogar((select c from _codigo where clave = 'ana'))$$, 'P0002');
select pg_temp.fin();

-- Ana entra con el código y queda vinculada.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select public.unirse_a_hogar((select c from _codigo where clave = 'ana2'));
select pg_temp.igual('Ana es Ana',
  (select (public.mi_persona((select id from _ids where clave = 'HA')) = 'd0000000-0000-0000-0000-000000000002')::int), 1);
select pg_temp.falla('Ana no es administradora: no invita',
  $$select public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000003')$$, '42501');
select pg_temp.falla('Ana no puede vincularse a otra persona',
  $$select public.vincular_persona_propia((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000003')$$, '42501');
select pg_temp.falla('El código no se reutiliza',
  $$select public.unirse_a_hogar((select c from _codigo where clave = 'ana2'))$$, 'P0002');
-- El secreto ya funciona: Ana ve su cumple sin regalo ni ideas.
insert into _leido select 'ana', public.leer_hogar_tablas((select id from _ids where clave = 'HA'));
select pg_temp.igual('Ana ve su cumple pero no su regalo ni sus ideas',
  (select ((j->'cumples'->0->>'nombre') = 'Ana' and (j->'cumples'->0->'regalo') = 'null'::jsonb
           and jsonb_array_length(j->'cumples'->0->'ideas') = 0)::int from _leido where clave = 'ana'), 1);
select pg_temp.fin();

-- Y la persona vinculada no puede robarse: otra cuenta con un código para Ana ya usada falla.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Ana ya tiene cuenta: no se le puede crear otro código',
  $$select public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000002')$$, '22023');
-- Invitación para Alba canjeada por una cuenta que ya es otra persona: falla y no la consume.
insert into _codigo select 'alba', public.crear_invitacion_persona((select id from _ids where clave = 'HA'), 'd0000000-0000-0000-0000-000000000003');
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('Ana no puede quedarse también con Alba',
  $$select public.unirse_a_hogar((select c from _codigo where clave = 'alba'))$$, '22023');
select pg_temp.fin();
select pg_temp.igual('La invitación de Alba sigue sin usar',
  (select count(*) from public.invitacion where persona_id = 'd0000000-0000-0000-0000-000000000003' and usada_en is null), 1);

-- Anónimos fuera.
select pg_temp.como(null);
select pg_temp.falla('anon no puede ejecutar', $$select public.mi_persona((select id from _ids where clave = 'HA'))$$, '42501');
select pg_temp.fin();

rollback;
