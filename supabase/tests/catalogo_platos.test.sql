-- Tests del catálogo: platos privados del hogar, biblioteca comunitaria y moderación.
-- Se comprueba sobre todo: (1) nadie ve qué hogar envió un plato, (2) lo pendiente no se filtra,
-- (3) solo el administrador modera, (4) los privilegios por columna impiden falsear el origen.
\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Este test prueba los mecanismos del catálogo partiendo de uno vacío: se quita lo sembrado por
-- la migración de catálogos de fábrica (la transacción lo deshace al terminar).
delete from public.plato_compartido;
delete from public.ingrediente;

-- P es el administrador de la plataforma; A y B, dueños de hogares; C, de otro hogar; Z, sin hogar.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'p@ejemplo.test'),
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@ejemplo.test'),
  ('22222222-0000-0000-0000-0000000000a2', 'a2@ejemplo.test');
-- El alta del administrador se hace por SQL (panel), nunca desde la API.
insert into public.administrador_plataforma (user_id) values ('00000000-0000-0000-0000-0000000000a0');

create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
insert into _ids values ('HC', public.crear_hogar('Hogar C'));
select pg_temp.fin();

-- 1. Administrador de la plataforma: invisible desde la API --------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Nadie lee la tabla de administradores', 'select * from public.administrador_plataforma', '42501');
select pg_temp.falla('Nadie se da de alta como administrador',
  $q$insert into public.administrador_plataforma (user_id) values ('aaaaaaaa-0000-0000-0000-00000000000a')$q$, '42501');
select pg_temp.falla('Quien no es administrador no abre la bandeja de revisión', 'select * from public.bandeja_revision()', '42501');
select pg_temp.fin();

-- 2. Ingredientes: normalización, creación por función y límite diario --------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('tomate', public.crear_ingrediente('Tomate', 'g', 'fruta_verdura'));
insert into _ids values ('huevo',  public.crear_ingrediente('Huevo', 'ud', 'huevos'));
insert into _ids values ('pollo',  public.crear_ingrediente('Pechuga de pollo', 'g', 'carne'));
select pg_temp.igual('Mayúsculas y espacios no crean un duplicado',
  (public.crear_ingrediente('  TOMATE ', 'g') = (select id from _ids where clave = 'tomate'))::int, 1);
select pg_temp.igual('Las tildes tampoco ("tomaté" es "tomate")',
  (public.crear_ingrediente('tomaté', 'g') = (select id from _ids where clave = 'tomate'))::int, 1);
select pg_temp.falla('Una unidad inválida se rechaza', $q$select public.crear_ingrediente('Sal fina', 'cucharadas')$q$, '23514');
select pg_temp.falla('No se crean ingredientes por INSERT directo',
  $q$insert into public.ingrediente (nombre, unidad) values ('Directo', 'g')$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B ve el catálogo global de ingredientes', pg_temp.cuenta('select 1 from public.ingrediente'), 3);
do $$ declare n bigint; begin
  update public.ingrediente set verificado = true; get diagnostics n = row_count;
  perform pg_temp.igual('Un usuario no puede verificar ingredientes', n, 0);
  delete from public.ingrediente; get diagnostics n = row_count;
  perform pg_temp.igual('Un usuario no puede borrar ingredientes', n, 0);
end $$;
select pg_temp.fin();

insert into public.ingrediente (nombre, unidad, creado_por)
  select 'Relleno ' || g, 'g', 'cccccccc-0000-0000-0000-00000000000c' from generate_series(1, 50) g;
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.falla('Máximo 50 ingredientes nuevos por usuario y día', $q$select public.crear_ingrediente('Uno más', 'g')$q$, '54000');
select pg_temp.igual('...pero uno ya existente se devuelve sin consumir cupo',
  (public.crear_ingrediente('Huevo', 'ud') = (select id from _ids where clave = 'huevo'))::int, 1);
select pg_temp.fin();

-- 3. Platos del hogar: privados y consistentes ----------------------------------------------------
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
with p as (
  insert into public.plato (hogar_id, nombre, rol) select id, 'Plato de C', 'principal' from _ids where clave = 'HC' returning id)
insert into _ids select 'platoC', id from p;
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
with p as (
  insert into public.plato (hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, pasos)
  select id, 'Tortilla francesa', 'principal', 'huevo', 5, 8,
         'Bate los huevos con sal y cuájalos en una sartén caliente con un poco de aceite.'
  from _ids where clave = 'HA' returning id)
insert into _ids select 'platoA', id from p;
insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion)
  select h.id, p.id, i.id, 2 from _ids h, _ids p, _ids i
  where h.clave = 'HA' and p.clave = 'platoA' and i.clave = 'huevo';
