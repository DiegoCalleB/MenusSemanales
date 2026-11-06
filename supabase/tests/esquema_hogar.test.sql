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

-- Hogar A: Diego lo crea; Ana (B) se une. Hogar C: otra familia.
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

-- Personas del hogar A: Diego (cuenta A), Ana (cuenta B, vinculada) y Alba (niña, sin cuenta).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.persona (hogar_id, nombre, tipo)
  select id, 'Diego', 'adulto' from _ids where clave = 'HA';
insert into public.persona (hogar_id, nombre, tipo)
  select id, 'Ana', 'adulto' from _ids where clave = 'HA';
insert into public.persona (hogar_id, nombre, tipo)
  select id, 'Alba', 'nino' from _ids where clave = 'HA';
-- Vincular una persona a una cuenta no se puede hacer directamente (D-088): lo simula quien administra.
select pg_temp.fin();
update public.persona set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where nombre = 'Ana';
update public.persona set user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' where nombre = 'Diego';
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');

-- Cumpleaños de Ana (7/11), con su regalo e ideas, y el de Alba.
insert into public.cumple (hogar_id, persona_id, nombre, dia, mes, anio)
  select p.hogar_id, p.id, 'Ana', 7, 11, 1984 from public.persona p where p.nombre = 'Ana';
insert into public.cumple (hogar_id, persona_id, nombre, dia, mes, anio)
  select p.hogar_id, p.id, 'Alba', 4, 2, 2017 from public.persona p where p.nombre = 'Alba';
insert into public.cumple_regalo (cumple_id, hogar_id, estado, anio_estado, gustos)
  select c.id, c.hogar_id, 'comprado', 2026, array['flores'] from public.cumple c where c.nombre = 'Ana';
insert into public.cumple_idea (hogar_id, cumple_id, texto)
  select c.hogar_id, c.id, 'Perfume secreto' from public.cumple c where c.nombre = 'Ana';
insert into public.cumple_idea (hogar_id, cumple_id, texto, origen)
  select c.hogar_id, c.id, 'Disfraz', 'ia' from public.cumple c where c.nombre = 'Alba';
select pg_temp.igual('Diego ve los dos cumpleaños', pg_temp.cuenta('select 1 from public.cumple'), 2);
select pg_temp.igual('Diego ve el regalo y las ideas de Ana (no es quien cumple)',
  pg_temp.cuenta($q$select 1 from public.cumple_idea i join public.cumple c on c.id = i.cumple_id where c.nombre = 'Ana'$q$), 1);
select pg_temp.igual('Diego ve el estado del regalo', pg_temp.cuenta('select 1 from public.cumple_regalo'), 1);
select pg_temp.fin();

-- El secreto, en la base de datos: Ana ve su cumpleaños pero NADA de su regalo.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Ana ve los cumpleaños (el suyo y el de Alba)', pg_temp.cuenta('select 1 from public.cumple'), 2);
select pg_temp.igual('Ana NO ve las ideas de su propio regalo',
  pg_temp.cuenta($q$select 1 from public.cumple_idea i join public.cumple c on c.id = i.cumple_id where c.nombre = 'Ana'$q$), 0);
select pg_temp.igual('Ana NO ve el estado ni los gustos de su regalo', pg_temp.cuenta('select 1 from public.cumple_regalo'), 0);
select pg_temp.igual('Ana sí ve las ideas del regalo de Alba',
  pg_temp.cuenta($q$select 1 from public.cumple_idea i join public.cumple c on c.id = i.cumple_id where c.nombre = 'Alba'$q$), 1);
select pg_temp.falla('Ana no puede añadirse ideas a su propio regalo',
  $q$insert into public.cumple_idea (hogar_id, cumple_id, texto) select hogar_id, id, 'Colarme' from public.cumple where nombre = 'Ana'$q$, '42501');
select pg_temp.falla('Ni cambiar el estado de su regalo (ni siquiera lo ve)',
  $q$insert into public.cumple_regalo (cumple_id, hogar_id) select id, hogar_id from public.cumple where nombre = 'Ana'$q$, '42501');
select pg_temp.fin();

