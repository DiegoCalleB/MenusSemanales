-- =============================================================================
-- Privilegios mínimos de verdad (D-064)
--
-- Hallazgo: Supabase concede por defecto TODOS los privilegios a `anon`, `authenticated` y
-- `service_role` sobre cada tabla nueva de `public`. Las migraciones anteriores solo revocaban a
-- `anon` y a `public`, así que en producción `authenticated` conservaba INSERT, UPDATE, DELETE y
-- TRUNCATE en todas las tablas y las restricciones «por columna» (p. ej. que nadie fije `origen`
-- a mano en un plato, o cambie `cantidad` en la despensa sin pasar por una operación) NO valían.
-- Las políticas RLS seguían protegiendo el aislamiento entre hogares.
--
-- Esta migración quita todo a `anon` y `authenticated` y vuelve a conceder SOLO lo que cada tabla
-- necesita, y evita que lo que se cree después herede privilegios por defecto.
-- =============================================================================

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Hogares y personas
grant select, update, delete             on public.hogar                to authenticated;
grant select, update, delete             on public.miembro              to authenticated;
grant select                             on public.invitacion           to authenticated;
grant select, insert, update, delete     on public.persona              to authenticated;
grant select, insert, update, delete     on public.patron_asistencia    to authenticated;
grant select, insert, update, delete     on public.excepcion_asistencia to authenticated;

-- Centro compartido
grant select                              on public.centro                  to authenticated;
grant update (nombre, localidad)          on public.centro                  to authenticated;
grant select, delete                      on public.centro_hogar            to authenticated;
grant select                              on public.centro_codigo           to authenticated;
grant update (revocado)                   on public.centro_codigo           to authenticated;
grant select, insert, update, delete      on public.menu_cole_dia           to authenticated;
grant select                              on public.menu_cole_dia_historial to authenticated;

-- Catálogo de platos
grant select, update, delete on public.ingrediente to authenticated;
grant select, delete on public.plato to authenticated;
grant insert (hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos)
  on public.plato to authenticated;
grant update (nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos,
              no_proponer, activo)
  on public.plato to authenticated;
grant select, insert, update, delete on public.plato_ingrediente to authenticated;
grant select on public.plato_compartido, public.plato_compartido_ingrediente,
                public.plato_compartido_autor to authenticated;

-- Despensa, compra y reparto
grant select, delete on public.despensa_item to authenticated;
grant update (minimo, caduca_en) on public.despensa_item to authenticated;
grant select on public.despensa_operacion, public.despensa_movimiento to authenticated;
grant select, delete on public.lista_compra_articulo to authenticated;
grant insert (hogar_id, nombre, cantidad, ingrediente_id, seccion) on public.lista_compra_articulo to authenticated;
grant update (nombre, cantidad, comprado) on public.lista_compra_articulo to authenticated;
grant select, insert, update, delete on public.carga, public.carga_turno to authenticated;

-- Menú planificado y valoraciones
grant select, delete on public.comida_planificada to authenticated;
grant insert (hogar_id, fecha, momento, plato_id, raciones) on public.comida_planificada to authenticated;
grant update (plato_id, raciones, estado) on public.comida_planificada to authenticated;
grant select, insert, update, delete on public.dia_hogar to authenticated;
grant select, insert, update, delete on public.valoracion_plato to authenticated;

-- Sincronización del hogar: solo lectura; se guarda con guardar_estado_hogar()
grant select on public.hogar_estado to authenticated;
