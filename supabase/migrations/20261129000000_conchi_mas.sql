-- =============================================================================
-- Conchi, más completa (D-216)
--
-- Deshacer lo último, quitar de la compra, leer lo que hay en la compra, avisar a los móviles de
-- la familia cuando Conchi apunta algo, y saber quién habla (una voz de Alexa ↔ una persona de la
-- familia). La llave sigue siendo el token del calendario del hogar.
-- =============================================================================

-- 1. Más tipos en la cola: quitar de la compra, de pendientes o una cita.
alter table public.alexa_entrada drop constraint if exists alexa_entrada_tipo_check;
alter table public.alexa_entrada
  add constraint alexa_entrada_tipo_check check (tipo in (
    'compra', 'pendiente', 'cita', 'hecha', 'quitar_compra', 'quitar_pendiente', 'quitar_cita'));
alter table public.alexa_entrada add column deshecha boolean not null default false;

create or replace function public.alexa_anadir(
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
  if p_tipo not in ('compra', 'pendiente', 'cita', 'hecha',
                    'quitar_compra', 'quitar_pendiente', 'quitar_cita')
     or char_length(v_texto) not between 1 and
        (case when p_tipo in ('compra', 'quitar_compra') then 80 else 200 end)
     or (p_tipo in ('cita', 'quitar_cita') and p_fecha is null)
     or (p_tipo not in ('cita', 'quitar_cita') and (p_fecha is not null or p_hora is not null))
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

-- 2. «Borra lo último»: la última compra, pendiente o cita apuntada por voz en las dos últimas
-- horas (que no se haya deshecho ya) se quita. Devuelve {tipo, texto} de lo quitado, o null.
create function public.alexa_deshacer(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
  v_e     public.alexa_entrada;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  select * into v_e from public.alexa_entrada a
   where a.hogar_id = v_hogar and a.tipo in ('compra', 'pendiente', 'cita')
     and not a.deshecha and a.creada_en > now() - interval '2 hours'
   order by a.creada_en desc limit 1
   for update;
  if v_e.id is null then
    return null;
  end if;
  update public.alexa_entrada set deshecha = true where id = v_e.id;
  insert into public.alexa_entrada (hogar_id, tipo, texto, fecha, hora)
  values (v_hogar, 'quitar_' || v_e.tipo, v_e.texto, v_e.fecha, v_e.hora);
  return jsonb_build_object('tipo', v_e.tipo, 'texto', v_e.texto);
end;
$$;
revoke all on function public.alexa_deshacer(text) from public;
grant execute on function public.alexa_deshacer(text) to anon, authenticated;

-- 3. Lo que hay apuntado a mano en la compra y sigue sin comprar (nombres, hasta 60).
create function public.alexa_compra(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(left(x->>'nombre', 80))
      from (select x from jsonb_array_elements(privado.lista(
              (select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'manuales')) x
             where coalesce(x->>'comprado', 'false') <> 'true' and x->>'nombre' is not null
             limit 60) t(x)), '[]'::jsonb);
end;
$$;
revoke all on function public.alexa_compra(text) from public;
grant execute on function public.alexa_compra(text) to anon, authenticated;

-- 4. Avisar a los móviles de la familia de lo que ha apuntado Conchi. Como mucho una vez cada 15
-- segundos por hogar (una frase con varias cosas manda una sola notificación).
create table public.alexa_aviso (
  hogar_id uuid primary key references public.hogar (id) on delete cascade,
  ultimo   timestamptz not null default now()
);
alter table public.alexa_aviso enable row level security;
alter table public.alexa_aviso force row level security;
revoke all on public.alexa_aviso from public, anon, authenticated;

create function public.alexa_avisar(p_token text, p_texto text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar   uuid;
  v_ajustes privado.avisos_ajustes;
  v_toca    boolean;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$'
     or char_length(btrim(coalesce(p_texto, ''))) not between 1 and 200 then
    return false;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return false;
  end if;
  insert into public.alexa_aviso (hogar_id, ultimo) values (v_hogar, now() - interval '1 minute')
  on conflict (hogar_id) do nothing;
  update public.alexa_aviso set ultimo = now()
   where hogar_id = v_hogar and ultimo < now() - interval '15 seconds'
  returning true into v_toca;
  if not coalesce(v_toca, false) then
    return false;
  end if;
  select * into v_ajustes from privado.avisos_ajustes;
  if v_ajustes is null then
    return false;
  end if;
  perform net.http_post(
    url := v_ajustes.url_app || '/api/avisos/diario',
    body := jsonb_build_object('token', p_token,
                               'conchi', jsonb_build_object('texto', left(btrim(p_texto), 200))),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_ajustes.secreto,
                                  'Content-Type', 'application/json'),
    timeout_milliseconds := 20000);
  return true;
end;
$$;
revoke all on function public.alexa_avisar(text, text) from public;
grant execute on function public.alexa_avisar(text, text) to anon, authenticated;

-- 5. Quién habla: una voz de Alexa (su identificador de persona) ↔ una persona de la familia.
create table public.alexa_voz (
  hogar_id uuid not null references public.hogar (id) on delete cascade,
  voz      text not null check (char_length(voz) between 10 and 300),
  persona  text not null check (persona ~ '^[a-z0-9_-]{1,40}$'),
  primary key (hogar_id, voz)
);
alter table public.alexa_voz enable row level security;
alter table public.alexa_voz force row level security;
revoke all on public.alexa_voz from public, anon, authenticated;

create function public.alexa_vincular_voz(p_token text, p_voz text, p_persona text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  if p_voz is null or char_length(p_voz) not between 10 and 300
     or p_persona is null or p_persona !~ '^[a-z0-9_-]{1,40}$' then
    return 'no-valido';
  end if;
  if (select count(*) from public.alexa_voz v where v.hogar_id = v_hogar) >= 12
     and not exists (select 1 from public.alexa_voz v where v.hogar_id = v_hogar and v.voz = p_voz) then
    return 'demasiadas';
  end if;
  insert into public.alexa_voz (hogar_id, voz, persona) values (v_hogar, p_voz, p_persona)
  on conflict (hogar_id, voz) do update set persona = excluded.persona;
  return 'ok';
end;
$$;
revoke all on function public.alexa_vincular_voz(text, text, text) from public;
grant execute on function public.alexa_vincular_voz(text, text, text) to anon, authenticated;

-- La persona de una voz ya vinculada, o null.
create function public.alexa_voz_persona(p_token text, p_voz text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' or p_voz is null then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  return (select v.persona from public.alexa_voz v where v.hogar_id = v_hogar and v.voz = p_voz);
end;
$$;
revoke all on function public.alexa_voz_persona(text, text) from public;
grant execute on function public.alexa_voz_persona(text, text) to anon, authenticated;