select pg_temp.igual('A ve su plato', pg_temp.cuenta('select 1 from public.plato'), 1);
select pg_temp.falla('A no puede marcar un plato como adoptado a mano (origen)',
  $q$insert into public.plato (hogar_id, nombre, rol, origen) select id, 'Falso', 'principal', 'compartido' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('A no puede cambiar el origen de un plato',
  $q$update public.plato set origen = 'semilla'$q$, '42501');
select pg_temp.falla('Un grupo alimenticio inválido se rechaza',
  $q$insert into public.plato (hogar_id, nombre, rol, grupo) select id, 'Dulce', 'principal', 'dulce' from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('El tiempo activo no puede superar al total',
  $q$insert into public.plato (hogar_id, nombre, rol, tiempo_activo_min, tiempo_total_min) select id, 'Raro', 'principal', 30, 10 from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('A no puede crear platos en el hogar B',
  $q$insert into public.plato (hogar_id, nombre, rol) select id, 'Intruso', 'principal' from _ids where clave = 'HB'$q$, '42501');
select pg_temp.falla('A no puede mover su plato al hogar B (hogar_id no es modificable)',
  $q$update public.plato set hogar_id = (select id from _ids where clave = 'HB')$q$, '42501');
select pg_temp.falla('A no puede escribir ingredientes en un plato del hogar B (RLS)',
  $q$insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion)
     select h.id, p.id, i.id, 1 from _ids h, _ids p, _ids i where h.clave = 'HB' and p.clave = 'platoA' and i.clave = 'tomate'$q$, '42501');
select pg_temp.falla('A no puede enlazar su hogar con un plato de otro hogar (FK compuesta con hogar_id)',
  $q$insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion)
     select h.id, p.id, i.id, 1 from _ids h, _ids p, _ids i where h.clave = 'HA' and p.clave = 'platoC' and i.clave = 'tomate'$q$, '23503');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve los platos de A', pg_temp.cuenta('select 1 from public.plato'), 0);
select pg_temp.igual('B no ve los ingredientes de plato de A', pg_temp.cuenta('select 1 from public.plato_ingrediente'), 0);
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.falla('anon no lee platos', 'select * from public.plato', '42501');
select pg_temp.falla('anon no lee la biblioteca', 'select * from public.plato_compartido', '42501');
select pg_temp.fin();

-- 4. Enviar a la biblioteca ------------------------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('B no puede enviar el plato de A',
  $q$select public.enviar_plato_a_catalogo((select id from _ids where clave = 'platoA'))$q$, '42501');
select pg_temp.falla('Un plato inexistente da el mismo error (no revela qué existe)',
  $q$select public.enviar_plato_a_catalogo(gen_random_uuid())$q$, '42501');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
-- Un plato incompleto no se puede enviar.
with p as (
  insert into public.plato (hogar_id, nombre, rol)
  select id, 'Plato incompleto', 'principal' from _ids where clave = 'HA' returning id)
insert into _ids select 'incompleto', id from p;
select pg_temp.falla('Sin grupo ni tiempo no se puede enviar',
  $q$select public.enviar_plato_a_catalogo((select id from _ids where clave = 'incompleto'))$q$, '22023');
update public.plato set grupo = 'verdura', tiempo_total_min = 10 where nombre = 'Plato incompleto';
select pg_temp.falla('Sin ingredientes no se puede enviar',
  $q$select public.enviar_plato_a_catalogo((select id from _ids where clave = 'incompleto'))$q$, '22023');

insert into _ids values ('cA', public.enviar_plato_a_catalogo((select id from _ids where clave = 'platoA'), 'Familia Rápida'));
select pg_temp.falla('El mismo plato no se envía dos veces',
  $q$select public.enviar_plato_a_catalogo((select id from _ids where clave = 'platoA'))$q$, '23505');
select pg_temp.igual('A ve su plato enviado, pendiente', pg_temp.cuenta($q$select 1 from public.plato_compartido where estado = 'pendiente'$q$), 1);
select pg_temp.igual('A ve sus ingredientes enviados', pg_temp.cuenta('select 1 from public.plato_compartido_ingrediente'), 1);
select pg_temp.igual('A ve su propia autoría', pg_temp.cuenta('select 1 from public.plato_compartido_autor'), 1);
select pg_temp.falla('No se escribe en la biblioteca por INSERT directo',
  $q$insert into public.plato_compartido (nombre, rol, grupo, tiempo_total_min, estado) values ('Directo', 'principal', 'huevo', 5, 'publicado')$q$, '42501');
select pg_temp.falla('No se publica un plato a mano (UPDATE directo)',
  $q$update public.plato_compartido set estado = 'publicado'$q$, '42501');
select pg_temp.fin();

-- 5. Lo pendiente no se filtra --------------------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve un plato pendiente de otro hogar', pg_temp.cuenta('select 1 from public.plato_compartido'), 0);
select pg_temp.igual('B no ve sus ingredientes', pg_temp.cuenta('select 1 from public.plato_compartido_ingrediente'), 0);
select pg_temp.igual('B no ve ninguna autoría', pg_temp.cuenta('select 1 from public.plato_compartido_autor'), 0);
select pg_temp.falla('B no puede adoptar un plato pendiente',
  $q$select public.adoptar_plato_compartido((select id from _ids where clave = 'HB'), (select id from _ids where clave = 'cA'))$q$, 'P0002');
select pg_temp.falla('B no puede revisar platos', $q$select public.revisar_plato_compartido((select id from _ids where clave = 'cA'), 'publicar')$q$, '42501');
select pg_temp.fin();

-- 6. Bandeja de revisión: de un vistazo ----------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a0');
select pg_temp.igual('El administrador ve el plato pendiente', pg_temp.cuenta('select 1 from public.bandeja_revision()'), 1);
select pg_temp.igual('...con aviso de ingrediente nuevo (aún sin verificar)',
  pg_temp.cuenta($q$select 1 from public.bandeja_revision() where 'ingrediente_nuevo' = any(avisos)$q$), 1);
select pg_temp.igual('...y sin avisos de pasos ni de tiempo (el plato es correcto)',
  pg_temp.cuenta($q$select 1 from public.bandeja_revision() where not ('sin_pasos' = any(avisos)) and not ('tiempo_alto' = any(avisos))$q$), 1);
select pg_temp.igual('La bandeja incluye los ingredientes con cantidad y unidad',
  pg_temp.cuenta($q$select 1 from public.bandeja_revision() where ingredientes @> '[{"nombre": "Huevo", "cantidad": 2.00, "unidad": "ud"}]'$q$), 1);
select pg_temp.igual('El administrador ve la autoría (para poder contactar o moderar)', pg_temp.cuenta('select 1 from public.plato_compartido_autor'), 1);
select pg_temp.fin();

-- Plato con problemas: sin pasos, largo, con enlace.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
with p as (
  insert into public.plato (hogar_id, nombre, rol, grupo, tiempo_total_min, pasos)
  select id, 'Receta de una web', 'principal', 'carne', 90, 'Mira la receta en https://ejemplo.com/receta'
  from _ids where clave = 'HA' returning id)
insert into _ids select 'platoMalo', id from p;
insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion)
  select h.id, p.id, i.id, 150 from _ids h, _ids p, _ids i where h.clave = 'HA' and p.clave = 'platoMalo' and i.clave = 'pollo';
