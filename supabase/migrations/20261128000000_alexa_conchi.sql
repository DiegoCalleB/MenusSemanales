-- =============================================================================
-- Conchi (Alexa) más lista (D-215)
--
-- La cola de lo que se pide a Alexa deja de ser solo la compra: ahora guarda también pendientes,
-- citas (ya confirmadas en voz alta) y tareas de casa hechas. Y la IA que reparte una frase libre
-- cuenta en el mismo tope diario que la IA de la app. La llave sigue siendo el token del calendario.
-- =============================================================================

alter table public.compra_alexa rename to alexa_entrada;
alter index public.compra_alexa_hogar_idx rename to alexa_entrada_hogar_idx;
alter table public.alexa_entrada
  add column tipo  text not null default 'compra'
    check (tipo in ('compra', 'pendiente', 'cita', 'hecha')),
  add column fecha date,
  add column hora  text check (hora is null or hora ~ '^\d{2}:\d{2}$');
alter table public.alexa_entrada drop constraint compra_alexa_texto_check;
alter table public.alexa_entrada
  add constraint alexa_entrada_texto_check check (char_length(texto) between 1 and 200);

-- Lo que pide Alexa: compra, pendiente, cita (con día y, si se dijo, hora) o tarea hecha.
-- 'ok', 'no-valido', 'demasiadas' (60 al día) o null si el token no vale.
create function public.alexa_anadir(
  p_token text, p_tipo text, p_texto text, p_fecha date default null, p_hora text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
  v_texto text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  v_texto := btrim(regexp_replace(coalesce(p_texto, ''), '\s+', ' ', 'g'));
  if p_tipo not in ('compra', 'pendiente', 'cita', 'hecha')
     or char_length(v_texto) not between 1 and (case when p_tipo = 'compra' then 80 else 200 end)
     or (p_tipo = 'cita' and p_fecha is null)
     or (p_tipo <> 'cita' and (p_fecha is not null or p_hora is not null))
     or (p_hora is not null and p_hora !~ '^([01]\d|2[0-3]):[0-5]\d$') then
    return 'no-valido';
  end if;
  if (select count(*) from public.alexa_entrada a
       where a.hogar_id = v_hogar and a.creada_en > now() - interval '1 day') >= 60 then
    return 'demasiadas';
  end if;
  insert into public.alexa_entrada (hogar_id, tipo, texto, fecha, hora)
  values (v_hogar, p_tipo, v_texto, p_fecha, p_hora);
  return 'ok';
end;
$$;
revoke all on function public.alexa_anadir(text, text, text, date, text) from public;
grant execute on function public.alexa_anadir(text, text, text, date, text) to anon, authenticated;

-- La de siempre (D-214): la compra. Sigue valiendo.
create or replace function public.alexa_anadir_compra(p_token text, p_texto text)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select public.alexa_anadir(p_token, 'compra', p_texto, null, null);
$$;

-- Recoge todo lo pendiente del hogar y lo marca como recogido a la vez (cada cosa llega a un solo
-- móvil). Devuelve una lista de {tipo, texto, fecha, hora}. Solo miembros.
create function public.recoger_entradas_alexa(p_hogar_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_lista jsonb;
begin
  if (select auth.uid()) is null or not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  with r as (
    update public.alexa_entrada a set recogida_en = now()
     where a.hogar_id = p_hogar_id and a.recogida_en is null
    returning a.tipo, a.texto, a.fecha, a.hora, a.creada_en)
  select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'texto', r.texto, 'fecha', r.fecha, 'hora', r.hora)
                   order by r.creada_en)
    into v_lista from r;
  return coalesce(v_lista, '[]'::jsonb);
end;
$$;
revoke all on function public.recoger_entradas_alexa(uuid) from public, anon;
grant execute on function public.recoger_entradas_alexa(uuid) to authenticated;

-- La anterior solo recogía compras (D-214): se queda para los móviles con la app antigua.
create or replace function public.recoger_compra_alexa(p_hogar_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_textos jsonb;
begin
  if (select auth.uid()) is null or not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  with r as (
    update public.alexa_entrada a set recogida_en = now()
     where a.hogar_id = p_hogar_id and a.recogida_en is null and a.tipo = 'compra'
    returning a.texto, a.creada_en)
  select jsonb_agg(r.texto order by r.creada_en) into v_textos from r;
  return coalesce(v_textos, '[]'::jsonb);
end;
$$;

-- Una llamada de IA de Conchi (una frase libre), con el mismo tope diario que la IA de la app.
-- 'ok', 'tope' (ya se gastó el de hoy) o null si el token no vale.
create function public.alexa_usar_ia(p_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar  uuid;
  v_limite integer;
  v_dia    date := (now() at time zone 'Europe/Madrid')::date;
  v_usadas integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  select coalesce((select a.limite_diario from public.ia_ajuste a where a.hogar_id = v_hogar), 40)
    into v_limite;
  insert into public.ia_uso (hogar_id, dia, usadas) values (v_hogar, v_dia, 0)
  on conflict (hogar_id, dia) do nothing;
  update public.ia_uso set usadas = usadas + 1
   where hogar_id = v_hogar and dia = v_dia and usadas < v_limite
  returning usadas into v_usadas;
  return case when v_usadas is null then 'tope' else 'ok' end;
end;
$$;
revoke all on function public.alexa_usar_ia(text) from public;
grant execute on function public.alexa_usar_ia(text) to anon, authenticated;
