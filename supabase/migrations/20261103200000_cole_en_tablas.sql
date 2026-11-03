-- =============================================================================
-- El menú del cole en tablas (D-104)
--
-- El menú del cole es del COLEGIO, no de una familia: lo comparten todas las familias de la misma
-- clase (`centro` → `menu_cole_dia`, con historial de cambios). Esta migración conecta la app con
-- esa estructura, que ya existía y estaba vacía:
--   · a `menu_cole_dia` le faltaban la guarnición y las kilocalorías que publica el cole;
--   · `leer_cole_tablas` y `aplicar_cambios_cole` leen y escriben el menú del colegio del hogar,
--     creando el colegio (y vinculando el hogar como curador) la primera vez.
-- =============================================================================

alter table public.menu_cole_dia
  add column guarnicion text check (char_length(btrim(guarnicion)) between 1 and 200),
  add column kcal       smallint check (kcal between 0 and 5000);

-- El colegio del hogar (el primero al que está vinculado) y su menú, en una llamada.
create function public.leer_cole_tablas(p_hogar_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_id     uuid;
  v_nombre text;
  v_loc    text;
  v_rol    text;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;

  select c.id, c.nombre, c.localidad, ch.rol into v_id, v_nombre, v_loc, v_rol
    from public.centro_hogar ch join public.centro c on c.id = ch.centro_id
   where ch.hogar_id = p_hogar_id
   order by ch.unido_en limit 1;
  if not found then
    return jsonb_build_object('centro', null, 'dias', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'centro', jsonb_build_object('id', v_id, 'nombre', v_nombre, 'localidad', v_loc, 'rol', v_rol),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', m.fecha::text, 'primero', m.primero, 'segundo', m.segundo, 'postre', m.postre,
               'guarnicion', m.guarnicion, 'kcal', m.kcal,
               'grupoPrimero', m.grupo_primero, 'grupoSegundo', m.grupo_segundo) order by m.fecha)
        from public.menu_cole_dia m where m.centro_id = v_id), '[]'::jsonb));
end;
$$;

-- Formato de `p_cambios`:
--   {"centro": {"nombre": "...", "localidad": "..."},   -- solo si el hogar aún no tiene colegio
--    "dias": {"upsert": [{fecha, primero, segundo, postre, guarnicion, kcal, grupoPrimero, grupoSegundo}],
--             "borrar": [fechas]}}
-- Escribir días lo puede hacer cualquier hogar del colegio; borrar, solo un curador (lo decide RLS).
create function public.aplicar_cambios_cole(p_hogar_id uuid, p_cambios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_centro uuid;
  v        jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
    raise exception 'Cambios no válidos' using errcode = '22023';
  end if;
  if octet_length(p_cambios::text) > 2000000 then
    raise exception 'Demasiados cambios de una vez' using errcode = '54000';
  end if;

  select ch.centro_id into v_centro from public.centro_hogar ch
   where ch.hogar_id = p_hogar_id order by ch.unido_en limit 1;
  if v_centro is null then
    if p_cambios->'centro' is null then
      raise exception 'El hogar no tiene colegio' using errcode = '22023';
    end if;
    v_centro := public.crear_centro(p_hogar_id, p_cambios->'centro'->>'nombre', p_cambios->'centro'->>'localidad');
  end if;

  v := p_cambios->'dias';
  if v is not null then
    insert into public.menu_cole_dia (centro_id, fecha, primero, segundo, postre, guarnicion, kcal, grupo_primero, grupo_segundo)
    select v_centro, x.fecha, x.primero, x.segundo, x.postre, x.guarnicion, x.kcal, x."grupoPrimero", x."grupoSegundo"
      from jsonb_to_recordset(coalesce(v->'upsert', '[]'))
           as x(fecha date, primero text, segundo text, postre text, guarnicion text, kcal smallint,
                "grupoPrimero" text, "grupoSegundo" text)
    on conflict (centro_id, fecha) do update
      set primero = excluded.primero, segundo = excluded.segundo, postre = excluded.postre,
          guarnicion = excluded.guarnicion, kcal = excluded.kcal,
          grupo_primero = excluded.grupo_primero, grupo_segundo = excluded.grupo_segundo;
    delete from public.menu_cole_dia
     where centro_id = v_centro and fecha in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::date);
  end if;
end;
$$;

revoke all on function public.leer_cole_tablas(uuid)            from public, anon;
revoke all on function public.aplicar_cambios_cole(uuid, jsonb) from public, anon;
grant execute on function public.leer_cole_tablas(uuid)            to authenticated;
grant execute on function public.aplicar_cambios_cole(uuid, jsonb) to authenticated;
