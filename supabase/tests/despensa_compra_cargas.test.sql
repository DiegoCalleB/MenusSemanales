-- Tests de despensa, lista de la compra y cargas (reparto de la carga mental).
-- Invariantes que se comprueban: el stock nunca es negativo; todo cambio de stock deja movimientos
-- y el stock es siempre su suma; deshacer devuelve exactamente lo descontado; nada cruza hogares.
\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');

create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;

-- Construye un movimiento y consulta el stock (utilidades de este test).
create function pg_temp.mov(p_ing text, p_ubi text, p_delta numeric) returns jsonb language sql as $$
  select jsonb_build_object('ingrediente_id', (select id from _ids where clave = p_ing),
                            'ubicacion', p_ubi, 'delta', p_delta)
$$;
create function pg_temp.stock(p_ing text, p_ubi text) returns numeric language sql as $$
  select coalesce((select cantidad from public.despensa_item
                   where ingrediente_id = (select id from _ids where clave = p_ing) and ubicacion = p_ubi), -1)
$$;

-- Datos de partida ------------------------------------------------------------------------------
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
insert into _ids values ('pasta',  public.crear_ingrediente('Pasta', 'g', 'despensa'));
insert into _ids values ('tomate', public.crear_ingrediente('Tomate', 'g', 'fruta_verdura'));
insert into _ids values ('leche',  public.crear_ingrediente('Leche', 'ml', 'lacteos'));
insert into _ids values ('huevo',  public.crear_ingrediente('Huevo', 'ud', 'huevos'));
insert into _ids values ('arroz',  public.crear_ingrediente('Arroz', 'g', 'despensa'));
select pg_temp.fin();
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
insert into _ids values ('HB', public.crear_hogar('Hogar B'));
select pg_temp.fin();

-- ===== 1. DESPENSA ====================================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids select 'op1', public.aplicar_operacion_despensa(
  (select id from _ids where clave = 'HA'), 'compra', 'Compra de prueba',
  jsonb_build_array(pg_temp.mov('pasta', 'despensa', 500), pg_temp.mov('tomate', 'nevera', 300)));
select pg_temp.igual('Comprar mete la pasta en la despensa', pg_temp.stock('pasta', 'despensa')::bigint, 500);
select pg_temp.igual('...y el tomate en la nevera', pg_temp.stock('tomate', 'nevera')::bigint, 300);

insert into _ids select 'op2', public.aplicar_operacion_despensa(
  (select id from _ids where clave = 'HA'), 'cocinar', 'Cena de prueba',
  jsonb_build_array(pg_temp.mov('pasta', 'despensa', -200), pg_temp.mov('tomate', 'nevera', -100)));
select pg_temp.igual('Cocinar descuenta la pasta', pg_temp.stock('pasta', 'despensa')::bigint, 300);
select pg_temp.igual('...y el tomate', pg_temp.stock('tomate', 'nevera')::bigint, 200);

-- Atomicidad: si un movimiento falla, no se aplica NINGUNO.
select pg_temp.falla('Sin stock suficiente no se descuenta (y nada queda a medias)',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'cocinar', 'Imposible',
       jsonb_build_array(pg_temp.mov('tomate', 'nevera', -50), pg_temp.mov('pasta', 'despensa', -400)))$q$, '23514');
select pg_temp.igual('El tomate del movimiento anterior no se tocó', pg_temp.stock('tomate', 'nevera')::bigint, 200);
select pg_temp.igual('No quedó ninguna operación a medias', pg_temp.cuenta('select 1 from public.despensa_operacion'), 2);
select pg_temp.falla('No se descuenta de una ubicación donde no hay stock',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'cocinar', 'x',
       jsonb_build_array(pg_temp.mov('pasta', 'congelador', -1)))$q$, '23514');

