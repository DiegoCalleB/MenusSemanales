-- =============================================================================
-- El menú del cole en el calendario de comidas (D-141)
--
-- Diego: «solo salen las cenas, deberían salir también las comidas del cole y de casa». El
-- resumen del calendario añade `cole`: los platos del menú del colegio del hogar (primero, segundo
-- y postre) de ayer a 60 días vista. Nada más del colegio (ni grupos, ni calorías, ni historial).
-- El resto de la función no cambia (copia de 20261113000000_mochila_en_calendario.sql).
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
      -- Qué llevar (D-136) sigue en el documento del hogar.
      'mochila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personaId', x->'personaId', 'texto', x->'texto', 'dias', x->'dias',
          'fecha', x->'fecha', 'antes', x->'antes'))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'mochila')) x), '[]'::jsonb),
      -- Menú del cole (D-141), del colegio del hogar: de ayer a 60 días vista, solo los platos.
      'cole', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', m.fecha::text, 'primero', m.primero, 'segundo', m.segundo, 'postre', m.postre)
               order by m.fecha)
          from public.centro_hogar ch
          join public.menu_cole_dia m on m.centro_id = ch.centro_id
         where ch.hogar_id = v_hogar
           and m.fecha between current_date - 1 and current_date + 60), '[]'::jsonb),
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
    'mochila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personaId', x->'personaId', 'texto', x->'texto', 'dias', x->'dias',
          'fecha', x->'fecha', 'antes', x->'antes'))
          from jsonb_array_elements(privado.lista(v_estado->'mochila')) x), '[]'::jsonb),
      'cole', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', k, 'primero', v->'textoPrimero', 'segundo', v->'textoSegundo', 'postre', v->'postre')
               order by k)
          from jsonb_each(case when jsonb_typeof(v_estado->'colegio') = 'object'
                               then v_estado->'colegio' else '{}'::jsonb end) as c(k, v)
         where k ~ '^\d{4}-\d{2}-\d{2}$'), '[]'::jsonb),
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
