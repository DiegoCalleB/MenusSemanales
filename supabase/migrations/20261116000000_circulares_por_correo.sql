-- =============================================================================
-- Circulares del cole por correo (D-147)
--
-- Cada hogar tiene una dirección propia (hecho-<código>@<dominio de recepción>). Lo que se reenvía
-- ahí lo recibe Resend, la app lo lee con IA y lo deja aquí, pendiente de revisar: la familia
-- elige qué apuntar (nada se apunta solo). Al llegar, se manda una notificación a los móviles.
--
-- El código de la dirección es la llave: quien no lo sabe no puede dejar nada en el hogar. Tiene
-- 16 caracteres aleatorios y se puede cambiar (la dirección vieja deja de valer).
-- =============================================================================

create table privado.hogar_correo (
  hogar_id  uuid primary key references public.hogar (id) on delete cascade,
  codigo    text not null unique check (codigo ~ '^[a-z0-9]{16}$'),
  creado_en timestamptz not null default now()
);
alter table privado.hogar_correo enable row level security;
alter table privado.hogar_correo force row level security;
revoke all on privado.hogar_correo from public, anon, authenticated;

create table public.circular_correo (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogar (id) on delete cascade,
  email_id    text not null unique check (char_length(email_id) between 1 and 100),
  asunto      text not null default '' check (char_length(asunto) <= 200),
  items       jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 30),
  recibida_en timestamptz not null default now(),
  revisada_en timestamptz
);
create index circular_correo_hogar_idx on public.circular_correo (hogar_id, recibida_en desc);
alter table public.circular_correo enable row level security;
alter table public.circular_correo force row level security;
revoke all on public.circular_correo from public, anon, authenticated;
grant select on public.circular_correo to authenticated;
create policy circular_correo_select on public.circular_correo for select to authenticated
  using ((select privado.es_miembro(hogar_id)));

-- La dirección del hogar (para enseñarla en la app): la crea la primera vez. Solo miembros.
-- Con p_nueva, cambia el código (la dirección anterior deja de valer).
create function public.codigo_circulares(p_hogar_id uuid, p_nueva boolean default false)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_codigo text;
begin
  if (select auth.uid()) is null or not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  select c.codigo into v_codigo from privado.hogar_correo c where c.hogar_id = p_hogar_id;
  if v_codigo is null or p_nueva then
    v_codigo := substr(encode(extensions.gen_random_bytes(16), 'hex'), 1, 16);
    insert into privado.hogar_correo (hogar_id, codigo) values (p_hogar_id, v_codigo)
    on conflict (hogar_id) do update set codigo = excluded.codigo, creado_en = now();
  end if;
  return v_codigo;
end;
$$;
revoke all on function public.codigo_circulares(uuid, boolean) from public, anon;
grant execute on function public.codigo_circulares(uuid, boolean) to authenticated;

-- Guarda lo leído de un correo (lo llama la app al recibirlo). Con un código que no existe, null.
-- El mismo correo dos veces (Resend reintenta) no se duplica. Como mucho 20 al día por hogar.
-- Si el hogar tiene calendario suscrito y están los avisos programados, avisa a los móviles.
create function public.guardar_circular_correo(
  p_codigo text, p_email_id text, p_asunto text, p_items jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar   uuid;
  v_id      uuid;
  v_ajustes privado.avisos_ajustes;
  v_token   text;
begin
  if p_codigo is null or p_codigo !~ '^[a-z0-9]{16}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from privado.hogar_correo c where c.codigo = p_codigo;
  if v_hogar is null then
    return null;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 30
     or exists (
       select 1 from jsonb_array_elements(p_items) x
        where jsonb_typeof(x) <> 'object'
           or jsonb_typeof(x->'titulo') is distinct from 'string'
           or char_length(x->>'titulo') not between 1 and 200
           or (x->>'tipo') not in ('cita', 'tarea')) then
    return 'no-valido';
  end if;
  if (select count(*) from public.circular_correo c
       where c.hogar_id = v_hogar and c.recibida_en > now() - interval '1 day') >= 20 then
    return 'demasiadas';
  end if;
  insert into public.circular_correo (hogar_id, email_id, asunto, items)
  values (v_hogar, left(p_email_id, 100), left(coalesce(p_asunto, ''), 200), p_items)
  on conflict (email_id) do nothing
  returning id into v_id;
  if v_id is null then
    return 'repetida';
  end if;

  -- La notificación: la manda la app con la llamada de los avisos (D-139).
  select * into v_ajustes from privado.avisos_ajustes;
  select k.token into v_token from public.hogar_calendario k where k.hogar_id = v_hogar;
  if v_ajustes is not null and v_token is not null then
    perform net.http_post(
      url := v_ajustes.url_app || '/api/avisos/diario',
      body := jsonb_build_object(
        'token', v_token,
        'circular', jsonb_build_object('asunto', left(coalesce(p_asunto, ''), 120),
                                       'cosas', jsonb_array_length(p_items))),
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                    'Content-Type', 'application/json'),
      timeout_milliseconds := 20000);
  end if;
  return 'guardada';
end;
$$;
revoke all on function public.guardar_circular_correo(text, text, text, jsonb) from public;
grant execute on function public.guardar_circular_correo(text, text, text, jsonb) to anon, authenticated;

-- Marca una circular como revisada (apuntada o descartada). Solo miembros.
create function public.revisar_circular_correo(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.circular_correo c set revisada_en = now()
   where c.id = p_id and c.revisada_en is null and privado.es_miembro(c.hogar_id);
  return found;
end;
$$;
revoke all on function public.revisar_circular_correo(uuid) from public, anon;
grant execute on function public.revisar_circular_correo(uuid) to authenticated;

-- Las circulares por revisar del hogar (las 10 últimas). Solo miembros.
create function public.circulares_pendientes(p_hogar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'asunto', c.asunto, 'items', c.items,
                                        'recibidaEn', c.recibida_en) order by c.recibida_en desc)
      from (select * from public.circular_correo x
             where x.hogar_id = p_hogar_id and x.revisada_en is null
             order by x.recibida_en desc limit 10) c), '[]'::jsonb);
end;
$$;
revoke all on function public.circulares_pendientes(uuid) from public, anon;
grant execute on function public.circulares_pendientes(uuid) to authenticated;
