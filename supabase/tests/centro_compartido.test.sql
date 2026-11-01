-- Tests del centro (colegio) compartido: es la única excepción al aislamiento por hogar, así que
-- se comprueba sobre todo que compartir centro NO abre datos privados y que el código no se puede
-- abusar. Corre en una transacción que se deshace al final.
\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Usuarios: A (curador del centro X), B (admin) y B2 (miembro no admin) del hogar B, C, E (dueño de
-- otro centro Y), F (hogar que intentará usar códigos inválidos) y D (para el derecho de supresión).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test'),
  ('b2b2b2b2-0000-0000-0000-0000000000b2', 'b2@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@ejemplo.test'),
  ('dddddddd-0000-0000-0000-00000000000d', 'd@ejemplo.test'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@ejemplo.test'),
  ('ffffffff-0000-0000-0000-00000000000f', 'f@ejemplo.test');

create temp table _ids (clave text primary key, id uuid);
create temp table _codigos (clave text primary key, codigo text);
grant all on _ids, _codigos to authenticated;

-- Hogares ------------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into public.persona (hogar_id, nombre, tipo) select id, 'Diego', 'adulto' from _ids where clave = 'HA';
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
insert into _codigos values ('invHB', public.crear_invitacion((select id from _ids where clave = 'HB')));
select pg_temp.fin();

select pg_temp.como('b2b2b2b2-0000-0000-0000-0000000000b2');
select public.unirse_a_hogar((select codigo from _codigos where clave = 'invHB'));   -- B2: miembro, no admin
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

select pg_temp.como('dddddddd-0000-0000-0000-00000000000d');
insert into _ids values ('HD', public.crear_hogar('Hogar D'));
select pg_temp.fin();

select pg_temp.como('eeeeeeee-0000-0000-0000-00000000000e');
insert into _ids values ('HE', public.crear_hogar('Hogar E'));
insert into _ids values ('Y', public.crear_centro((select id from _ids where clave = 'HE'), 'Otro colegio', null));
select pg_temp.fin();

select pg_temp.como('ffffffff-0000-0000-0000-00000000000f');
insert into _ids values ('HF', public.crear_hogar('Hogar F'));
select pg_temp.fin();

-- 1. Crear centro y códigos ------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('X', public.crear_centro((select id from _ids where clave = 'HA'), 'CEIP Ejemplo', 'Madrid'));
insert into _codigos values ('cX', public.crear_codigo_centro((select id from _ids where clave = 'X'), 30, 2));
select pg_temp.igual('A ve su centro', pg_temp.cuenta('select 1 from public.centro'), 1);
select pg_temp.falla('Un parámetro fuera de rango se rechaza',
  $q$select public.crear_codigo_centro((select id from _ids where clave = 'X'), 400, 2)$q$, '22023');
select pg_temp.fin();

select pg_temp.igual('El código del centro no se guarda en claro',
  pg_temp.cuenta($q$select 1 from public.centro_codigo cc join _codigos c on c.codigo = cc.codigo_hash$q$), 0);

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Antes de unirse, B no ve ningún centro', pg_temp.cuenta('select 1 from public.centro'), 0);
select pg_temp.falla('B no puede escribir en el menú de un centro al que no pertenece',
  $q$insert into public.menu_cole_dia (centro_id, fecha, primero) select id, date '2026-11-02', 'X' from _ids where clave = 'X'$q$, '42501');
select pg_temp.falla('Un hogar no puede crear códigos de un centro ajeno',
  $q$select public.crear_codigo_centro((select id from _ids where clave = 'X'))$q$, '42501');
select pg_temp.fin();

-- 2. Unirse con el código ---------------------------------------------------------------------
select pg_temp.como('b2b2b2b2-0000-0000-0000-0000000000b2');
select pg_temp.falla('Un miembro que no es admin no puede vincular el hogar',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HB'), (select codigo from _codigos where clave = 'cX'))$q$, '42501');
select pg_temp.falla('Nadie vincula un hogar ajeno (B2 no es miembro del hogar A)',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HA'), (select codigo from _codigos where clave = 'cX'))$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B se une al centro con el código',
  (public.unirse_a_centro((select id from _ids where clave = 'HB'), (select codigo from _codigos where clave = 'cX'))
    = (select id from _ids where clave = 'X'))::int, 1);
select pg_temp.igual('Ya vinculado, B ve el centro', pg_temp.cuenta('select 1 from public.centro'), 1);
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select public.unirse_a_centro((select id from _ids where clave = 'HC'), (select codigo from _codigos where clave = 'cX'));
select pg_temp.fin();

select pg_temp.igual('El código ha consumido dos usos', pg_temp.cuenta('select 1 from public.centro_codigo where usos = 2'), 1);

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select public.unirse_a_centro((select id from _ids where clave = 'HB'), (select codigo from _codigos where clave = 'cX'));
select pg_temp.fin();
select pg_temp.igual('Repetir el alta es idempotente: no consume otro uso',
  pg_temp.cuenta('select 1 from public.centro_codigo where usos = 2'), 1);

select pg_temp.como('ffffffff-0000-0000-0000-00000000000f');
select pg_temp.falla('Un código agotado no sirve (máximo de usos)',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HF'), (select codigo from _codigos where clave = 'cX'))$q$, 'P0002');
select pg_temp.falla('Un código inventado no sirve',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HF'), 'NOEXISTE0000')$q$, 'P0002');
select pg_temp.fin();

-- 3. Compartir centro NO abre datos privados -------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B solo ve el vínculo de su propio hogar, no qué otros hogares participan',
  pg_temp.cuenta('select 1 from public.centro_hogar'), 1);
select pg_temp.igual('B no ve el hogar A (mismo colegio)', pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar A'$q$), 0);
select pg_temp.igual('B no ve a las personas del hogar A', pg_temp.cuenta($q$select 1 from public.persona where nombre = 'Diego'$q$), 0);
select pg_temp.igual('B no ve a los miembros del hogar A',
  pg_temp.cuenta($q$select 1 from public.miembro where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'$q$), 0);
select pg_temp.igual('B no ve los códigos del centro (solo curadores)', pg_temp.cuenta('select 1 from public.centro_codigo'), 0);
select pg_temp.fin();

-- 4. Menú del cole compartido ------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.menu_cole_dia (centro_id, fecha, primero, segundo, grupo_primero, grupo_segundo)
  select id, date '2026-11-02', 'Lentejas con verduras', 'Merluza al horno', 'legumbre', 'pescado'
  from _ids where clave = 'X';
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into public.menu_cole_dia (centro_id, fecha, primero, segundo, grupo_primero, grupo_segundo)
  select id, date '2026-11-03', 'Crema de calabacín', 'Pollo asado', 'verdura', 'carne'
  from _ids where clave = 'X';
do $$ declare n bigint; begin
  update public.menu_cole_dia set postre = 'Fruta' where fecha = date '2026-11-02'; get diagnostics n = row_count;
  perform pg_temp.igual('Un hogar vinculado puede corregir un día del menú', n, 1);
  delete from public.menu_cole_dia where fecha = date '2026-11-03'; get diagnostics n = row_count;
  perform pg_temp.igual('Un hogar no curador no puede borrar días del menú', n, 0);
end $$;
select pg_temp.falla('Un grupo alimenticio inválido se rechaza',
  $q$insert into public.menu_cole_dia (centro_id, fecha, primero, grupo_primero) select id, date '2026-11-04', 'Tarta', 'dulce' from _ids where clave = 'X'$q$, '23514');
select pg_temp.falla('Un día sin ningún plato se rechaza',
  $q$insert into public.menu_cole_dia (centro_id, fecha) select id, date '2026-11-05' from _ids where clave = 'X'$q$, '23514');
select pg_temp.falla('No se puede mover un día del menú a un centro ajeno',
  $q$update public.menu_cole_dia set centro_id = (select id from _ids where clave = 'Y') where fecha = date '2026-11-02'$q$, '42501');
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('Otro hogar del mismo colegio ve los dos días', pg_temp.cuenta('select 1 from public.menu_cole_dia'), 2);
select pg_temp.fin();

select pg_temp.como('eeeeeeee-0000-0000-0000-00000000000e');
select pg_temp.igual('Un hogar de otro colegio no ve el menú', pg_temp.cuenta('select 1 from public.menu_cole_dia'), 0);
select pg_temp.falla('Un hogar de otro colegio no puede escribir en este menú',
  $q$insert into public.menu_cole_dia (centro_id, fecha, primero) select id, date '2026-11-06', 'X' from _ids where clave = 'X'$q$, '42501');
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('anon no puede leer el menú', 'select * from public.menu_cole_dia', '42501');
select pg_temp.falla('anon no puede leer centros', 'select * from public.centro', '42501');
select pg_temp.falla('anon no puede crear centros', $q$select public.crear_centro(gen_random_uuid(), 'Anon centro', null)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
do $$ declare n bigint; begin
  delete from public.menu_cole_dia where fecha = date '2026-11-03'; get diagnostics n = row_count;
  perform pg_temp.igual('Un curador sí puede borrar un día del menú', n, 1);
end $$;
select pg_temp.fin();

-- 5. Historial inmutable y solo para curadores --------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('El curador ve el historial: alta, alta, corrección y borrado',
  pg_temp.cuenta('select 1 from public.menu_cole_dia_historial'), 4);
select pg_temp.igual('El historial guarda el valor anterior de una corrección',
  pg_temp.cuenta($q$select 1 from public.menu_cole_dia_historial where operacion = 'UPDATE' and anterior ->> 'postre' is null and nuevo ->> 'postre' = 'Fruta'$q$), 1);
select pg_temp.falla('Ni un curador puede modificar el historial',
  $q$update public.menu_cole_dia_historial set operacion = 'INSERT'$q$, '42501');
select pg_temp.falla('Ni un curador puede borrar el historial',
  $q$delete from public.menu_cole_dia_historial$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('Un no curador no ve el historial (contiene quién cambió qué)',
  pg_temp.cuenta('select 1 from public.menu_cole_dia_historial'), 0);
select pg_temp.fin();

-- 6. Códigos: revocación y caducidad -----------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
do $$ declare n bigint; begin
  update public.centro_codigo set revocado = true; get diagnostics n = row_count;
  perform pg_temp.igual('Un no curador no puede revocar códigos', n, 0);
end $$;
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Ni un curador puede cambiar el límite de usos de un código (solo revocar)',
  $q$update public.centro_codigo set max_usos = 500$q$, '42501');
insert into _codigos values ('cX2', public.crear_codigo_centro((select id from _ids where clave = 'X'), 30, 10));
select pg_temp.fin();

select pg_temp.como('ffffffff-0000-0000-0000-00000000000f');
select pg_temp.igual('Un código nuevo y válido permite unirse',
  (public.unirse_a_centro((select id from _ids where clave = 'HF'), (select codigo from _codigos where clave = 'cX2'))
    = (select id from _ids where clave = 'X'))::int, 1);
delete from public.centro_hogar where hogar_id = (select id from _ids where clave = 'HF');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
do $$ declare n bigint; begin
  update public.centro_codigo set revocado = true where usos = 1; get diagnostics n = row_count;
  perform pg_temp.igual('Un curador revoca el código', n, 1);
end $$;
select pg_temp.fin();

select pg_temp.como('ffffffff-0000-0000-0000-00000000000f');
select pg_temp.falla('Un código revocado no sirve',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HF'), (select codigo from _codigos where clave = 'cX2'))$q$, 'P0002');
select pg_temp.fin();

insert into public.centro_codigo (centro_id, codigo_hash, caduca_en)
  select id, encode(extensions.digest('EXPIRADO0001', 'sha256'), 'hex'), now() - interval '1 day'
  from _ids where clave = 'X';
select pg_temp.como('ffffffff-0000-0000-0000-00000000000f');
select pg_temp.falla('Un código caducado no sirve',
  $q$select public.unirse_a_centro((select id from _ids where clave = 'HF'), 'EXPIRADO0001')$q$, 'P0002');
select pg_temp.fin();

-- 7. Creación de centros: permisos y límite anti-spam -----------------------------------------
select pg_temp.como('b2b2b2b2-0000-0000-0000-0000000000b2');
select pg_temp.falla('Un miembro que no es admin no puede crear centros',
  $q$select public.crear_centro((select id from _ids where clave = 'HB'), 'Colegio de B2', null)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('eeeeeeee-0000-0000-0000-00000000000e');
select public.crear_centro((select id from _ids where clave = 'HE'), 'Segundo colegio', null);
select public.crear_centro((select id from _ids where clave = 'HE'), 'Tercer colegio', null);
select pg_temp.falla('Un usuario no puede crear más de 3 centros',
  $q$select public.crear_centro((select id from _ids where clave = 'HE'), 'Cuarto colegio', null)$q$, '54000');
select pg_temp.fin();

-- 8. Salir del centro --------------------------------------------------------------------------
select pg_temp.como('b2b2b2b2-0000-0000-0000-0000000000b2');
do $$ declare n bigint; begin
  delete from public.centro_hogar where hogar_id = (select id from _ids where clave = 'HB'); get diagnostics n = row_count;
  perform pg_temp.igual('Un miembro no admin no puede sacar a su hogar del centro', n, 0);
end $$;
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
do $$ declare n bigint; begin
  delete from public.centro_hogar where hogar_id = (select id from _ids where clave = 'HB'); get diagnostics n = row_count;
  perform pg_temp.igual('El admin del hogar puede salir del centro', n, 1);
end $$;
select pg_temp.igual('Tras salir, B ya no ve el centro', pg_temp.cuenta('select 1 from public.centro'), 0);
select pg_temp.igual('Tras salir, B ya no ve el menú', pg_temp.cuenta('select 1 from public.menu_cole_dia'), 0);
select pg_temp.fin();

-- 9. Derecho de supresión: se puede borrar la cuenta de quien creó un hogar -------------------
delete from auth.users where id = 'dddddddd-0000-0000-0000-00000000000d';
select pg_temp.igual('Borrar la cuenta del creador conserva el hogar, sin autoría',
  pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar D' and creado_por is null$q$), 1);
select pg_temp.igual('...y elimina su pertenencia al hogar',
  pg_temp.cuenta($q$select 1 from public.miembro where user_id = 'dddddddd-0000-0000-0000-00000000000d'$q$), 0);

rollback;
\echo 'TODOS LOS TESTS DEL CENTRO COMPARTIDO PASAN'
