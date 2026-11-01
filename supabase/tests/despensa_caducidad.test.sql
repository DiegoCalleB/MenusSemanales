-- Caducidad coherente con el registro de movimientos: defecto encontrado por las pruebas de propiedades.
\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

create function pg_temp.mov(p_ing text, p_ubi text, p_delta numeric, p_restaurar text default null) returns jsonb language sql as $$
  select jsonb_build_object('ingrediente_id', (select id from _ids where clave = p_ing), 'ubicacion', p_ubi, 'delta', p_delta)
         || case when p_restaurar is null then '{}'::jsonb else jsonb_build_object('restaurar_caducidad', p_restaurar) end
$$;
create function pg_temp.stock(p_ing text, p_ubi text) returns numeric language sql as $$
  select coalesce((select cantidad from public.despensa_item
    where ingrediente_id = (select id from _ids where clave = p_ing) and ubicacion = p_ubi), -1)
$$;
create function pg_temp.fecha(p_ing text, p_ubi text) returns date language sql as $$
  select caduca_en from public.despensa_item
   where ingrediente_id = (select id from _ids where clave = p_ing) and ubicacion = p_ubi
$$;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _ids values ('leche', public.crear_ingrediente('Leche', 'ml', 'lacteos'));
select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'Leche vieja',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', 1000)));
select pg_temp.fin();
-- La caducidad de la leche ya pasó (se fija como superusuario: la API no permite editar la cantidad, sí la fecha).
update public.despensa_item set caduca_en = current_date - 2;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');

-- 3. No se mezcla stock nuevo con stock caducado.
select pg_temp.falla('Añadir stock a una fila con stock caducado se rechaza (hay que tirar lo caducado)',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'Leche nueva',
       jsonb_build_array(pg_temp.mov('leche', 'nevera', 1000)))$q$, '23514');
select pg_temp.igual('...y el stock queda intacto', pg_temp.stock('leche', 'nevera')::bigint, 1000);

-- Tirar lo caducado y comprar nuevo, en una sola operación.
insert into _ids select 'opCambio', public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'ajuste', 'Tirar lo caducado y comprar',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', -1000), pg_temp.mov('leche', 'nevera', 500)));
select pg_temp.igual('Tras tirar lo caducado y comprar, solo hay lo nuevo', pg_temp.stock('leche', 'nevera')::bigint, 500);
-- 1. y el lote nuevo NO hereda la caducidad vieja.
select pg_temp.igual('El lote nuevo no hereda la caducidad vencida', (pg_temp.fecha('leche', 'nevera') is null)::int, 1);

-- 2. Deshacer es exacto también en las fechas: vuelve el stock caducado CON su caducidad.
select public.deshacer_operacion_despensa((select id from _ids where clave = 'opCambio'));
select pg_temp.igual('Deshacer devuelve el stock caducado', pg_temp.stock('leche', 'nevera')::bigint, 1000);
select pg_temp.igual('...con su caducidad original (no resucita como fresco)',
  (pg_temp.fecha('leche', 'nevera') = current_date - 2)::int, 1);

-- 1. Una fila que llega a 0 pierde su caducidad.
select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'ajuste', 'Tirar',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', -1000)));
select pg_temp.igual('Una fila agotada pierde su caducidad', (pg_temp.fecha('leche', 'nevera') is null)::int, 1);
select pg_temp.igual('Y se puede comprar de nuevo sin problema',
  (public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'Leche',
     jsonb_build_array(pg_temp.mov('leche', 'nevera', 250))) is not null)::int, 1);
select pg_temp.fin();

rollback;
\echo 'TODOS LOS TESTS DE CADUCIDAD PASAN'
