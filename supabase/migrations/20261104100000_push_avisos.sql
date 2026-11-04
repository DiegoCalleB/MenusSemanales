-- =============================================================================
-- Notificaciones push: a qué móviles avisar (D-115)
--
-- Cada móvil que activa las notificaciones guarda aquí su «suscripción» (la dirección de su
-- servicio de notificaciones y dos claves). Solo la persona que la creó la ve y la puede quitar.
-- El servidor que manda el aviso diario no tiene sesión: lee las suscripciones de un hogar con el
-- token secreto de su calendario (el mismo del enlace .ics), nunca con una clave maestra.
-- =============================================================================

create table public.push_suscripcion (
  id         uuid primary key default gen_random_uuid(),
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 8 and 100),
  creado_en  timestamptz not null default now()
);
create index push_suscripcion_hogar_idx on public.push_suscripcion (hogar_id);
create index push_suscripcion_user_idx  on public.push_suscripcion (user_id);

alter table public.push_suscripcion enable row level security;
alter table public.push_suscripcion force row level security;
revoke all on public.push_suscripcion from anon, authenticated, public;
grant select, insert, delete on public.push_suscripcion to authenticated;

create policy push_suscripcion_propia_select on public.push_suscripcion for select to authenticated
  using (user_id = (select auth.uid()) and (select privado.es_miembro(hogar_id)));
create policy push_suscripcion_propia_insert on public.push_suscripcion for insert to authenticated
  with check (user_id = (select auth.uid()) and (select privado.es_miembro(hogar_id)));
create policy push_suscripcion_propia_delete on public.push_suscripcion for delete to authenticated
  using (user_id = (select auth.uid()));

-- Guarda (o renueva) la suscripción de este móvil. Si el móvil ya estaba, se sustituye.
create function public.guardar_suscripcion_push(p_hogar_id uuid, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
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
  delete from public.push_suscripcion where endpoint = p_endpoint and user_id = (select auth.uid());
  insert into public.push_suscripcion (hogar_id, endpoint, p256dh, auth)
  values (p_hogar_id, p_endpoint, p_p256dh, p_auth);
end;
$$;

-- Quita la suscripción de este móvil (al desactivar las notificaciones).
create function public.quitar_suscripcion_push(p_endpoint text)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.push_suscripcion where endpoint = p_endpoint and user_id = (select auth.uid());
$$;

-- Para el servidor del aviso diario: las suscripciones del hogar de un token de calendario.
create function public.suscripciones_para_avisos(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_hogar uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return '[]'::jsonb;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                     order by s.creado_en)
      from public.push_suscripcion s where s.hogar_id = v_hogar), '[]'::jsonb);
end;
$$;

-- Cuando el servicio de notificaciones dice que una dirección ya no existe, se olvida.
create function public.olvidar_suscripcion_push(p_token text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return;
  end if;
  delete from public.push_suscripcion where hogar_id = v_hogar and endpoint = p_endpoint;
end;
$$;

revoke all on function public.guardar_suscripcion_push(uuid, text, text, text) from public, anon;
revoke all on function public.quitar_suscripcion_push(text)                    from public, anon;
revoke all on function public.suscripciones_para_avisos(text)                  from public;
revoke all on function public.olvidar_suscripcion_push(text, text)             from public;
grant execute on function public.guardar_suscripcion_push(uuid, text, text, text) to authenticated;
grant execute on function public.quitar_suscripcion_push(text)                    to authenticated;
grant execute on function public.suscripciones_para_avisos(text)                  to anon, authenticated;
grant execute on function public.olvidar_suscripcion_push(text, text)             to anon, authenticated;
