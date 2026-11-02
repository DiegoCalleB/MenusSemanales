-- =============================================================================
-- Leer y escribir el hogar desde tablas (D-088, fase 3)
--
-- Dos funciones que sustituyen, aggregate a aggregate, al documento `hogar_estado`:
--
--  · `leer_hogar_tablas(hogar)`: devuelve en UNA llamada, como JSON, lo del hogar que ya vive en
--    tablas (personas, cumpleaños con su regalo, apuntes, fechas señaladas, tareas de la casa,
--    tareas por persona, días de «llego tarde» y «no cenamos» y el horizonte).
--  · `aplicar_cambios_tablas(hogar, cambios)`: aplica de una vez, en una transacción, los cambios
--    que ha hecho la app (altas, cambios y bajas). Si algo falla, no se aplica nada.
--
-- Son SECURITY INVOKER: mandan las políticas RLS de cada tabla. Por eso el secreto del regalo
-- (D-087) se cumple aquí también: a quien cumple le llega `regalo: null` y sus cambios sobre su
-- propio regalo se rechazan. El hogar lo fija el parámetro, nunca el contenido del JSON.
-- `persona.user_id` NO se puede cambiar desde aquí (vincular una persona a una cuenta cambiaría
-- quién ve qué regalo).
-- =============================================================================

create function public.leer_hogar_tablas(p_hogar_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'activa', p.activa,
               'factorRacion', p.factor_racion, 'vinculada', p.user_id is not null)
             order by p.creado_en, p.nombre)
        from public.persona p where p.hogar_id = p_hogar_id), '[]'::jsonb),
    'horizonte', coalesce((select a.horizonte from public.hogar_ajuste a where a.hogar_id = p_hogar_id), 'semana'),
    'llegoTarde', coalesce((
      select jsonb_agg(d.fecha::text order by d.fecha)
        from public.dia_hogar d where d.hogar_id = p_hogar_id and d.llega_tarde), '[]'::jsonb),
    'saltados', coalesce((
      select jsonb_agg(d.fecha::text order by d.fecha)
        from public.dia_hogar d where d.hogar_id = p_hogar_id and d.saltado), '[]'::jsonb),
    'cumples', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'nombre', c.nombre, 'dia', c.dia, 'mes', c.mes, 'anio', c.anio,
               'relacion', c.relacion, 'personaId', c.persona_id,
               -- Para quien cumple, RLS oculta el regalo y las ideas: llega null / [].
               'regalo', (select jsonb_build_object('estado', r.estado, 'anioEstado', r.anio_estado, 'gustos', to_jsonb(r.gustos))
                            from public.cumple_regalo r where r.cumple_id = c.id and r.hogar_id = c.hogar_id),
               'ideas', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'texto', i.texto, 'origen', i.origen)
                                                   order by i.creado_en, i.id)
                                    from public.cumple_idea i where i.cumple_id = c.id and i.hogar_id = c.hogar_id), '[]'::jsonb))
             order by c.mes, c.dia, c.nombre)
        from public.cumple c where c.hogar_id = p_hogar_id), '[]'::jsonb),
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'fecha', a.fecha::text, 'hasta', a.hasta::text,
               'hora', to_char(a.hora, 'HH24:MI'), 'titulo', a.titulo)
             order by a.fecha, a.hora nulls first, a.titulo)
        from public.apunte a where a.hogar_id = p_hogar_id), '[]'::jsonb),
    'fechas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', f.fecha::text, 'titulo', f.titulo, 'emoji', f.emoji) order by f.fecha)
        from public.fecha_senalada f where f.hogar_id = p_hogar_id), '[]'::jsonb),
    'casa', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'titulo', t.titulo, 'emoji', t.emoji, 'cadaDias', t.cada_dias,
               'responsableId', t.responsable_id, 'ultimaVez', t.ultima_vez::text, 'desde', t.desde::text,
               'aplazadaHasta', t.aplazada_hasta::text, 'compra', t.compra)
             order by t.creado_en, t.titulo)
        from public.tarea_casa t where t.hogar_id = p_hogar_id), '[]'::jsonb),
    'tareas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'personaId', t.persona_id, 'texto', t.texto, 'frecuencia', t.frecuencia,
               'hechas', coalesce((select jsonb_agg(h.fecha::text order by h.fecha)
                                     from public.tarea_persona_hecha h where h.tarea_id = t.id and h.hogar_id = t.hogar_id), '[]'::jsonb))
             order by t.creado_en, t.texto)
        from public.tarea_persona t where t.hogar_id = p_hogar_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.leer_hogar_tablas(uuid) from public, anon;