-- Validación de entrada.
select pg_temp.falla('Una ubicación inválida se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', jsonb_build_array(pg_temp.mov('pasta', 'garaje', 1)))$q$, '22023');
select pg_temp.falla('Un movimiento de cantidad cero se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', jsonb_build_array(pg_temp.mov('pasta', 'despensa', 0)))$q$, '22023');
select pg_temp.falla('Una lista vacía de movimientos se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', '[]'::jsonb)$q$, '22023');
select pg_temp.falla('Movimientos que no son una lista se rechazan',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', '{"a": 1}'::jsonb)$q$, '22023');
select pg_temp.falla('Un identificador de ingrediente mal formado se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', '[{"ingrediente_id": "no-es-uuid", "ubicacion": "despensa", "delta": 1}]'::jsonb)$q$, '22023');
select pg_temp.falla('Un tipo de operación inválido se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'robar', 'x', jsonb_build_array(pg_temp.mov('pasta', 'despensa', 1)))$q$, '22023');
select pg_temp.falla('Un ingrediente inexistente se rechaza',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x',
       jsonb_build_array(jsonb_build_object('ingrediente_id', gen_random_uuid(), 'ubicacion', 'despensa', 'delta', 1)))$q$, '23503');

-- Invariante: el stock de cada artículo es la suma de sus movimientos.
select pg_temp.igual('Invariante: el stock siempre es la suma de sus movimientos (antes de deshacer)',
  pg_temp.cuenta($q$select 1 from public.despensa_item i
    where i.cantidad <> coalesce((select sum(m.delta) from public.despensa_movimiento m
      where m.hogar_id = i.hogar_id and m.ingrediente_id = i.ingrediente_id and m.ubicacion = i.ubicacion), 0)$q$), 0);

-- Deshacer cocinar: devuelve exactamente lo descontado.
insert into _ids select 'undo2', public.deshacer_operacion_despensa((select id from _ids where clave = 'op2'));
select pg_temp.igual('Deshacer devuelve la pasta', pg_temp.stock('pasta', 'despensa')::bigint, 500);
select pg_temp.igual('...y el tomate', pg_temp.stock('tomate', 'nevera')::bigint, 300);
select pg_temp.falla('Una operación solo se deshace una vez',
  $q$select public.deshacer_operacion_despensa((select id from _ids where clave = 'op2'))$q$, '23505');
select pg_temp.falla('Una operación de deshacer no se puede deshacer',
  $q$select public.deshacer_operacion_despensa((select id from _ids where clave = 'undo2'))$q$, '22023');
select pg_temp.igual('Invariante: tras deshacer, el stock sigue siendo la suma de sus movimientos',
  pg_temp.cuenta($q$select 1 from public.despensa_item i
    where i.cantidad <> coalesce((select sum(m.delta) from public.despensa_movimiento m
      where m.hogar_id = i.hogar_id and m.ingrediente_id = i.ingrediente_id and m.ubicacion = i.ubicacion), 0)$q$), 0);

-- No se deshace una compra cuyo contenido ya se ha consumido.
insert into _ids select 'op3', public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'Leche',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', 1000)));
select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'cocinar', 'Bechamel',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', -800)));
select pg_temp.falla('No se puede deshacer una compra ya consumida',
  $q$select public.deshacer_operacion_despensa((select id from _ids where clave = 'op3'))$q$, '23514');
select pg_temp.igual('...y el stock queda intacto', pg_temp.stock('leche', 'nevera')::bigint, 200);
select pg_temp.igual('...y la operación no se marca como deshecha',
  pg_temp.cuenta($q$select 1 from public.despensa_operacion where descripcion = 'Leche' and deshecha_en is not null$q$), 0);

-- No se deshace tras 48 horas.
insert into _ids select 'op5', public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'Huevos',
  jsonb_build_array(pg_temp.mov('huevo', 'nevera', 6)));
select pg_temp.fin();
update public.despensa_operacion set creada_en = now() - interval '3 days' where descripcion = 'Huevos';
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.falla('Pasadas 48 horas ya no se puede deshacer',
  $q$select public.deshacer_operacion_despensa((select id from _ids where clave = 'op5'))$q$, '22023');

-- Cambios directos: la cantidad solo cambia con operaciones.
select pg_temp.falla('La cantidad no se edita a mano (se perdería el registro)',
  $q$update public.despensa_item set cantidad = 9999$q$, '42501');
select pg_temp.falla('No se crea stock por INSERT directo',
  $q$insert into public.despensa_item (hogar_id, ingrediente_id, ubicacion, cantidad) select h.id, i.id, 'despensa', 5 from _ids h, _ids i where h.clave = 'HA' and i.clave = 'arroz'$q$, '42501');
