-- =============================================================================
-- El calendario suscrito lee de las tablas (D-109)
--
-- `estado_para_calendario` leía el documento `hogar_estado`. Desde que personas, cenas, comidas,
-- agenda, fechas, casa y cumpleaños viven en tablas, el documento ya no se actualiza con ellos y
-- el calendario de Google se quedaba con datos viejos. Ahora, si el hogar ya tiene sus personas en
-- tablas, el resumen sale de ellas; si no (hogar sin migrar), sigue saliendo del documento.
-- Sigue siendo un resumen MÍNIMO: nunca ideas, gustos ni regalo, compra, despensa, ingredientes ni cole.
-- =============================================================================

create or replace function public.estado_para_calendario(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_hogar  uuid;
  v_estado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;

  -- Hogar con sus datos en tablas.
  if exists (select 1 from public.persona p where p.hogar_id = v_hogar) then
    return jsonb_build_object(
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'activa', p.activa)
                         order by p.creado_en, p.nombre)
          from public.persona p where p.hogar_id = v_hogar), '[]'::jsonb),
      -- Una entrada por plato de cada cena, en su orden.
      'cenas', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', c.fecha::text, 'nombre', pl.nombre)
                         order by c.fecha, cp.orden)
          from public.comida_planificada c
          join public.comida_plato cp on cp.comida_id = c.id and cp.hogar_id = c.hogar_id
          join public.plato pl on pl.id = cp.plato_id and pl.hogar_id = cp.hogar_id
         where c.hogar_id = v_hogar and c.momento = 'cena'), '[]'::jsonb),
      'almuerzos', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', a.fecha::text, 'texto', a.texto) order by a.fecha, a.creado_en)
          from public.almuerzo a where a.hogar_id = v_hogar), '[]'::jsonb),
      'eventos', coalesce((
        select jsonb_object_agg(f.fecha::text, jsonb_build_object('titulo', f.titulo, 'emoji', f.emoji))
          from public.fecha_senalada f where f.hogar_id = v_hogar), '{}'::jsonb),
      'agenda', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', a.fecha::text, 'hasta', a.hasta::text, 'hora', to_char(a.hora, 'HH24:MI'), 'titulo', a.titulo)
               order by a.fecha, a.hora nulls first, a.titulo)
          from public.apunte a where a.hogar_id = v_hogar), '[]'::jsonb),
      'casa', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'titulo', t.titulo, 'emoji', t.emoji, 'cadaDias', t.cada_dias,
                 'responsableId', t.responsable_id, 'ultimaVez', t.ultima_vez::text, 'desde', t.desde::text,
                 'aplazadaHasta', t.aplazada_hasta::text)
               order by t.creado_en, t.titulo)
          from public.tarea_casa t where t.hogar_id = v_hogar), '[]'::jsonb),
      -- Cumpleaños: solo quién, cuándo y de qué persona del hogar es. Nunca ideas, gustos ni regalo.
      'cumples', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'nombre', c.nombre, 'dia', c.dia, 'mes', c.mes, 'anio', c.anio, 'personaId', c.persona_id)
               order by c.mes, c.dia, c.nombre)
          from public.cumple c where c.hogar_id = v_hogar), '[]'::jsonb)
    );
  end if;

  -- Hogar que aún solo tiene el documento.
  select e.estado into v_estado from public.hogar_estado e where e.hogar_id = v_hogar;
  if v_estado is null then
    return null;
  end if;
  return jsonb_build_object(
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x->'id', 'nombre', x->'nombre', 'tipo', x->'tipo',
        'activa', coalesce(x->'activa' <> 'false'::jsonb, true)))
        from jsonb_array_elements(privado.lista(v_estado->'personas')) x), '[]'::jsonb),
    'cenas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'nombre', x->'plato'->'nombre'))
        from jsonb_array_elements(privado.lista(v_estado->'comidas')) x), '[]'::jsonb),
    'almuerzos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'texto', x->'texto'))
        from jsonb_array_elements(privado.lista(v_estado->'almuerzos')) x), '[]'::jsonb),
    'eventos', case when jsonb_typeof(v_estado->'eventos') = 'object' then v_estado->'eventos' else '{}'::jsonb end,
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fecha', x->'fecha', 'hasta', x->'hasta', 'hora', x->'hora', 'titulo', x->'titulo'))
        from jsonb_array_elements(privado.lista(v_estado->'agenda')) x), '[]'::jsonb),
    'casa', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', x->'titulo', 'emoji', x->'emoji', 'cadaDias', x->'cadaDias',
        'responsableId', x->'responsableId', 'ultimaVez', x->'ultimaVez', 'desde', x->'desde',
        'aplazadaHasta', x->'aplazadaHasta'))
        from jsonb_array_elements(privado.lista(v_estado->'casa')) x), '[]'::jsonb),
    'cumples', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', x->'nombre', 'dia', x->'dia', 'mes', x->'mes', 'anio', x->'anio',
        'personaId', x->'personaId'))
        from jsonb_array_elements(privado.lista(v_estado->'cumples')) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.estado_para_calendario(text) from public;
grant execute on function public.estado_para_calendario(text) to anon, authenticated;
