-- =============================================================================
-- El menú en tablas, bien estructurado (D-101)
--
-- Hasta ahora platos, cenas, valoraciones y comidas del mediodía vivían dentro del documento JSON
-- `hogar_estado`. Esta migración deja la estructura relacional correcta y dos funciones (leer y
-- aplicar) como las de D-088. Todas las tablas que se tocan estaban VACÍAS: se puede reestructurar.
--
-- Estructura:
--   plato ─┬─ plato_ingrediente ── ingrediente (catálogo compartido, por nombre)
--          ├─ valoracion_plato (persona, 1-5)
--          └─ comida_plato ── comida_planificada (una por hogar, día y momento)
--   nota_comida          la nota de «cena» o «comida» de un día («o igual lomo»)
--   almuerzo             comida del mediodía (texto libre o plato)
--   ingrediente_excluido lo que la familia no quiere ver en el menú
--
-- Un cambio de fondo: una cena puede llevar VARIOS platos (sopa + tortilla). Antes la tabla solo
-- admitía uno por día. Ahora `comida_planificada` es la cena del día y `comida_plato` sus platos,
-- en orden.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Platos: lo que la app necesita y la tabla no tenía
-- ---------------------------------------------------------------------------
alter table public.plato add column por_revisar boolean not null default false;  -- ingredientes y tiempos estimados
alter table public.plato add column ultima_vez  date;                            -- la última vez que se cocinó

-- La app admite hasta 8 horas de trabajo activo; la tabla, 4.
alter table public.plato drop constraint plato_tiempo_activo_min_check;
alter table public.plato add constraint plato_tiempo_activo_min_check
  check (tiempo_activo_min between 1 and 480);

-- Privilegios por columna: ahora también se puede fijar el id (lo decide quien crea, D-089) y los
-- campos nuevos. `origen` y `plato_compartido_id` siguen protegidos.
grant insert (id, no_proponer, por_revisar, ultima_vez) on public.plato to authenticated;
grant update (por_revisar, ultima_vez) on public.plato to authenticated;

-- ---------------------------------------------------------------------------
-- 2. La cena de un día: la fila es el día y momento; los platos, aparte y en orden
-- ---------------------------------------------------------------------------
alter table public.comida_planificada drop column plato_id;
alter table public.comida_planificada add constraint comida_planificada_id_hogar_key unique (id, hogar_id);

grant insert (hogar_id, fecha, momento, raciones, estado) on public.comida_planificada to authenticated;
grant update (raciones, estado) on public.comida_planificada to authenticated;

create table public.comida_plato (
  comida_id  uuid not null,
  hogar_id   uuid not null,
  plato_id   uuid not null,
  orden      smallint not null check (orden between 0 and 9),
  primary key (comida_id, plato_id),
  unique (comida_id, orden),
  foreign key (comida_id, hogar_id) references public.comida_planificada (id, hogar_id) on delete cascade,
  foreign key (plato_id, hogar_id)  references public.plato (id, hogar_id) on delete cascade
);
create index comida_plato_plato_idx on public.comida_plato (plato_id, hogar_id);
create index comida_plato_hogar_idx on public.comida_plato (hogar_id);

-- ---------------------------------------------------------------------------
-- 3. La nota de cada cena
-- ---------------------------------------------------------------------------
create table public.nota_comida (
  hogar_id  uuid not null references public.hogar (id) on delete cascade,
  fecha     date not null,
  momento   text not null default 'cena' check (momento in ('comida', 'cena')),
  texto     text not null check (char_length(btrim(texto)) between 1 and 140),
  primary key (hogar_id, fecha, momento)
);

-- ---------------------------------------------------------------------------
-- 4. Seguridad: RLS forzada, anon sin nada, el hogar gestiona lo suyo
-- ---------------------------------------------------------------------------
alter table public.comida_plato enable row level security;
alter table public.nota_comida  enable row level security;
alter table public.comida_plato force row level security;
alter table public.nota_comida  force row level security;
revoke all on public.comida_plato, public.nota_comida from anon, authenticated, public;
grant select, insert, update, delete on public.comida_plato, public.nota_comida to authenticated;
grant select, insert, update, delete on public.almuerzo, public.ingrediente_excluido to authenticated;