-- Aislamiento entre hogares.
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('Otro hogar no ve cumpleaños', pg_temp.cuenta('select 1 from public.cumple'), 0);
select pg_temp.igual('Otro hogar no ve regalos', pg_temp.cuenta('select 1 from public.cumple_idea'), 0);
select pg_temp.falla('Otro hogar no puede escribir en el hogar A',
  $q$insert into public.apunte (hogar_id, fecha, titulo) select id, '2026-11-12', 'Colado' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('Ni en tareas de casa',
  $q$insert into public.tarea_casa (hogar_id, titulo, cada_dias, desde) select id, 'Colada', 7, '2026-11-02' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.fin();

-- Apuntes, fechas, casa, tareas, comida y ajustes: funcionan para el hogar y respetan sus reglas.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.apunte (hogar_id, fecha, hora, titulo)
  select id, '2026-11-12', '18:15', 'Psicotécnico' from _ids where clave = 'HA';
insert into public.apunte (hogar_id, fecha, hasta, titulo)
  select id, '2026-11-17', '2026-11-19', 'Puente' from _ids where clave = 'HA';
insert into public.fecha_senalada (hogar_id, fecha, titulo, emoji)
  select id, '2026-11-20', 'Fiesta', '🎉' from _ids where clave = 'HA';
insert into public.tarea_casa (hogar_id, titulo, emoji, cada_dias, desde, compra, responsable_id)
  select p.hogar_id, 'Comprar arena', '🛒', 30, '2026-11-09', 'Arena para gatos', p.id from public.persona p where p.nombre = 'Diego';
insert into public.tarea_persona (hogar_id, persona_id, texto, frecuencia)
  select p.hogar_id, p.id, 'Deberes', 'diaria' from public.persona p where p.nombre = 'Alba';
insert into public.tarea_persona_hecha (tarea_id, hogar_id, fecha)
  select t.id, t.hogar_id, '2026-11-02' from public.tarea_persona t;
insert into public.almuerzo (hogar_id, fecha, texto) select id, '2026-11-08', 'Paella' from _ids where clave = 'HA';
insert into public.hogar_ajuste (hogar_id, horizonte) select id, 'quincena' from _ids where clave = 'HA';
select pg_temp.igual('Diego guarda apuntes', pg_temp.cuenta('select 1 from public.apunte'), 2);
select pg_temp.igual('Una tarea de casa guarda qué comprar', (select count(*) from public.tarea_casa where compra = 'Arena para gatos'), 1);
select pg_temp.igual('Hay tareas, comida y ajustes',
  pg_temp.cuenta('select 1 from public.tarea_persona') + pg_temp.cuenta('select 1 from public.almuerzo') + pg_temp.cuenta('select 1 from public.hogar_ajuste'), 3);

select pg_temp.falla('Un apunte no puede acabar antes de empezar',
  $q$insert into public.apunte (hogar_id, fecha, hasta, titulo) select id, '2026-11-20', '2026-11-20', 'Mal' from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('Un apunte no se repite el mismo día con el mismo título (da igual mayúsculas)',
  $q$insert into public.apunte (hogar_id, fecha, titulo) select id, '2026-11-12', 'psicotécnico ' from _ids where clave = 'HA'$q$, '23505');
select pg_temp.falla('El 31 de abril no existe',
  $q$insert into public.cumple (hogar_id, nombre, dia, mes) select id, 'Mal', 31, 4 from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('Un mes 13 tampoco',
  $q$insert into public.cumple (hogar_id, nombre, dia, mes) select id, 'Mal', 1, 13 from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('Una persona del hogar solo tiene un cumpleaños',
  $q$insert into public.cumple (hogar_id, persona_id, nombre, dia, mes) select hogar_id, id, 'Ana otra vez', 8, 11 from public.persona where nombre = 'Ana'$q$, '23505');
select pg_temp.falla('Una tarea de casa no puede repetirse cada 0 días',
  $q$insert into public.tarea_casa (hogar_id, titulo, cada_dias, desde) select id, 'Mal', 0, '2026-11-02' from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('Ni repetir el mismo título',
  $q$insert into public.tarea_casa (hogar_id, titulo, cada_dias, desde) select id, ' COMPRAR ARENA', 7, '2026-11-02' from _ids where clave = 'HA'$q$, '23505');
select pg_temp.falla('El horizonte solo es semana, quincena o mes',
  $q$update public.hogar_ajuste set horizonte = 'año'$q$, '23514');
-- «mes» sí vale (planificar a un mes vista); si la restricción no lo admitiera, esto abortaría el test.
update public.hogar_ajuste set horizonte = 'mes' where hogar_id in (select id from _ids where clave = 'HA');
update public.hogar_ajuste set horizonte = 'quincena' where hogar_id in (select id from _ids where clave = 'HA');
select pg_temp.falla('No se puede asignar una tarea a una persona de otro hogar',
  $q$insert into public.tarea_casa (hogar_id, titulo, cada_dias, desde, responsable_id)
       select h.id, 'Ajena', 7, '2026-11-02', gen_random_uuid() from _ids h where h.clave = 'HA'$q$, '23503');

-- Borrar a una persona no borra su cumpleaños: solo suelta el vínculo.
delete from public.persona where nombre = 'Alba';
select pg_temp.igual('Al borrar a Alba, su cumpleaños sigue y queda sin persona',
  (select count(*) from public.cumple where nombre = 'Alba' and persona_id is null and hogar_id is not null), 1);
select pg_temp.igual('Sus tareas sí se van con ella', pg_temp.cuenta('select 1 from public.tarea_persona'), 0);
select pg_temp.fin();

-- Los días del hogar tienen «saltado» (por defecto no).
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.dia_hogar (hogar_id, fecha) select id, '2026-11-03' from _ids where clave = 'HA';
select pg_temp.igual('Un día nuevo no está saltado', (select count(*) from public.dia_hogar where not saltado and not llega_tarde), 1);
select pg_temp.fin();

-- Catálogos: lectura con sesión; ni escribir ni leer sin ella.
-- (Los catálogos ya traen datos de fábrica de la migración siguiente: aquí solo se prueba el acceso.)
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Con sesión se leen los cuatro catálogos',
  (pg_temp.cuenta('select 1 from public.catalogo_categoria_super') > 0)::int + (pg_temp.cuenta('select 1 from public.catalogo_regla_categoria') > 0)::int
  + (pg_temp.cuenta('select 1 from public.catalogo_plantilla_casa') > 0)::int + (pg_temp.cuenta('select 1 from public.catalogo_idea_regalo') > 0)::int, 4);
select pg_temp.falla('Nadie escribe en los catálogos desde la app',
  $q$insert into public.catalogo_idea_regalo (edad_hasta, texto, orden) values (5, 'Colada', 999)$q$, '42501');
select pg_temp.falla('Ni los cambia', $q$update public.catalogo_plantilla_casa set cada_dias = 2$q$, '42501');
select pg_temp.falla('Ni los borra', $q$delete from public.catalogo_categoria_super$q$, '42501');
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.falla('Sin sesión no se lee ningún catálogo', $q$select * from public.catalogo_idea_regalo$q$, '42501');
select pg_temp.falla('Ni nada del hogar', $q$select * from public.cumple$q$, '42501');
select pg_temp.fin();

-- Privilegios: anon no tiene nada en las tablas nuevas; el resto, solo lo necesario.
select pg_temp.igual('anon no tiene ningún privilegio en las tablas nuevas',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'
      and table_name in ('cumple','cumple_regalo','cumple_idea','apunte','fecha_senalada','tarea_casa','tarea_persona',
                         'tarea_persona_hecha','almuerzo','hogar_ajuste','ingrediente_excluido',
                         'catalogo_categoria_super','catalogo_regla_categoria','catalogo_plantilla_casa','catalogo_idea_regalo')), 0);
select pg_temp.igual('Los catálogos son solo de lectura para authenticated',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and table_name like 'catalogo\_%' and privilege_type <> 'SELECT'), 0);
select pg_temp.igual('Ninguna tabla nueva permite TRUNCATE, TRIGGER ni REFERENCES a authenticated',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')), 0);

rollback;
\echo 'esquema_hogar: OK'
