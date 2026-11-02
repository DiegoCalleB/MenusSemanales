-- =============================================================================
-- Calendario suscrito con avisos (D-083)
--
-- El calendario del móvil se suscribe a un enlace de la app y avisa solo, con la app cerrada. Ese
-- enlace lleva un token secreto por hogar. Quien tiene el token lee un RESUMEN mínimo del plan
-- (cenas, comidas, fechas, apuntes, tareas de la casa, cumpleaños). Nunca las ideas ni el estado
-- de los regalos, ni la despensa, la compra o los menús del cole.
--
-- - `hogar_calendario`: el token de cada hogar. Sin acceso directo para nadie (RLS sin políticas).
-- - `enlace_calendario`: un miembro lo lee (o lo crea) y puede renovarlo (el viejo deja de valer).
-- - `estado_para_calendario`: lo llama el servidor de la app con la clave pública (anon) y el token.
-- =============================================================================

create table public.hogar_calendario (
  hogar_id   uuid primary key references public.hogar (id) on delete cascade,
  token      text not null unique check (token ~ '^[0-9a-f]{64}$'),
  creado_en  timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null
);
create index hogar_calendario_creado_por_idx on public.hogar_calendario (creado_por);

alter table public.hogar_calendario enable row level security;
alter table public.hogar_calendario force row level security;
revoke all on public.hogar_calendario from anon, authenticated, public;
-- Política explícita de «nadie»: solo se toca a través de las funciones de abajo.
create policy hogar_calendario_sin_acceso_directo on public.hogar_calendario
  for all to anon, authenticated using (false) with check (false);

-- Lee el enlace del hogar (lo crea la primera vez). Con p_renovar, genera uno nuevo y el anterior
-- deja de funcionar.
create function public.enlace_calendario(p_hogar_id uuid, p_renovar boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;

  if p_renovar then
    insert into public.hogar_calendario (hogar_id, token, creado_por)
    values (p_hogar_id, v_token, v_user)
    on conflict (hogar_id) do update
      set token = excluded.token, creado_en = now(), creado_por = excluded.creado_por
    returning token into v_token;
  else
    insert into public.hogar_calendario (hogar_id, token, creado_por)
    values (p_hogar_id, v_token, v_user)
    on conflict (hogar_id) do nothing;
    select c.token into v_token from public.hogar_calendario c where c.hogar_id = p_hogar_id;
  end if;
  return v_token;
end;
$$;

revoke all on function public.enlace_calendario(uuid, boolean) from public, anon;
grant execute on function public.enlace_calendario(uuid, boolean) to authenticated;

-- Un valor de jsonb como lista (o vacío si no lo es): el estado lo escribe la app, pero no se fía.
create function privado.lista(p_valor jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_valor) = 'array' then p_valor else '[]'::jsonb end
$$;
revoke all on function privado.lista(jsonb) from public;

-- El resumen para el calendario de quien tiene el token; null si el token no existe o no es válido.
create function public.estado_para_calendario(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_estado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select e.estado into v_estado
    from public.hogar_calendario c
    join public.hogar_estado e on e.hogar_id = c.hogar_id
   where c.token = p_token;
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
    -- Cumpleaños: solo quién, cuándo y de qué persona del hogar es. Nunca ideas, gustos ni regalo.
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
