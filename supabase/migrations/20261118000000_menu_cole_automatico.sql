-- =============================================================================
-- El menú del cole se lee solo (D-173)
--
-- El colegio publica cada mes el menú en su blog (un enlace al PDF). Un colegio (`centro`) puede
-- tener ahora la dirección de ese blog (`fuente_menu`, solo blogspot, solo la lista de entradas de
-- una etiqueta). La base de datos llama cada día a la app (pg_cron, como los avisos, D-139, con el
-- mismo secreto); la app mira si hay un mes nuevo, lo lee con IA y lo deja aquí con la función de
-- abajo, que solo se puede llamar con el secreto.
--
-- Lo que ya hay en un día (lo apuntado o corregido a mano) manda: la carga automática solo rellena
-- los días que faltan. Cada entrada leída se anota (`privado.menu_cole_fuente`) para no repetirla.
-- =============================================================================

alter table public.centro
  add column fuente_menu text check (
    fuente_menu is null
    or fuente_menu ~ '^https://[a-z0-9-]+\.blogspot\.com/feeds/posts/default/-/[A-Za-z0-9%_-]+$');

create table privado.menu_cole_fuente (
  centro_id uuid not null references public.centro (id) on delete cascade,
  post      text not null check (char_length(post) between 1 and 300),
  visto_en  timestamptz not null default now(),
  resultado text not null check (char_length(resultado) <= 300),
  intentos  integer not null default 1,
  dias      integer not null default 0,
  primary key (centro_id, post)
);
alter table privado.menu_cole_fuente enable row level security;
alter table privado.menu_cole_fuente force row level security;
revoke all on privado.menu_cole_fuente from public, anon, authenticated;

-- Los colegios con blog y los enlaces de los hogares (para avisar a sus móviles). Solo con el secreto.
create function public.centros_con_menu_automatico(p_secreto text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'centro', c.id, 'fuente', c.fuente_menu,
             'tokens', coalesce((
               select jsonb_agg(k.token)
                 from public.centro_hogar ch
                 join public.hogar_calendario k on k.hogar_id = ch.hogar_id
                where ch.centro_id = c.id), '[]'::jsonb)))
      from public.centro c where c.fuente_menu is not null), '[]'::jsonb);
end;
$$;
revoke all on function public.centros_con_menu_automatico(text) from public;
grant execute on function public.centros_con_menu_automatico(text) to anon, authenticated;

-- Lo ya leído de ese colegio (las entradas del blog y qué pasó). Solo con el secreto.
create function public.fuentes_menu_vistas(p_secreto text, p_centro uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('post', f.post, 'resultado', f.resultado,
                                        'intentos', f.intentos, 'vistoEn', f.visto_en)
                     order by f.visto_en desc)
      from privado.menu_cole_fuente f where f.centro_id = p_centro), '[]'::jsonb);
end;
$$;
revoke all on function public.fuentes_menu_vistas(text, uuid) from public;
grant execute on function public.fuentes_menu_vistas(text, uuid) to anon, authenticated;

-- Anota una entrada del blog y, si trae días, los carga (sin pisar los que ya hay). Devuelve
-- «cargado:N» (N días nuevos) o el resultado anotado; null si el secreto o los datos no valen.
-- Formato de `p_dias`: [{fecha, primero, segundo, postre, guarnicion, kcal, grupoPrimero, grupoSegundo}]
create function public.registrar_menu_cole_automatico(
  p_secreto text, p_centro uuid, p_post text, p_resultado text, p_dias jsonb default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_nuevos integer := 0;
  v_resultado text;
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  if p_post is null or char_length(p_post) not between 1 and 300
     or not exists (select 1 from public.centro c where c.id = p_centro and c.fuente_menu is not null) then
    return null;
  end if;

  if p_dias is not null then
    if jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) > 45 then
      return null;
    end if;
    with nuevos as (
      insert into public.menu_cole_dia (centro_id, fecha, primero, segundo, postre, guarnicion, kcal,
                                        grupo_primero, grupo_segundo)
      select p_centro, x.fecha, x.primero, x.segundo, x.postre, x.guarnicion, x.kcal,
             x."grupoPrimero", x."grupoSegundo"
        from jsonb_to_recordset(p_dias)
             as x(fecha date, primero text, segundo text, postre text, guarnicion text, kcal smallint,
                  "grupoPrimero" text, "grupoSegundo" text)
      on conflict (centro_id, fecha) do nothing
      returning 1)
    select count(*) into v_nuevos from nuevos;
    v_resultado := 'cargado:' || v_nuevos;
  else
    v_resultado := left(coalesce(p_resultado, 'sin-resultado'), 300);
  end if;

  insert into privado.menu_cole_fuente (centro_id, post, resultado, dias)
  values (p_centro, p_post, v_resultado, v_nuevos)
  on conflict (centro_id, post) do update
    set resultado = excluded.resultado, dias = excluded.dias, visto_en = now(),
        intentos = privado.menu_cole_fuente.intentos + 1;
  return v_resultado;
end;
$$;
revoke all on function public.registrar_menu_cole_automatico(text, uuid, text, text, jsonb) from public;
grant execute on function public.registrar_menu_cole_automatico(text, uuid, text, text, jsonb) to anon, authenticated;

-- La llamada diaria a la app.
create function privado.lanzar_menu_cole()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ajustes privado.avisos_ajustes;
begin
  select * into v_ajustes from privado.avisos_ajustes;
  if v_ajustes is null then
    return false;
  end if;
  perform net.http_post(
    url := v_ajustes.url_app || '/api/menu-cole/sincronizar',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                  'Content-Type', 'application/json'),
    timeout_milliseconds := 300000);
  return true;
end;
$$;
revoke all on function privado.lanzar_menu_cole() from public, anon, authenticated;

-- Cada día a las 6:23 UTC (7:23 u 8:23 en Madrid). Solo donde hay pg_cron (Supabase); en los tests no.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('menu-cole-diario', '23 6 * * *', 'select privado.lanzar_menu_cole()');
  end if;
end;
$$;
