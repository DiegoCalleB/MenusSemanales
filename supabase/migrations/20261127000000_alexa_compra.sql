-- =============================================================================
-- Alexa → lista de la compra (D-214)
--
-- «Alexa, dile a Hecho que añada leche»: la skill llama a la app y la app guarda aquí lo pedido,
-- pendiente de recoger. El móvil que abra la app lo recoge (una sola vez, aunque haya dos móviles)
-- y lo añade a la lista de la compra. La llave es el token del calendario del hogar, el mismo que
-- ya usa el servidor; sin token válido no se guarda nada. Como mucho 40 productos al día.
-- =============================================================================

create table public.compra_alexa (
  id         uuid primary key default gen_random_uuid(),
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  texto      text not null check (char_length(texto) between 1 and 80),
  creada_en  timestamptz not null default now(),
  recogida_en timestamptz
);
create index compra_alexa_hogar_idx on public.compra_alexa (hogar_id, creada_en desc);
alter table public.compra_alexa enable row level security;
alter table public.compra_alexa force row level security;
revoke all on public.compra_alexa from public, anon, authenticated;

-- Lo que pide Alexa (lo llama el servidor con la clave pública y el token). Devuelve 'ok',
-- 'no-valido' (vacío o demasiado largo), 'demasiadas' o null si el token no vale.
create function public.alexa_anadir_compra(p_token text, p_texto text)
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
  if char_length(v_texto) not between 1 and 80 then
    return 'no-valido';
  end if;
  if (select count(*) from public.compra_alexa a
       where a.hogar_id = v_hogar and a.creada_en > now() - interval '1 day') >= 40 then
    return 'demasiadas';
  end if;
  insert into public.compra_alexa (hogar_id, texto) values (v_hogar, v_texto);
  return 'ok';
end;
$$;
revoke all on function public.alexa_anadir_compra(text, text) from public;
grant execute on function public.alexa_anadir_compra(text, text) to anon, authenticated;

-- Recoge lo pendiente del hogar y lo marca como recogido a la vez: si dos móviles preguntan al
-- mismo tiempo, cada producto lo recibe uno solo. Solo miembros.
create function public.recoger_compra_alexa(p_hogar_id uuid)
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
    update public.compra_alexa a set recogida_en = now()
     where a.hogar_id = p_hogar_id and a.recogida_en is null
    returning a.texto, a.creada_en)
  select jsonb_agg(r.texto order by r.creada_en) into v_textos from r;
  return coalesce(v_textos, '[]'::jsonb);
end;
$$;
revoke all on function public.recoger_compra_alexa(uuid) from public, anon;
grant execute on function public.recoger_compra_alexa(uuid) to authenticated;