select pg_temp.falla('Las operaciones no se crean por INSERT directo',
  $q$insert into public.despensa_operacion (hogar_id, tipo) select id, 'ajuste' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('Los movimientos no se modifican', $q$update public.despensa_movimiento set delta = 1$q$, '42501');
select pg_temp.falla('Los movimientos no se borran', $q$delete from public.despensa_movimiento$q$, '42501');
do $$ declare n bigint; begin
  update public.despensa_item set minimo = 250, caduca_en = date '2026-12-31'
   where ingrediente_id = (select id from _ids where clave = 'pasta'); get diagnostics n = row_count;
  perform pg_temp.igual('El mínimo y la caducidad sí se editan', n, 1);
  delete from public.despensa_item where ingrediente_id = (select id from _ids where clave = 'pasta'); get diagnostics n = row_count;
  perform pg_temp.igual('No se borra un artículo con stock', n, 0);
end $$;
select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'cocinar', 'Se acaba',
  jsonb_build_array(pg_temp.mov('leche', 'nevera', -200)));
do $$ declare n bigint; begin
  delete from public.despensa_item where ingrediente_id = (select id from _ids where clave = 'leche'); get diagnostics n = row_count;
  perform pg_temp.igual('Sí se borra un artículo agotado', n, 1);
end $$;
select pg_temp.fin();

-- Aislamiento entre hogares.
select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve la despensa de A', pg_temp.cuenta('select 1 from public.despensa_item'), 0);
select pg_temp.igual('B no ve las operaciones de A', pg_temp.cuenta('select 1 from public.despensa_operacion'), 0);
select pg_temp.igual('B no ve los movimientos de A', pg_temp.cuenta('select 1 from public.despensa_movimiento'), 0);
select pg_temp.falla('B no puede aplicar operaciones en el hogar A',
  $q$select public.aplicar_operacion_despensa((select id from _ids where clave = 'HA'), 'compra', 'x', jsonb_build_array(pg_temp.mov('pasta', 'despensa', 1)))$q$, '42501');
select pg_temp.falla('B no puede deshacer operaciones del hogar A',
  $q$select public.deshacer_operacion_despensa((select id from _ids where clave = 'op1'))$q$, '42501');
do $$ declare n bigint; begin
  update public.despensa_item set minimo = 1; get diagnostics n = row_count;
  perform pg_temp.igual('B no puede editar la despensa de A', n, 0);
end $$;
select pg_temp.fin();
select pg_temp.como(null);
select pg_temp.falla('anon no lee la despensa', 'select * from public.despensa_item', '42501');
select pg_temp.falla('anon no aplica operaciones',
  $q$select public.aplicar_operacion_despensa(gen_random_uuid(), 'compra', 'x', '[]'::jsonb)$q$, '42501');
select pg_temp.fin();

-- ===== 2. LISTA DE LA COMPRA ==========================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.lista_compra_articulo (hogar_id, nombre, seccion)
  select id, 'Papel de cocina', 'limpieza' from _ids where clave = 'HA';
select pg_temp.igual('Un artículo libre se añade como manual',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'manual' and nombre = 'Papel de cocina'$q$), 1);
select pg_temp.falla('Nadie crea artículos "automáticos" a mano',
  $q$insert into public.lista_compra_articulo (hogar_id, nombre, origen) select id, 'Falso', 'auto' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('Nadie crea artículos ya comprados a mano',
  $q$insert into public.lista_compra_articulo (hogar_id, nombre, comprado) select id, 'Falso', true from _ids where clave = 'HA'$q$, '42501');
select pg_temp.falla('Una cantidad cero se rechaza',
  $q$insert into public.lista_compra_articulo (hogar_id, nombre, cantidad) select id, 'Cero', 0 from _ids where clave = 'HA'$q$, '23514');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('B no puede añadir artículos a la lista de A',
  $q$insert into public.lista_compra_articulo (hogar_id, nombre) select id, 'Intruso' from _ids where clave = 'HA'$q$, '42501');
select pg_temp.igual('B no ve la lista de A', pg_temp.cuenta('select 1 from public.lista_compra_articulo'), 0);
select pg_temp.falla('B no puede sincronizar la lista de A',
  $q$select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'), '[]'::jsonb)$q$, '42501');
select pg_temp.fin();

-- Sincronización de los automáticos.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Sincronizar crea los automáticos y devuelve cuántos hay',
  public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
    jsonb_build_array(
      jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'pasta'), 'cantidad', 400, 'motivo', 'Cena del martes'),
      jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'huevo'), 'cantidad', 6, 'motivo', 'Stock mínimo'))), 2);
