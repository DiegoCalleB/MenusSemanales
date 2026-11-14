-- =============================================================================
-- El calendario escolar de cada curso, leído solo cada mes (D-146)
--
-- «Que sea capaz de leer el calendario cada mes sin tener que hacer nada». Una vez al mes la base
-- de datos llama a la app (como los avisos, D-139, con el mismo secreto). La app busca el
-- calendario del curso siguiente en la web de la Comunidad de Madrid, lo lee dos veces con IA, lo
-- valida (Navidad, Semana Santa, festivos fijos, 175-190 días lectivos) y, si todo cuadra, lo
-- guarda aquí. Es información pública: cualquiera la puede leer, pero solo la llamada programada
-- (con el secreto) la puede escribir.
-- =============================================================================

create table privado.calendario_escolar (
  anio_inicio integer primary key check (anio_inicio between 2026 and 2100),
  curso       jsonb not null check (jsonb_typeof(curso) = 'object' and pg_column_size(curso) < 20000),
  huella      text not null check (huella ~ '^[0-9a-f]{64}$'),
  cargado_en  timestamptz not null default now(),
  cambiado_en timestamptz not null default now()
);
alter table privado.calendario_escolar enable row level security;
alter table privado.calendario_escolar force row level security;
revoke all on privado.calendario_escolar from public, anon, authenticated;

-- La última comprobación (una sola fila): cuándo y qué pasó, para enseñarlo en la app.
create table privado.calendario_escolar_comprobacion (
  id            boolean primary key default true check (id),
  comprobado_en timestamptz not null default now(),
  resultado     text not null check (length(resultado) <= 300)
);
alter table privado.calendario_escolar_comprobacion enable row level security;
alter table privado.calendario_escolar_comprobacion force row level security;
revoke all on privado.calendario_escolar_comprobacion from public, anon, authenticated;

-- Lo que sabe la app: los cursos leídos y la última comprobación. Público (no hay nada privado).
create function public.calendarios_escolares()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cursos', coalesce((
      select jsonb_agg(jsonb_build_object('anio', c.anio_inicio, 'curso', c.curso,
                                          'cambiadoEn', c.cambiado_en) order by c.anio_inicio)
        from privado.calendario_escolar c), '[]'::jsonb),
    'comprobadoEn', (select k.comprobado_en from privado.calendario_escolar_comprobacion k),
    'resultado', (select k.resultado from privado.calendario_escolar_comprobacion k))
$$;
revoke all on function public.calendarios_escolares() from public;
grant execute on function public.calendarios_escolares() to anon, authenticated;

-- Guarda un curso (solo con el secreto). Devuelve 'nuevo', 'cambiado' o 'igual'; null si no vale.
create function public.guardar_calendario_escolar(
  p_secreto text, p_anio integer, p_curso jsonb, p_huella text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_antes text;
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  select c.huella into v_antes from privado.calendario_escolar c where c.anio_inicio = p_anio;
  if v_antes = p_huella then
    return 'igual';
  end if;
  insert into privado.calendario_escolar (anio_inicio, curso, huella)
  values (p_anio, p_curso, p_huella)
  on conflict (anio_inicio) do update
    set curso = excluded.curso, huella = excluded.huella, cambiado_en = now();
  return case when v_antes is null then 'nuevo' else 'cambiado' end;
end;
$$;
revoke all on function public.guardar_calendario_escolar(text, integer, jsonb, text) from public;
grant execute on function public.guardar_calendario_escolar(text, integer, jsonb, text) to anon, authenticated;

-- Apunta el resultado de la comprobación (solo con el secreto).
create function public.anotar_comprobacion_calendario(p_secreto text, p_resultado text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return false;
  end if;
  insert into privado.calendario_escolar_comprobacion (id, comprobado_en, resultado)
  values (true, now(), left(coalesce(p_resultado, ''), 300))
  on conflict (id) do update set comprobado_en = now(), resultado = excluded.resultado;
  return true;
end;
$$;
revoke all on function public.anotar_comprobacion_calendario(text, text) from public;
grant execute on function public.anotar_comprobacion_calendario(text, text) to anon, authenticated;

-- La llamada a la app.
create function privado.lanzar_calendario_escolar()
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
    url := v_ajustes.url_app || '/api/calendario-escolar/comprobar',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                  'Content-Type', 'application/json'),
    timeout_milliseconds := 300000);
  return true;
end;
$$;
revoke all on function privado.lanzar_calendario_escolar() from public, anon, authenticated;

-- Cada mes, el día 1 a las 7:41 UTC. Solo donde hay pg_cron (Supabase); en los tests no.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('calendario-escolar-mensual', '41 7 1 * *',
                          'select privado.lanzar_calendario_escolar()');
  end if;
end;
$$;