insert into _ids values ('cMalo', public.enviar_plato_a_catalogo((select id from _ids where clave = 'platoMalo')));
select pg_temp.fin();

select pg_temp.como('00000000-0000-0000-0000-0000000000a0');
select pg_temp.igual('Avisos del plato problemático: pasos, tiempo y enlace',
  pg_temp.cuenta($q$select 1 from public.bandeja_revision() where nombre = 'Receta de una web'
                    and avisos @> array['tiempo_alto', 'enlace_en_texto']$q$), 1);

-- 7. Revisar: un toque ---------------------------------------------------------------------------
select pg_temp.falla('Rechazar exige un motivo',
  $q$select public.revisar_plato_compartido((select id from _ids where clave = 'cMalo'), 'rechazar')$q$, '22023');
select pg_temp.falla('Una decisión desconocida se rechaza',
  $q$select public.revisar_plato_compartido((select id from _ids where clave = 'cMalo'), 'borrar')$q$, '22023');
select public.revisar_plato_compartido((select id from _ids where clave = 'cMalo'), 'rechazar', 'Copiado de una web: escríbela con tus palabras');
select public.revisar_plato_compartido((select id from _ids where clave = 'cA'), 'publicar');
select pg_temp.falla('No se publica dos veces',
  $q$select public.revisar_plato_compartido((select id from _ids where clave = 'cA'), 'publicar')$q$, 'P0002');