create policy comida_plato_all on public.comida_plato for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy nota_comida_all on public.nota_comida for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));

-- ---------------------------------------------------------------------------
-- 5. Ingredientes: de nombre a catálogo (el catálogo es compartido y único por nombre)
-- ---------------------------------------------------------------------------
-- Recibe [{clave, nombre, unidad, seccion}] y devuelve {clave: id}. Los que no existen se crean
-- (con el límite diario de `crear_ingrediente`). Así la app pasa de ids de texto a ids del catálogo.
create function public.resolver_ingredientes(p_ingredientes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_salida jsonb := '{}'::jsonb;
  r record;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if p_ingredientes is null or jsonb_typeof(p_ingredientes) <> 'array' or jsonb_array_length(p_ingredientes) > 400 then
    raise exception 'Lista de ingredientes no válida' using errcode = '22023';
  end if;
  for r in select * from jsonb_to_recordset(p_ingredientes) as x(clave text, nombre text, unidad text, seccion text) loop
    v_salida := v_salida || jsonb_build_object(
      r.clave, public.crear_ingrediente(r.nombre, r.unidad, coalesce(r.seccion, 'otros')));
  end loop;
  return v_salida;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Leer el menú del hogar, en una llamada y en camelCase
-- ---------------------------------------------------------------------------
create function public.leer_menu_tablas(p_hogar_id uuid)
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
    -- Solo los ingredientes que el hogar usa (en sus platos o excluidos).
    'ingredientes', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'nombre', i.nombre, 'unidad', i.unidad, 'seccion', i.seccion) order by i.nombre)
        from public.ingrediente i
       where i.id in (select pi.ingrediente_id from public.plato_ingrediente pi where pi.hogar_id = p_hogar_id)
          or i.id in (select e.ingrediente_id from public.ingrediente_excluido e where e.hogar_id = p_hogar_id)), '[]'::jsonb),
    'platos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'grupo', p.grupo, 'ligero', p.rol = 'guarnicion',
               'minutosActivos', p.tiempo_activo_min, 'pasos', p.pasos, 'noProponer', p.no_proponer,
               'porRevisar', p.por_revisar, 'ultimaVez', p.ultima_vez::text,
               'ingredientes', coalesce((select jsonb_agg(jsonb_build_object(
                                  'ingredienteId', pi.ingrediente_id, 'cantidadPorRacion', pi.cantidad_por_racion,
                                  'opcional', pi.opcional) order by pi.opcional, pi.ingrediente_id)
                                from public.plato_ingrediente pi where pi.plato_id = p.id and pi.hogar_id = p.hogar_id), '[]'::jsonb))
             order by p.creado_en, p.nombre)
        from public.plato p where p.hogar_id = p_hogar_id and p.activo), '[]'::jsonb),
    'excluidos', coalesce((
      select jsonb_agg(e.ingrediente_id order by e.ingrediente_id)
        from public.ingrediente_excluido e where e.hogar_id = p_hogar_id), '[]'::jsonb),
    'comidas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'fecha', c.fecha::text, 'momento', c.momento, 'raciones', c.raciones, 'estado', c.estado,
               'platos', coalesce((select jsonb_agg(cp.plato_id order by cp.orden)
                                     from public.comida_plato cp where cp.comida_id = c.id and cp.hogar_id = c.hogar_id), '[]'::jsonb))
             order by c.fecha, c.momento)
        from public.comida_planificada c where c.hogar_id = p_hogar_id), '[]'::jsonb),
    'notas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', n.fecha::text, 'momento', n.momento, 'texto', n.texto) order by n.fecha, n.momento)
        from public.nota_comida n where n.hogar_id = p_hogar_id), '[]'::jsonb),
    'almuerzos', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'fecha', a.fecha::text, 'texto', a.texto, 'platoId', a.plato_id)
             order by a.fecha, a.creado_en)
        from public.almuerzo a where a.hogar_id = p_hogar_id), '[]'::jsonb),
    'valoraciones', coalesce((
      select jsonb_agg(jsonb_build_object('platoId', v.plato_id, 'personaId', v.persona_id, 'puntos', v.puntos)
             order by v.plato_id, v.persona_id)
        from public.valoracion_plato v where v.hogar_id = p_hogar_id), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Aplicar cambios del menú, todo o nada
-- ---------------------------------------------------------------------------
-- Formato de `p_cambios` (todo opcional), cada agregado con {upsert:[…], borrar:[…]}:
--   platos        upsert [{id, nombre, ligero, grupo, minutosActivos, pasos, noProponer, porRevisar,
--                         ultimaVez, ingredientes:[{ingredienteId, cantidadPorRacion, opcional}]}]
--                 («ingredientes» presente = la lista completa); borrar [ids]
--   excluidos     upsert [ingredienteId]; borrar [ingredienteId]
--   comidas       upsert [{fecha, momento, raciones, estado, platos:[ids en orden]}]; borrar ["fecha|momento"]
--   notas         upsert [{fecha, momento, texto}]; borrar ["fecha|momento"]
--   almuerzos     upsert [{id, fecha, texto, platoId}]; borrar [ids]
--   valoraciones  upsert [{platoId, personaId, puntos}]; borrar ["platoId|personaId"]
create function public.aplicar_cambios_menu(p_hogar_id uuid, p_cambios jsonb)
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
    raise exception 'Cambios no válidos' using errcode = '22023';
  end if;
  if octet_length(p_cambios::text) > 2000000 then
    raise exception 'Demasiados cambios de una vez' using errcode = '54000';
  end if;

  -- Platos y sus ingredientes.
  v := p_cambios->'platos';
  if v is not null then
    insert into public.plato (id, hogar_id, nombre, rol, grupo, tiempo_activo_min, pasos, no_proponer, por_revisar, ultima_vez)
    select x.id, p_hogar_id, x.nombre, case when coalesce(x.ligero, false) then 'guarnicion' else 'principal' end,
           x.grupo, x."minutosActivos", x.pasos, coalesce(x."noProponer", false), coalesce(x."porRevisar", false), x."ultimaVez"
      from jsonb_to_recordset(coalesce(v->'upsert', '[]'))
           as x(id uuid, nombre text, ligero boolean, grupo text, "minutosActivos" integer, pasos text,
                "noProponer" boolean, "porRevisar" boolean, "ultimaVez" date)
    on conflict (id) do update
      set nombre = excluded.nombre, rol = excluded.rol, grupo = excluded.grupo,
          tiempo_activo_min = excluded.tiempo_activo_min, pasos = excluded.pasos,
          no_proponer = excluded.no_proponer, por_revisar = excluded.por_revisar, ultima_vez = excluded.ultima_vez
      where public.plato.hogar_id = p_hogar_id;

    delete from public.plato_ingrediente pi
     using jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, ingredientes jsonb)
     where x.ingredientes is not null and pi.plato_id = x.id and pi.hogar_id = p_hogar_id;
    insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion, opcional)
    select p_hogar_id, x.id, (e->>'ingredienteId')::uuid, (e->>'cantidadPorRacion')::numeric,
           coalesce((e->>'opcional')::boolean, false)
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, ingredientes jsonb),
           jsonb_array_elements(coalesce(x.ingredientes, '[]')) e;

    delete from public.plato
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Ingredientes que la familia no quiere ver.
  v := p_cambios->'excluidos';
  if v is not null then
    insert into public.ingrediente_excluido (hogar_id, ingrediente_id)
    select p_hogar_id, (jsonb_array_elements_text(coalesce(v->'upsert', '[]')))::uuid
    on conflict do nothing;
    delete from public.ingrediente_excluido
     where hogar_id = p_hogar_id
       and ingrediente_id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- La cena (o comida) de cada día, con sus platos en orden.
  v := p_cambios->'comidas';
  if v is not null then
    insert into public.comida_planificada (hogar_id, fecha, momento, raciones, estado)
    select p_hogar_id, x.fecha, coalesce(x.momento, 'cena'), x.raciones, coalesce(x.estado, 'planificada')
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, momento text, raciones numeric, estado text)
    on conflict (hogar_id, fecha, momento) do update set raciones = excluded.raciones, estado = excluded.estado;

    delete from public.comida_plato cp
     using public.comida_planificada c,
           jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, momento text, platos jsonb)
     where c.hogar_id = p_hogar_id and c.fecha = x.fecha and c.momento = coalesce(x.momento, 'cena')
       and cp.comida_id = c.id and cp.hogar_id = c.hogar_id and x.platos is not null;
    insert into public.comida_plato (comida_id, hogar_id, plato_id, orden)
    select c.id, p_hogar_id, (e.valor)::uuid, (e.orden - 1)::smallint
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, momento text, platos jsonb)
      join public.comida_planificada c
        on c.hogar_id = p_hogar_id and c.fecha = x.fecha and c.momento = coalesce(x.momento, 'cena'),
           jsonb_array_elements_text(coalesce(x.platos, '[]')) with ordinality as e(valor, orden);

    delete from public.comida_planificada
     where hogar_id = p_hogar_id
       and (fecha::text || '|' || momento) in (select jsonb_array_elements_text(coalesce(v->'borrar', '[]')));
  end if;

  -- Notas.
  v := p_cambios->'notas';
  if v is not null then
    insert into public.nota_comida (hogar_id, fecha, momento, texto)
    select p_hogar_id, x.fecha, coalesce(x.momento, 'cena'), x.texto
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(fecha date, momento text, texto text)
    on conflict (hogar_id, fecha, momento) do update set texto = excluded.texto;
    delete from public.nota_comida
     where hogar_id = p_hogar_id
       and (fecha::text || '|' || momento) in (select jsonb_array_elements_text(coalesce(v->'borrar', '[]')));
  end if;

  -- Comida del mediodía.
  v := p_cambios->'almuerzos';
  if v is not null then
    insert into public.almuerzo (id, hogar_id, fecha, texto, plato_id)
    select x.id, p_hogar_id, x.fecha, x.texto, x."platoId"
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x(id uuid, fecha date, texto text, "platoId" uuid)
    on conflict (id) do update set fecha = excluded.fecha, texto = excluded.texto, plato_id = excluded.plato_id
      where public.almuerzo.hogar_id = p_hogar_id;
    delete from public.almuerzo
     where hogar_id = p_hogar_id and id in (select (jsonb_array_elements_text(coalesce(v->'borrar', '[]')))::uuid);
  end if;

  -- Valoraciones.
  v := p_cambios->'valoraciones';
  if v is not null then
    insert into public.valoracion_plato (hogar_id, plato_id, persona_id, puntos)
    select p_hogar_id, x."platoId", x."personaId", x.puntos
      from jsonb_to_recordset(coalesce(v->'upsert', '[]')) as x("platoId" uuid, "personaId" uuid, puntos smallint)
    on conflict (plato_id, persona_id) do update set puntos = excluded.puntos, en = now();
    delete from public.valoracion_plato vp
     where vp.hogar_id = p_hogar_id
       and (vp.plato_id::text || '|' || vp.persona_id::text) in (select jsonb_array_elements_text(coalesce(v->'borrar', '[]')));
  end if;
end;
$$;

revoke all on function public.resolver_ingredientes(jsonb) from public, anon;
revoke all on function public.leer_menu_tablas(uuid)       from public, anon;
revoke all on function public.aplicar_cambios_menu(uuid, jsonb) from public, anon;
grant execute on function public.resolver_ingredientes(jsonb) to authenticated;
grant execute on function public.leer_menu_tablas(uuid)       to authenticated;
grant execute on function public.aplicar_cambios_menu(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. En directo
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'plato', 'plato_ingrediente', 'comida_planificada', 'comida_plato', 'nota_comida',
    'almuerzo', 'valoracion_plato', 'ingrediente_excluido'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
