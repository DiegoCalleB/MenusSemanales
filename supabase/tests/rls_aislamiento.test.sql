-- Tests de aislamiento entre hogares (RLS) y de las funciones de invitación.
-- Cada comprobación lanza una excepción si falla; el script corre dentro de una
-- transacción que se deshace al final.
\set ON_ERROR_STOP on
begin;

-- Utilidades -----------------------------------------------------------------
create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role ' || case when p_uid is null then 'anon' else 'authenticated' end;
end $$;

create function pg_temp.fin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;

create function pg_temp.cuenta(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') t' into n; return n; end $$;

-- Ejecuta p_sql y exige que falle con el SQLSTATE indicado.
create function pg_temp.falla(p_nombre text, p_sql text, p_sqlstate text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then raise notice 'OK    %', p_nombre; return; end if;
    raise exception 'FALLO % : esperaba SQLSTATE %, llegó % (%)', p_nombre, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'FALLO % : debía fallar y no falló', p_nombre;
end $$;

create function pg_temp.igual(p_nombre text, p_real bigint, p_esperado bigint) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLO % : esperaba %, obtuvo %', p_nombre, p_esperado, p_real;
  end if;
  raise notice 'OK    %', p_nombre;
end $$;

-- Datos de partida (como superusuario) ---------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@ejemplo.test'),   -- admin del hogar A
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@ejemplo.test'),   -- admin del hogar B
  ('cccccccc-0000-0000-0000-000000000003', 'c@ejemplo.test');   -- sin hogar

-- Hogar A y B creados por sus dueños mediante la función pública.
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
insert into _ids values ('hogarA', public.crear_hogar('Hogar A'));
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
insert into _ids values ('hogarB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- Personas: una en cada hogar, creadas por su dueño.
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
with x as (
  insert into public.persona (hogar_id, nombre, tipo, factor_racion)
  select id, 'Diego', 'adulto', 1 from _ids where clave = 'hogarA' returning id)
insert into _ids select 'personaA', id from x;
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-000000000002');
with x as (
  insert into public.persona (hogar_id, nombre, tipo, factor_racion)
  select id, 'Otra familia', 'nino', 0.5 from _ids where clave = 'hogarB' returning id)
insert into _ids select 'personaB', id from x;
insert into public.patron_asistencia (hogar_id, persona_id, dia_semana, comida, lugar)
  select h.id, p.id, 1, 'cena', 'casa' from _ids h, _ids p where h.clave = 'hogarB' and p.clave = 'personaB';
select pg_temp.fin();

-- 1. Lectura: cada usuario solo ve su hogar ---------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.igual('A ve solo su hogar', pg_temp.cuenta('select 1 from public.hogar'), 1);
select pg_temp.igual('A no ve el hogar B', pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar B'$q$), 0);
select pg_temp.igual('A no ve personas de B', pg_temp.cuenta($q$select 1 from public.persona where nombre = 'Otra familia'$q$), 0);
select pg_temp.igual('A no ve la asistencia de B', pg_temp.cuenta('select 1 from public.patron_asistencia'), 0);
select pg_temp.igual('A no ve miembros de B', pg_temp.cuenta($q$select 1 from public.miembro where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$q$), 0);

-- 2. Escritura cruzada -------------------------------------------------------
select pg_temp.falla('A no puede insertar personas en el hogar B',
  $q$insert into public.persona (hogar_id, nombre, tipo) select id, 'Intruso', 'adulto' from _ids where clave = 'hogarB'$q$, '42501');
select pg_temp.falla('A no puede mover una persona suya al hogar B (UPDATE hogar_id)',
  $q$update public.persona set hogar_id = (select id from _ids where clave = 'hogarB') where nombre = 'Diego'$q$, '42501');
select pg_temp.falla('A no puede enlazar asistencia de su hogar con una persona de B (FK compuesta)',
  $q$insert into public.patron_asistencia (hogar_id, persona_id, dia_semana, comida, lugar)
     select a.id, p.id, 2, 'cena', 'casa' from _ids a, _ids p where a.clave = 'hogarA' and p.clave = 'personaB'$q$, '23503');
select pg_temp.falla('A no puede insertarse como miembro del hogar B',
  $q$insert into public.miembro (hogar_id, user_id, rol) select id, 'aaaaaaaa-0000-0000-0000-000000000001', 'admin' from _ids where clave = 'hogarB'$q$, '42501');
select pg_temp.falla('Nadie crea hogares por INSERT directo',
  $q$insert into public.hogar (nombre) values ('Directo')$q$, '42501');

-- UPDATE y DELETE sobre filas ajenas no afectan a ninguna fila (RLS las oculta).
do $$ declare n bigint; begin
  update public.persona set nombre = 'Hackeado' where nombre = 'Otra familia'; get diagnostics n = row_count;
  perform pg_temp.igual('A no puede actualizar personas de B', n, 0);
  delete from public.persona where nombre = 'Otra familia'; get diagnostics n = row_count;
  perform pg_temp.igual('A no puede borrar personas de B', n, 0);
  update public.hogar set nombre = 'Hackeado' where nombre = 'Hogar B'; get diagnostics n = row_count;
  perform pg_temp.igual('A no puede renombrar el hogar B', n, 0);
  delete from public.hogar where nombre = 'Hogar B'; get diagnostics n = row_count;
  perform pg_temp.igual('A no puede borrar el hogar B', n, 0);
end $$;

select pg_temp.falla('A no puede invitar al hogar B',
  $q$select public.crear_invitacion((select id from _ids where clave = 'hogarB'))$q$, '42501');
select pg_temp.fin();

-- 3. Verificación como superusuario: los datos de B siguen intactos ----------
select pg_temp.igual('La persona de B sigue intacta',
  pg_temp.cuenta($q$select 1 from public.persona where nombre = 'Otra familia' and tipo = 'nino'$q$), 1);
select pg_temp.igual('El hogar B sigue existiendo',
  pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar B'$q$), 1);

-- 4. Usuario sin hogar y anónimo ---------------------------------------------
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select pg_temp.igual('Usuario sin hogar no ve hogares', pg_temp.cuenta('select 1 from public.hogar'), 0);
select pg_temp.igual('Usuario sin hogar no ve personas', pg_temp.cuenta('select 1 from public.persona'), 0);
select pg_temp.falla('Usuario sin hogar no puede crear personas',
  $q$insert into public.persona (hogar_id, nombre, tipo) select id, 'X', 'adulto' from _ids where clave = 'hogarA'$q$, '42501');
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.falla('anon no puede leer hogares', 'select * from public.hogar', '42501');
select pg_temp.falla('anon no puede leer personas', 'select * from public.persona', '42501');
select pg_temp.falla('anon no puede crear hogares', $q$select public.crear_hogar('Anon')$q$, '42501');
select pg_temp.fin();

-- 5. Invitaciones -------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
create temp table _codigos (clave text primary key, codigo text);
grant all on _codigos to authenticated;
insert into _codigos values ('valido', public.crear_invitacion((select id from _ids where clave = 'hogarA')));
select pg_temp.igual('El código en claro no se guarda en la base de datos',
  pg_temp.cuenta($q$select 1 from public.invitacion i join _codigos c on c.codigo = i.codigo_hash$q$), 0);
select pg_temp.igual('El admin A ve sus invitaciones y solo las suyas', pg_temp.cuenta('select 1 from public.invitacion'), 1);
select pg_temp.falla('Un rol de invitación inválido se rechaza',
  $q$select public.crear_invitacion((select id from _ids where clave = 'hogarA'), 'dios')$q$, '23514');
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select pg_temp.falla('Un código inventado no sirve', $q$select public.unirse_a_hogar('NOEXISTE00')$q$, 'P0002');
select pg_temp.igual('Quien no es admin no ve invitaciones', pg_temp.cuenta('select 1 from public.invitacion'), 0);
select pg_temp.igual('Aún sin unirse, C no ve el hogar A', pg_temp.cuenta('select 1 from public.hogar'), 0);
select pg_temp.fin();

-- Invitación caducada (creada como superusuario con una caducidad pasada).
insert into public.invitacion (hogar_id, codigo_hash, creada_por, caduca_en)
select id, encode(extensions.digest('CADUCADA01', 'sha256'), 'hex'), 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'
from _ids where clave = 'hogarA';

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select pg_temp.falla('Una invitación caducada no sirve', $q$select public.unirse_a_hogar('CADUCADA01')$q$, 'P0002');

-- C canjea el código válido y pasa a ser miembro (no admin) del hogar A.
select pg_temp.igual('C se une al hogar A con el código',
  (select count(*) from (select public.unirse_a_hogar((select codigo from _codigos where clave = 'valido'))) t), 1);
select pg_temp.igual('C ya ve el hogar A', pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar A'$q$), 1);
select pg_temp.igual('C ve las personas del hogar A', pg_temp.cuenta($q$select 1 from public.persona where nombre = 'Diego'$q$), 1);
select pg_temp.igual('C sigue sin ver el hogar B', pg_temp.cuenta($q$select 1 from public.hogar where nombre = 'Hogar B'$q$), 0);
select pg_temp.igual('C ve a los dos miembros de su hogar', pg_temp.cuenta('select 1 from public.miembro'), 2);
select pg_temp.falla('El código no se puede reutilizar',
  $q$select public.unirse_a_hogar((select codigo from _codigos where clave = 'valido'))$q$, 'P0002');
select pg_temp.fin();

-- 6. Un miembro (no admin) puede trabajar, pero no administrar ----------------
select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
insert into public.persona (hogar_id, nombre, tipo, factor_racion)
  select id, 'Ana', 'adulto', 1 from _ids where clave = 'hogarA';
select pg_temp.igual('Un miembro puede crear personas en su hogar', pg_temp.cuenta($q$select 1 from public.persona where nombre = 'Ana'$q$), 1);
select pg_temp.falla('Un miembro no puede invitar',
  $q$select public.crear_invitacion((select id from _ids where clave = 'hogarA'))$q$, '42501');
do $$ declare n bigint; begin
  update public.hogar set nombre = 'Renombrado' where nombre = 'Hogar A'; get diagnostics n = row_count;
  perform pg_temp.igual('Un miembro no puede renombrar el hogar', n, 0);
  delete from public.miembro where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.igual('Un miembro no puede expulsar al admin', n, 0);
  update public.miembro set rol = 'admin' where user_id = 'cccccccc-0000-0000-0000-000000000003'; get diagnostics n = row_count;
  perform pg_temp.igual('Un miembro no puede ascenderse a admin', n, 0);
end $$;
select pg_temp.fin();

-- 7. El admin puede expulsar y el expulsado pierde el acceso ------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-000000000001');
delete from public.miembro where user_id = 'cccccccc-0000-0000-0000-000000000003';
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-000000000003');
select pg_temp.igual('Tras ser expulsado, C ya no ve el hogar A', pg_temp.cuenta('select 1 from public.hogar'), 0);
select pg_temp.igual('Tras ser expulsado, C ya no ve las personas', pg_temp.cuenta('select 1 from public.persona'), 0);
select pg_temp.fin();

rollback;
\echo 'TODOS LOS TESTS DE RLS PASAN'