grant execute on function public.leer_hogar_tablas(uuid) to authenticated;

-- Aplica los cambios. Formato de `p_cambios` (todas las claves son opcionales):
--   { "personas": {"upsert": [...], "borrar": [ids]}, "cumples": {...}, "agenda": {...},
--     "casa": {...}, "tareas": {...}, "fechas": {"upsert": [...], "borrar": [fechas]},
--     "dias": {"upsert": [{fecha, llegaTarde, saltado}], "borrar": [fechas]},
--     "horizonte": "semana" | "quincena" }
-- En `cumples`, `regalo` ausente o null = no tocar; `ideas` presente = esa es la lista completa.
-- En `tareas`, `hechas` presente = esa es la lista completa de días hechos.
create function public.aplicar_cambios_tablas(p_hogar_id uuid, p_cambios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
    raise exception 'Los cambios deben ser un objeto' using errcode = '22023';
  end if;
  if octet_length(p_cambios::text) > 2000000 then
    raise exception 'Demasiados cambios de una vez' using errcode = '54000';
  end if;

  -- Personas (sin user_id: vincular una cuenta no se hace desde aquí).
  v := p_cambios->'personas';
  if v is not null then
    insert into public.persona (id, hogar_id, nombre, tipo, factor_racion, activa)
    select x.id, p_hogar_id, x.nombre, x.tipo, coalesce(x."factorRacion", 1), coalesce(x.activa, true)
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, nombre text, tipo text, "factorRacion" numeric, activa boolean)
    on conflict (id) do update
      set nombre = excluded.nombre, tipo = excluded.tipo, factor_racion = excluded.factor_racion, activa = excluded.activa
      where public.persona.hogar_id = p_hogar_id;
    delete from public.persona
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Horizonte del menú.
  if p_cambios ? 'horizonte' then
    insert into public.hogar_ajuste (hogar_id, horizonte) values (p_hogar_id, p_cambios->>'horizonte')
    on conflict (hogar_id) do update set horizonte = excluded.horizonte, actualizado_en = now();
  end if;

  -- Días: «llego tarde» y «no cenamos en casa».
  v := p_cambios->'dias';
  if v is not null then
    insert into public.dia_hogar (hogar_id, fecha, llega_tarde, saltado)
    select p_hogar_id, x.fecha, coalesce(x."llegaTarde", false), coalesce(x.saltado, false)
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, "llegaTarde" boolean, saltado boolean)
    on conflict (hogar_id, fecha) do update set llega_tarde = excluded.llega_tarde, saltado = excluded.saltado;
    delete from public.dia_hogar
     where hogar_id = p_hogar_id and fecha in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::date);
    -- Un día sin «llego tarde» ni «saltado» no guarda nada: no ocupa fila.
    delete from public.dia_hogar where hogar_id = p_hogar_id and not llega_tarde and not saltado;
  end if;

  -- Cumpleaños, con su regalo y sus ideas.
  v := p_cambios->'cumples';
  if v is not null then
    insert into public.cumple (id, hogar_id, persona_id, nombre, dia, mes, anio, relacion)
    select x.id, p_hogar_id, x."personaId", x.nombre, x.dia, x.mes, x.anio, coalesce(x.relacion, 'familia')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]'))
           as x(id uuid, "personaId" uuid, nombre text, dia smallint, mes smallint, anio smallint, relacion text)
    on conflict (id) do update
      set persona_id = excluded.persona_id, nombre = excluded.nombre, dia = excluded.dia, mes = excluded.mes,
          anio = excluded.anio, relacion = excluded.relacion
      where public.cumple.hogar_id = p_hogar_id;

    -- Regalo: solo si viene (null o ausente = no tocar).
    insert into public.cumple_regalo (cumple_id, hogar_id, estado, anio_estado, gustos)
    select x.id, p_hogar_id, coalesce(x.regalo->>'estado', 'sin-pensar'),
           nullif(x.regalo->>'anioEstado', '')::smallint,
           coalesce((select array_agg(g) from jsonb_array_elements_text(coalesce(x.regalo->'gustos', '[]')) g), '{}')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, regalo jsonb)
     where jsonb_typeof(x.regalo) = 'object'
    on conflict (cumple_id) do update
      set estado = excluded.estado, anio_estado = excluded.anio_estado, gustos = excluded.gustos;

    -- Ideas: si viene la lista, es la completa (se quitan las que ya no están).
    delete from public.cumple_idea i
     using jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, ideas jsonb)
     where i.cumple_id = x.id and i.hogar_id = p_hogar_id and jsonb_typeof(x.ideas) = 'array'
       and i.id not in (select (e->>'id')::uuid from jsonb_array_elements(x.ideas) e);
    insert into public.cumple_idea (id, hogar_id, cumple_id, texto, origen)
    select (e->>'id')::uuid, p_hogar_id, x.id, e->>'texto', coalesce(e->>'origen', 'persona')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, ideas jsonb),
           lateral jsonb_array_elements(case when jsonb_typeof(x.ideas) = 'array' then x.ideas else '[]'::jsonb end) e
    on conflict (id) do update set texto = excluded.texto, origen = excluded.origen
      where public.cumple_idea.hogar_id = p_hogar_id;

    delete from public.cumple
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Apuntes de la agenda.
  v := p_cambios->'agenda';
  if v is not null then
    insert into public.apunte (id, hogar_id, fecha, hasta, hora, titulo)
    select x.id, p_hogar_id, x.fecha, x.hasta, x.hora, x.titulo
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, fecha date, hasta date, hora time, titulo text)
    on conflict (id) do update
      set fecha = excluded.fecha, hasta = excluded.hasta, hora = excluded.hora, titulo = excluded.titulo
      where public.apunte.hogar_id = p_hogar_id;
    delete from public.apunte
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Fechas señaladas.
  v := p_cambios->'fechas';
  if v is not null then
    insert into public.fecha_senalada (hogar_id, fecha, titulo, emoji)
    select p_hogar_id, x.fecha, x.titulo, coalesce(x.emoji, '📌')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, titulo text, emoji text)
    on conflict (hogar_id, fecha) do update set titulo = excluded.titulo, emoji = excluded.emoji;
    delete from public.fecha_senalada
     where hogar_id = p_hogar_id and fecha in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::date);
  end if;

  -- Tareas de la casa.
  v := p_cambios->'casa';
  if v is not null then
    insert into public.tarea_casa (id, hogar_id, titulo, emoji, cada_dias, responsable_id, ultima_vez, desde, aplazada_hasta, compra)
    select x.id, p_hogar_id, x.titulo, coalesce(x.emoji, '🏠'), x."cadaDias", x."responsableId", x."ultimaVez", x.desde,
           x."aplazadaHasta", x.compra
      from jsonb_to_recordset(coalesce(v->'upsert', '[]'))
           as x(id uuid, titulo text, emoji text, "cadaDias" integer, "responsableId" uuid, "ultimaVez" date, desde date,
                "aplazadaHasta" date, compra text)
    on conflict (id) do update
      set titulo = excluded.titulo, emoji = excluded.emoji, cada_dias = excluded.cada_dias,
          responsable_id = excluded.responsable_id, ultima_vez = excluded.ultima_vez, desde = excluded.desde,
          aplazada_hasta = excluded.aplazada_hasta, compra = excluded.compra
      where public.tarea_casa.hogar_id = p_hogar_id;
    delete from public.tarea_casa
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Tareas por persona, con los días en que se hicieron.
  v := p_cambios->'tareas';
  if v is not null then
    insert into public.tarea_persona (id, hogar_id, persona_id, texto, frecuencia)
    select x.id, p_hogar_id, x."personaId", x.texto, coalesce(x.frecuencia, 'puntual')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, "personaId" uuid, texto text, frecuencia text)
    on conflict (id) do update
      set persona_id = excluded.persona_id, texto = excluded.texto, frecuencia = excluded.frecuencia
      where public.tarea_persona.hogar_id = p_hogar_id;

    delete from public.tarea_persona_hecha h
     using jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, hechas jsonb)
     where h.tarea_id = x.id and h.hogar_id = p_hogar_id and jsonb_typeof(x.hechas) = 'array'
       and h.fecha::text not in (select jsonb_array_elements_text(x.hechas));
    insert into public.tarea_persona_hecha (tarea_id, hogar_id, fecha)
    select x.id, p_hogar_id, (d)::date
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, hechas jsonb),
           lateral jsonb_array_elements_text(case when jsonb_typeof(x.hechas) = 'array' then x.hechas else '[]'::jsonb end) d
    on conflict (tarea_id, fecha) do nothing;

    delete from public.tarea_persona
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;
end;
$$;

revoke all on function public.aplicar_cambios_tablas(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_cambios_tablas(uuid, jsonb) to authenticated;
