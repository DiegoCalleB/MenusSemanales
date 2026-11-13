-- =============================================================================
-- Notificaciones sin configurar nada a mano (D-139)
--
-- Hasta ahora el aviso diario dependía de (1) un programador de GitHub Actions, que en la práctica
-- llegaba con horas de retraso (y la app solo envía a su hora, así que nunca enviaba), y (2) de
-- poner a mano claves en Railway y en GitHub. Ahora:
--   - La base de datos llama a la app CADA HORA (pg_cron + pg_net), una vez por hogar con móviles
--     suscritos. La app decide qué toca a esa hora (resumen de la mañana, recordatorio de la noche).
--   - El secreto de esa llamada se crea aquí, al azar, y no sale de la base de datos salvo en la
--     propia llamada (HTTPS). La app lo comprueba preguntando a la base de datos.
--   - Las claves VAPID de las notificaciones las crea la app la primera vez y las guarda aquí; la
--     privada solo se entrega a quien presenta el secreto (es decir, a la llamada programada).
-- Sigue funcionando la configuración por variables de Railway si alguien la pone (tiene prioridad).
-- =============================================================================

create table privado.avisos_ajustes (
  id            boolean primary key default true check (id),
  url_app       text not null check (url_app ~ '^https://[a-z0-9.-]+$'),
  secreto       text not null check (secreto ~ '^[0-9a-f]{64}$'),
  vapid_publica text check (vapid_publica ~ '^[A-Za-z0-9_-]{80,100}$'),
  vapid_privada text check (vapid_privada ~ '^[A-Za-z0-9_-]{40,50}$'),
  creado_en     timestamptz not null default now()
);
alter table privado.avisos_ajustes enable row level security;
alter table privado.avisos_ajustes force row level security;
revoke all on privado.avisos_ajustes from public, anon, authenticated;

insert into privado.avisos_ajustes (url_app, secreto)
values ('https://yaestahecho.up.railway.app', encode(extensions.gen_random_bytes(32), 'hex'));

-- ¿Es el secreto de la llamada programada? (Comparación sobre el hash: mismo tiempo siempre.)
create function privado.secreto_avisos_valido(p_secreto text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secreto is not null and p_secreto ~ '^[0-9a-f]{64}$'
     and exists (select 1 from privado.avisos_ajustes a
                  where extensions.digest(a.secreto, 'sha256') = extensions.digest(p_secreto, 'sha256'))
$$;
revoke all on function privado.secreto_avisos_valido(text) from public, anon, authenticated;

-- Las claves de las notificaciones, solo para la llamada programada. null si el secreto no vale.
create function public.claves_de_avisos(p_secreto text)
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
  return (select jsonb_build_object('publica', a.vapid_publica, 'privada', a.vapid_privada)
            from privado.avisos_ajustes a);
end;
$$;
revoke all on function public.claves_de_avisos(text) from public;
grant execute on function public.claves_de_avisos(text) to anon, authenticated;

-- Guarda las claves la primera vez (si ya hay, no las cambia) y devuelve las que quedan.
create function public.guardar_claves_de_avisos(p_secreto text, p_publica text, p_privada text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  update privado.avisos_ajustes
     set vapid_publica = p_publica, vapid_privada = p_privada
   where vapid_publica is null;
  return (select jsonb_build_object('publica', a.vapid_publica, 'privada', a.vapid_privada)
            from privado.avisos_ajustes a);
end;
$$;
revoke all on function public.guardar_claves_de_avisos(text, text, text) from public;
grant execute on function public.guardar_claves_de_avisos(text, text, text) to anon, authenticated;

-- La clave pública (no es secreta): la pide el móvil para suscribirse.
create function public.clave_publica_de_avisos()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.vapid_publica from privado.avisos_ajustes a
$$;
revoke all on function public.clave_publica_de_avisos() from public;
grant execute on function public.clave_publica_de_avisos() to anon, authenticated;

-- Llama a la app: una vez por hogar con móviles suscritos y, mientras no haya claves, una vez sin
-- hogar para que la app las cree. Devuelve cuántas llamadas ha hecho.
create function privado.lanzar_avisos()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ajustes privado.avisos_ajustes;
  v_token   text;
  v_n       integer := 0;
begin
  select * into v_ajustes from privado.avisos_ajustes;
  if v_ajustes is null then
    return 0;
  end if;
  if v_ajustes.vapid_publica is null then
    perform net.http_post(
      url := v_ajustes.url_app || '/api/avisos/diario',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                    'Content-Type', 'application/json'),
      timeout_milliseconds := 30000);
    v_n := v_n + 1;
  end if;
  for v_token in
    select c.token from public.hogar_calendario c
     where exists (select 1 from public.push_suscripcion s where s.hogar_id = c.hogar_id)
  loop
    perform net.http_post(
      url := v_ajustes.url_app || '/api/avisos/diario',
      body := jsonb_build_object('token', v_token),
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                    'Content-Type', 'application/json'),
      timeout_milliseconds := 30000);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function privado.lanzar_avisos() from public, anon, authenticated;

-- Al suscribir un móvil, el hogar necesita su token de calendario (la llamada programada va por
-- hogar con él). Si no lo tenía, se crea.
create function privado.token_para_avisos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hogar_calendario (hogar_id, token, creado_por)
  values (new.hogar_id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          new.user_id)
  on conflict (hogar_id) do nothing;
  return new;
end;
$$;
revoke all on function privado.token_para_avisos() from public, anon, authenticated;
create trigger push_suscripcion_token_avisos
  after insert on public.push_suscripcion
  for each row execute function privado.token_para_avisos();

-- «Enviarme una prueba» (desde la app, con sesión): la base de datos pide a la app que mande una
-- notificación de prueba a ESE móvil, que tiene que ser una suscripción de este usuario en este hogar.
create function public.pedir_prueba_push(p_hogar_id uuid, p_endpoint text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ajustes privado.avisos_ajustes;
  v_token   text;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  if not exists (select 1 from public.push_suscripcion s
                  where s.hogar_id = p_hogar_id and s.endpoint = p_endpoint
                    and s.user_id = (select auth.uid())) then
    return false;
  end if;
  select * into v_ajustes from privado.avisos_ajustes;
  select c.token into v_token from public.hogar_calendario c where c.hogar_id = p_hogar_id;
  if v_ajustes is null or v_ajustes.vapid_publica is null or v_token is null then
    return false;
  end if;
  perform net.http_post(
    url := v_ajustes.url_app || '/api/avisos/diario',
    body := jsonb_build_object('token', v_token, 'prueba', p_endpoint),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                  'Content-Type', 'application/json'),
    timeout_milliseconds := 30000);
  return true;
end;
$$;
revoke all on function public.pedir_prueba_push(uuid, text) from public, anon;
grant execute on function public.pedir_prueba_push(uuid, text) to authenticated;

-- El programador: cada hora, a y 3. Solo donde existen pg_cron y pg_net (Supabase); en el Postgres
-- de los tests no están y la migración sigue sin ellos.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_net with schema extensions;
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('avisos-cada-hora', '3 * * * *', 'select privado.lanzar_avisos()');
  end if;
end;
$$;