select pg_temp.igual('Publicar verifica sus ingredientes',
  pg_temp.cuenta($q$select 1 from public.ingrediente where nombre = 'Huevo' and verificado$q$), 1);
select pg_temp.igual('La bandeja queda vacía', pg_temp.cuenta('select 1 from public.bandeja_revision()'), 0);
select pg_temp.fin();

-- 8. Tras publicar: lo ven todas las familias, pero no quién lo envió ----------------------------
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('C ve el plato publicado', pg_temp.cuenta($q$select 1 from public.plato_compartido where estado = 'publicado'$q$), 1);
select pg_temp.igual('C ve sus ingredientes', pg_temp.cuenta('select 1 from public.plato_compartido_ingrediente'), 1);
select pg_temp.igual('C NO ve quién lo envió', pg_temp.cuenta('select 1 from public.plato_compartido_autor'), 0);
select pg_temp.igual('C no ve el plato rechazado de otro hogar', pg_temp.cuenta($q$select 1 from public.plato_compartido where estado = 'rechazado'$q$), 0);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('A ve el motivo del rechazo de su plato',
  pg_temp.cuenta($q$select 1 from public.plato_compartido where estado = 'rechazado' and motivo_rechazo like 'Copiado%'$q$), 1);
select pg_temp.fin();

-- 9. Adoptar ---------------------------------------------------------------------------------------
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('B no puede adoptar en el hogar C',
  $q$select public.adoptar_plato_compartido((select id from _ids where clave = 'HC'), (select id from _ids where clave = 'cA'))$q$, '42501');
select pg_temp.falla('B no puede adoptar un plato rechazado',
  $q$select public.adoptar_plato_compartido((select id from _ids where clave = 'HB'), (select id from _ids where clave = 'cMalo'))$q$, 'P0002');
insert into _ids values ('adoptado', public.adoptar_plato_compartido((select id from _ids where clave = 'HB'), (select id from _ids where clave = 'cA')));
select pg_temp.igual('B tiene ahora su copia, marcada como compartida',
  pg_temp.cuenta($q$select 1 from public.plato where origen = 'compartido' and nombre = 'Tortilla francesa'$q$), 1);
select pg_temp.igual('...con sus ingredientes', pg_temp.cuenta('select 1 from public.plato_ingrediente'), 1);
select pg_temp.igual('Adoptar de nuevo es idempotente (devuelve la misma copia)',
  (public.adoptar_plato_compartido((select id from _ids where clave = 'HB'), (select id from _ids where clave = 'cA'))
    = (select id from _ids where clave = 'adoptado'))::int, 1);
select pg_temp.igual('...y no duplica el plato', pg_temp.cuenta('select 1 from public.plato'), 1);
select pg_temp.falla('Un plato adoptado no puede volver a enviarse',
  $q$select public.enviar_plato_a_catalogo((select id from _ids where clave = 'adoptado'))$q$, '22023');
-- La copia es suya y la puede adaptar sin afectar a los demás.
update public.plato set nombre = 'Tortilla francesa con queso' where origen = 'compartido';
select pg_temp.fin();

select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('La adaptación de B no cambia el plato compartido que ve C',
  pg_temp.cuenta($q$select 1 from public.plato_compartido where nombre = 'Tortilla francesa'$q$), 1);
select pg_temp.fin();

select pg_temp.igual('El contador de adopciones refleja una adopción', pg_temp.cuenta('select 1 from public.plato_compartido where adopciones = 1'), 1);

-- 10. Retirar: deja de verse, pero las copias de los hogares se conservan -----------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a0');
select public.revisar_plato_compartido((select id from _ids where clave = 'cA'), 'retirar');
select pg_temp.fin();
select pg_temp.como('cccccccc-0000-0000-0000-00000000000c');
select pg_temp.igual('Retirado: C ya no lo ve', pg_temp.cuenta('select 1 from public.plato_compartido'), 0);
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('...pero la copia de B se conserva', pg_temp.cuenta('select 1 from public.plato'), 1);
select pg_temp.fin();

-- 11. Privacidad de la autoría al borrar el hogar ---------------------------------------------------
delete from public.hogar where nombre = 'Hogar A';
select pg_temp.igual('Si el hogar autor se borra, el plato retirado permanece sin autoría',
  pg_temp.cuenta($q$select 1 from public.plato_compartido_autor where hogar_id is null$q$), 2);
select pg_temp.igual('El plato rechazado y el retirado siguen existiendo',
  pg_temp.cuenta('select 1 from public.plato_compartido'), 2);

rollback;
\echo 'TODOS LOS TESTS DEL CATALOGO PASAN'
