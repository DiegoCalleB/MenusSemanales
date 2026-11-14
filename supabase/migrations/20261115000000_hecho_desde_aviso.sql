-- =============================================================================
-- «Hecho» desde la notificación (D-151)
--
-- La notificación de la noche («🎒 Deja preparado: flauta de Emma») lleva un botón «Hecho». Al
-- pulsarlo, el móvil manda un código de un solo uso y la base de datos marca esas cosas como
-- preparadas en el documento del hogar, sin abrir la app y sin sesión.
--
-- El código lo pide la llamada programada (con el secreto de los avisos, D-139) al mandar la
-- notificación: es aleatorio, vale 36 horas y SOLO sirve para marcar como preparadas las cosas que
-- iban en esa notificación. No da acceso a nada más del hogar: ni a leer ni a cambiar otra cosa.
-- =============================================================================

create table privado.aviso_accion (
  codigo    text primary key check (codigo ~ '^[0-9a-f]{64}$'),
  hogar_id  uuid not null references public.hogar (id) on delete cascade,
  cosas     jsonb not null check (jsonb_typeof(cosas) = 'array'
                                  and jsonb_array_length(cosas) between 1 and 10),
  caduca    timestamptz not null,
  creado_en timestamptz not null default now()
);
create index aviso_accion_hogar_idx on privado.aviso_accion (hogar_id);
create index aviso_accion_caduca_idx on privado.aviso_accion (caduca);
alter table privado.aviso_accion enable row level security;
alter table privado.aviso_accion force row level security;
revoke all on privado.aviso_accion from public, anon, authenticated;

-- Crea el código para las cosas de una notificación (solo con el secreto). null si algo no vale.
-- Cada cosa: {"texto": "Flauta", "personaId": "emma" | null, "para": "2026-11-20"}.
create function public.crear_accion_aviso(p_secreto text, p_token text, p_cosas jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar  uuid;
  v_codigo text;
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return null;
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;
  if p_cosas is null or jsonb_typeof(p_cosas) <> 'array'
     or jsonb_array_length(p_cosas) not between 1 and 10
     or exists (
       select 1 from jsonb_array_elements(p_cosas) x
        where jsonb_typeof(x) <> 'object'
           or jsonb_typeof(x->'texto') is distinct from 'string'
           or char_length(x->>'texto') not between 1 and 120
           or coalesce(x->>'para', '') !~ '^\d{4}-\d{2}-\d{2}$'
           or (x ? 'personaId' and jsonb_typeof(x->'personaId') not in ('string', 'null'))
           or char_length(coalesce(x->>'personaId', '')) > 80) then
    return null;
  end if;
  -- De paso, se olvidan los códigos caducados.
  delete from privado.aviso_accion where caduca < now();
  v_codigo := encode(extensions.gen_random_bytes(32), 'hex');
  insert into privado.aviso_accion (codigo, hogar_id, cosas, caduca)
  values (v_codigo, v_hogar, p_cosas, now() + interval '36 hours');
  return v_codigo;
end;
$$;
revoke all on function public.crear_accion_aviso(text, text, jsonb) from public;
grant execute on function public.crear_accion_aviso(text, text, jsonb) to anon, authenticated;

-- Marca como preparadas las cosas del código. Devuelve cuántas ha marcado ahora (0 si ya lo
-- estaban: pulsar dos veces, o desde dos móviles, no duplica nada); null si el código no vale.
create function public.marcar_hecho_desde_aviso(p_codigo text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_accion  privado.aviso_accion;
  v_estado  jsonb;
  v_mochila jsonb;
  v_marcadas integer;
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into v_accion from privado.aviso_accion a
   where a.codigo = p_codigo and a.caduca > now();
  if v_accion is null then
    return null;
  end if;
  select e.estado into v_estado from public.hogar_estado e
   where e.hogar_id = v_accion.hogar_id
   for update;
  if v_estado is null then
    return 0;
  end if;

  with cosas as (
    select x->>'texto' as texto, coalesce(x->>'personaId', '') as persona, x->>'para' as para
      from jsonb_array_elements(v_accion.cosas) x
  ), mochila as (
    select m, o,
           (select c.para from cosas c
             where c.texto = m->>'texto' and c.persona = coalesce(m->>'personaId', '')
             limit 1) as para
      from jsonb_array_elements(privado.lista(v_estado->'mochila')) with ordinality as t(m, o)
  )
  select coalesce(jsonb_agg(
           case when para is not null and not (privado.lista(m->'preparadas') ? para)
                then jsonb_set(m, '{preparadas}', privado.lista(m->'preparadas') || to_jsonb(para))
                else m end
           order by o), '[]'::jsonb),
         count(*) filter (where para is not null and not (privado.lista(m->'preparadas') ? para))
    into v_mochila, v_marcadas
    from mochila;

  if v_marcadas > 0 then
    -- Como un guardado más: sube la versión y los móviles lo reciben en directo.
    update public.hogar_estado
       set estado = jsonb_set(estado, '{mochila}', v_mochila),
           version = version + 1,
           actualizado_en = now(),
           actualizado_por = null
     where hogar_id = v_accion.hogar_id;
  end if;
  return v_marcadas;
end;
$$;
revoke all on function public.marcar_hecho_desde_aviso(text) from public;
grant execute on function public.marcar_hecho_desde_aviso(text) to anon, authenticated;