select pg_temp.igual('Los automáticos toman nombre y sección del ingrediente',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'auto' and nombre = 'Pasta' and seccion = 'despensa' and motivo = 'Cena del martes'$q$), 1);
select pg_temp.igual('Re-sincronizar actualiza la cantidad, elimina lo que ya no hace falta y no duplica',
  public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
    jsonb_build_array(jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'pasta'), 'cantidad', 500, 'motivo', 'Cena del martes'))), 1);
select pg_temp.igual('...con la cantidad nueva', pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'auto' and cantidad = 500$q$), 1);
select pg_temp.igual('...y el artículo manual ni se toca', pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'manual'$q$), 1);
select pg_temp.falla('Una lista de artículos que no es una lista se rechaza',
  $q$select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'), '{"a": 1}'::jsonb)$q$, '22023');
select pg_temp.falla('Un identificador mal formado se rechaza',
  $q$select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'), '[{"ingrediente_id": "x", "cantidad": 1}]'::jsonb)$q$, '22023');
select pg_temp.falla('Una cantidad cero se rechaza',
  $q$select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
     jsonb_build_array(jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'pasta'), 'cantidad', 0)))$q$, '23514');

-- Los automáticos no se tocan a mano.
do $$ declare n bigint; begin
  update public.lista_compra_articulo set comprado = true where origen = 'auto'; get diagnostics n = row_count;
  perform pg_temp.igual('Un artículo automático no se marca a mano (solo con marcar_comprado)', n, 0);
  delete from public.lista_compra_articulo where origen = 'auto'; get diagnostics n = row_count;
  perform pg_temp.igual('Un artículo automático no se borra a mano', n, 0);
  update public.lista_compra_articulo set comprado = true where origen = 'manual'; get diagnostics n = row_count;
  perform pg_temp.igual('Un artículo manual sí se marca', n, 1);
end $$;
select pg_temp.igual('Marcarlo registra quién y cuándo (disparador)',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'manual' and comprado and comprado_en is not null and comprado_por = 'aaaaaaaa-0000-0000-0000-00000000000a'$q$), 1);
do $$ declare n bigint; begin
  update public.lista_compra_articulo set comprado = false where origen = 'manual'; get diagnostics n = row_count;
  perform pg_temp.igual('Desmarcarlo limpia quién y cuándo',
    pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where origen = 'manual' and not comprado and comprado_en is null and comprado_por is null$q$), 1);
end $$;

-- Escenario simple: comprar y deshacer deja el artículo pendiente otra vez.
select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
  jsonb_build_array(jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'tomate'), 'cantidad', 100, 'motivo', 'Ensalada')));
insert into _ids select 'artTomate', id from public.lista_compra_articulo where nombre = 'Tomate';
insert into _ids select 'opTomate', public.marcar_comprado((select id from _ids where clave = 'artTomate'), 'nevera');
select pg_temp.igual('Comprar tomate lo suma a la nevera', pg_temp.stock('tomate', 'nevera')::bigint, 400);
select public.deshacer_operacion_despensa((select id from _ids where clave = 'opTomate'));
select pg_temp.igual('Deshacer lo resta', pg_temp.stock('tomate', 'nevera')::bigint, 300);
select pg_temp.igual('...y el artículo vuelve a estar pendiente',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where nombre = 'Tomate' and not comprado and comprado_en is null$q$), 1);

-- Escenario con conflicto: se compra, la lista se recalcula y vuelve a pedirlo, y luego se deshace.
select public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
  jsonb_build_array(jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'arroz'), 'cantidad', 300, 'motivo', 'Cena del jueves')));
insert into _ids select 'artArroz', id from public.lista_compra_articulo where nombre = 'Arroz';
insert into _ids select 'opArroz', public.marcar_comprado((select id from _ids where clave = 'artArroz'), 'despensa');
select pg_temp.igual('Marcar comprado mete el arroz en la despensa', pg_temp.stock('arroz', 'despensa')::bigint, 300);
select pg_temp.igual('...y marca el artículo con quién lo compró',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where nombre = 'Arroz' and comprado and comprado_por is not null$q$), 1);
select pg_temp.falla('No se compra dos veces el mismo artículo',
  $q$select public.marcar_comprado((select id from _ids where clave = 'artArroz'))$q$, '23505');
