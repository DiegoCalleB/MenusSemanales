\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Las pruebas parten de los privilegios por defecto de Supabase (ver 00_shim_auth.sql), así que
-- estas comprobaciones fallarían si una tabla conservara privilegios de más (D-064).
select pg_temp.igual('anon no tiene ningún privilegio en ninguna tabla de public',
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'), 0);
select pg_temp.igual('authenticated no tiene TRUNCATE, TRIGGER ni REFERENCES en ninguna tabla',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')), 0);
select pg_temp.igual('authenticated no tiene privilegios sobre secuencias',
  (select count(*) from information_schema.usage_privileges
    where object_schema = 'public' and grantee in ('anon', 'authenticated') and object_type = 'SEQUENCE'), 0);

-- Tablas que solo se escriben por funciones: ni INSERT ni UPDATE ni DELETE directos.
select pg_temp.igual('hogar_estado: solo lectura directa',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and table_name = 'hogar_estado'
      and privilege_type <> 'SELECT'), 0);
select pg_temp.igual('despensa_operacion y despensa_movimiento: solo lectura',
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and table_name in ('despensa_operacion', 'despensa_movimiento', 'plato_compartido', 'invitacion')
      and privilege_type <> 'SELECT'), 0);

-- Restricciones por columna que deben cumplirse de verdad.
select pg_temp.igual('La cantidad de la despensa no se puede cambiar a mano',
  has_column_privilege('authenticated', 'public.despensa_item', 'cantidad', 'UPDATE')::int, 0);
select pg_temp.igual('...pero el mínimo y la caducidad sí',
  (has_column_privilege('authenticated', 'public.despensa_item', 'minimo', 'UPDATE')
   and has_column_privilege('authenticated', 'public.despensa_item', 'caduca_en', 'UPDATE'))::int, 1);
select pg_temp.igual('El origen de un plato no se puede fijar a mano',
  (has_column_privilege('authenticated', 'public.plato', 'origen', 'INSERT')
   or has_column_privilege('authenticated', 'public.plato', 'origen', 'UPDATE'))::int, 0);
select pg_temp.igual('El origen de un artículo de la compra no se puede fijar a mano',
  (has_column_privilege('authenticated', 'public.lista_compra_articulo', 'origen', 'INSERT')
   or has_column_privilege('authenticated', 'public.lista_compra_articulo', 'origen', 'UPDATE'))::int, 0);
select pg_temp.igual('Nadie inserta hogares ni miembros directamente (solo por función)',
  (has_table_privilege('authenticated', 'public.hogar', 'INSERT')
   or has_table_privilege('authenticated', 'public.miembro', 'INSERT'))::int, 0);

-- Funciones: anon no ejecuta ninguna función propia de public, salvo las que el servidor llama
-- con la clave pública y el token secreto del calendario: el resumen del calendario suscrito
-- (D-083) y las dos del aviso diario por notificación push (D-115).
select pg_temp.igual('anon solo puede ejecutar las funciones con token del calendario',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in ('estado_para_calendario', 'suscripciones_para_avisos', 'olvidar_suscripcion_push')), 0);
select pg_temp.igual('anon sí puede ejecutar estado_para_calendario (y nada más del calendario)',
  (has_function_privilege('anon', 'public.estado_para_calendario(text)', 'EXECUTE')
   and not has_function_privilege('anon', 'public.enlace_calendario(uuid, boolean)', 'EXECUTE'))::int, 1);

rollback;
\echo 'privilegios: OK'