select pg_temp.igual('Lo comprado no se pierde al re-sincronizar, y lo pendiente sigue siendo único',
  public.sincronizar_compra_auto((select id from _ids where clave = 'HA'),
    jsonb_build_array(jsonb_build_object('ingrediente_id', (select id from _ids where clave = 'arroz'), 'cantidad', 200, 'motivo', 'Otra cena'))), 1);
select pg_temp.igual('...hay un arroz comprado y uno pendiente', pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where nombre = 'Arroz'$q$), 2);
select pg_temp.falla('Una ubicación inválida al comprar se rechaza',
  $q$select public.marcar_comprado((select id from public.lista_compra_articulo where nombre = 'Arroz' and not comprado), 'garaje')$q$, '22023');
select public.deshacer_operacion_despensa((select id from _ids where clave = 'opArroz'));
select pg_temp.igual('Deshacer la compra saca el arroz de la despensa', pg_temp.stock('arroz', 'despensa')::bigint, 0);
select pg_temp.igual('...y como ya había otro pendiente del mismo ingrediente, no se duplica: queda uno solo',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where nombre = 'Arroz' and not comprado$q$), 1);
select pg_temp.igual('...sin ningún arroz marcado como comprado',
  pg_temp.cuenta($q$select 1 from public.lista_compra_articulo where nombre = 'Arroz' and comprado$q$), 0);
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('B no puede marcar comprado un artículo de A',
  $q$select public.marcar_comprado((select id from _ids where clave = 'artArroz'))$q$, '42501');
select pg_temp.fin();

-- ===== 3. CARGAS Y TURNOS ============================================================================
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.persona (hogar_id, nombre, tipo, activa) select id, 'Diego', 'adulto', true from _ids where clave = 'HA';
insert into public.persona (hogar_id, nombre, tipo, activa) select id, 'Ana', 'adulto', true from _ids where clave = 'HA';
insert into public.persona (hogar_id, nombre, tipo, factor_racion) select id, 'Lucía', 'nino', 0.5 from _ids where clave = 'HA';
insert into public.persona (hogar_id, nombre, tipo, activa) select id, 'Abuelo', 'adulto', false from _ids where clave = 'HA';
insert into _ids select 'diego', id from public.persona where nombre = 'Diego';
insert into _ids select 'ana', id from public.persona where nombre = 'Ana';
insert into _ids select 'lucia', id from public.persona where nombre = 'Lucía';
insert into _ids select 'abuelo', id from public.persona where nombre = 'Abuelo';

with c as (insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min, planificacion_min, responsable_id)
  select h.id, 'Cenas entre semana', 'cena', 40, 30, p.id from _ids h, _ids p where h.clave = 'HA' and p.clave = 'diego' returning id)
insert into _ids select 'cargaCenas', id from c;
select pg_temp.igual('A crea una carga con responsable adulto', pg_temp.cuenta('select 1 from public.carga'), 1);
select pg_temp.falla('Un niño no puede ser responsable de una carga',
  $q$insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min, responsable_id) select h.id, 'X', 'tarea', 10, p.id from _ids h, _ids p where h.clave = 'HA' and p.clave = 'lucia'$q$, '23514');
select pg_temp.falla('Una persona inactiva no puede ser responsable',
  $q$insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min, responsable_id) select h.id, 'X', 'tarea', 10, p.id from _ids h, _ids p where h.clave = 'HA' and p.clave = 'abuelo'$q$, '23514');
select pg_temp.falla('Un esfuerzo cero se rechaza',
  $q$insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min) select id, 'X', 'tarea', 0 from _ids where clave = 'HA'$q$, '23514');
select pg_temp.falla('Un tipo de carga inválido se rechaza',
  $q$insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min) select id, 'X', 'ocio', 10 from _ids where clave = 'HA'$q$, '23514');
insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min) select id, 'Cambio de sábanas', 'tarea', 30 from _ids where clave = 'HA';
select pg_temp.igual('Una carga puede quedar sin responsable (pendiente de repartir)',
  pg_temp.cuenta($q$select 1 from public.carga where nombre = 'Cambio de sábanas' and responsable_id is null$q$), 1);
do $$ declare n bigint; begin
  update public.carga set responsable_id = (select id from _ids where clave = 'ana') where nombre = 'Cambio de sábanas'; get diagnostics n = row_count;
  perform pg_temp.igual('Se reasigna la responsabilidad a otra persona adulta', n, 1);
end $$;
select pg_temp.falla('Reasignar a un niño también se rechaza',
  $q$update public.carga set responsable_id = (select id from _ids where clave = 'lucia') where nombre = 'Cambio de sábanas'$q$, '23514');

-- Turnos
insert into public.carga_turno (hogar_id, carga_id, fecha, persona_id)
  select h.id, c.id, date '2026-11-03', p.id from _ids h, _ids c, _ids p where h.clave = 'HA' and c.clave = 'cargaCenas' and p.clave = 'diego';
insert into public.carga_turno (hogar_id, carga_id, fecha, persona_id)
  select h.id, c.id, date '2026-11-04', p.id from _ids h, _ids c, _ids p where h.clave = 'HA' and c.clave = 'cargaCenas' and p.clave = 'ana';
select pg_temp.igual('Hay dos turnos repartidos', pg_temp.cuenta('select 1 from public.carga_turno'), 2);
select pg_temp.falla('Un mismo día no puede tener dos turnos de la misma carga',
  $q$insert into public.carga_turno (hogar_id, carga_id, fecha, persona_id) select h.id, c.id, date '2026-11-03', p.id from _ids h, _ids c, _ids p where h.clave = 'HA' and c.clave = 'cargaCenas' and p.clave = 'ana'$q$, '23505');
select pg_temp.falla('Un niño no puede tener turnos',
  $q$insert into public.carga_turno (hogar_id, carga_id, fecha, persona_id) select h.id, c.id, date '2026-11-05', p.id from _ids h, _ids c, _ids p where h.clave = 'HA' and c.clave = 'cargaCenas' and p.clave = 'lucia'$q$, '23514');
select pg_temp.falla('Un estado inválido se rechaza',
  $q$update public.carga_turno set estado = 'hecho a medias'$q$, '23514');
do $$ declare n bigint; begin
  update public.carga_turno set estado = 'hecho', hecho_en = now() where fecha = date '2026-11-03'; get diagnostics n = row_count;
  perform pg_temp.igual('Se marca un turno como hecho', n, 1);
end $$;
select pg_temp.falla('No se puede mover un turno a otro hogar',
  $q$update public.carga_turno set hogar_id = (select id from _ids where clave = 'HB')$q$, '42501');
select pg_temp.falla('No se puede borrar a una persona que tiene turnos (se perdería el historial)',
  $q$delete from public.persona where nombre = 'Ana'$q$, '23503');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.igual('B no ve las cargas de A', pg_temp.cuenta('select 1 from public.carga'), 0);
select pg_temp.igual('B no ve los turnos de A', pg_temp.cuenta('select 1 from public.carga_turno'), 0);
select pg_temp.falla('B no puede crear cargas en el hogar A',
  $q$insert into public.carga (hogar_id, nombre, tipo, esfuerzo_min) select id, 'Intruso', 'tarea', 10 from _ids where clave = 'HA'$q$, '42501');
do $$ declare n bigint; begin
  update public.carga set nombre = 'Hackeada'; get diagnostics n = row_count;
  perform pg_temp.igual('B no puede editar las cargas de A', n, 0);
end $$;
select pg_temp.fin();

-- Borrar a la persona responsable no borra la carga: queda sin responsable.
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
delete from public.carga_turno where persona_id = (select id from _ids where clave = 'diego');
delete from public.persona where nombre = 'Diego';
select pg_temp.igual('Al borrar a la persona responsable, la carga se conserva sin responsable',
  pg_temp.cuenta($q$select 1 from public.carga where nombre = 'Cenas entre semana' and responsable_id is null$q$), 1);
select pg_temp.fin();

rollback;
\echo 'TODOS LOS TESTS DE DESPENSA, COMPRA Y CARGAS PASAN'
