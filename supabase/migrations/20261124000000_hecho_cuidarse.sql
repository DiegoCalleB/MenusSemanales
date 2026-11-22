-- =============================================================================
-- «+1 vaso» y «Hecho» del ejercicio desde la notificación de Cuidarse (D-202)
--
-- Las notificaciones del agua y del ejercicio llevan el mismo botón que la mochila y la medicación:
-- el código de un solo uso, que vale 36 horas, suma un vaso (agua) o marca el ejercicio de ese día en
-- el documento del hogar, de esa persona. El de agua es de un solo uso de verdad (se borra al
-- usarlo: otro toque no suma otro vaso). Cada cosa del código lleva `tipo`: «mochila» (por defecto),
-- «medicacion», «agua» o «ejercicio». Copia de 20261122000000.
-- =============================================================================

-- Suma un vaso (o marca el ejercicio) de esa persona ese día; si no hay nada que cambiar, devuelve el
-- documento tal cual.
create or replace function privado.sumar_cuidado(p_estado jsonb, p_persona text, p_fecha text, p_tipo text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_cuidado jsonb := privado.lista(p_estado->'cuidado');
  v_i       integer;
  v_c       jsonb;
  v_dias    jsonb;
  v_dia     jsonb;
begin
  select (t.o - 1)::integer into v_i
    from jsonb_array_elements(v_cuidado) with ordinality as t(x, o)
   where t.x->>'personaId' = p_persona
   limit 1;
  if v_i is null or p_fecha !~ '^\d{4}-\d{2}-\d{2}$' then
    return p_estado;
  end if;
  v_c := v_cuidado->v_i;
  v_dias := case when jsonb_typeof(v_c->'dias') = 'object' then v_c->'dias' else '{}'::jsonb end;
  v_dia := case when jsonb_typeof(v_dias->p_fecha) = 'object' then v_dias->p_fecha else '{}'::jsonb end;
  -- El día completo, como lo espera la app.
  v_dia := jsonb_build_object(
    'agua', case when jsonb_typeof(v_dia->'agua') = 'number' then v_dia->'agua' else to_jsonb(0) end,
    'ejercicio', case when v_dia->'ejercicio' = 'true'::jsonb then to_jsonb(true) else to_jsonb(false) end,
    'habitos', case when jsonb_typeof(v_dia->'habitos') = 'array' then v_dia->'habitos' else '[]'::jsonb end)
    || (v_dia - 'agua' - 'ejercicio' - 'habitos');
  if p_tipo = 'agua' then
    v_dia := jsonb_set(v_dia, '{agua}', to_jsonb(least((v_dia->>'agua')::integer + 1, 30)));
  elsif p_tipo = 'ejercicio' then
    if v_dia->'ejercicio' = 'true'::jsonb then
      return p_estado;
    end if;
    v_dia := jsonb_set(v_dia, '{ejercicio}', 'true'::jsonb);
  else
    return p_estado;
  end if;
  v_c := jsonb_set(v_c, '{dias}', jsonb_set(v_dias, array[p_fecha], v_dia));
  return jsonb_set(p_estado, '{cuidado}', jsonb_set(v_cuidado, array[v_i::text], v_c));
end;
$$;

create or replace function public.crear_accion_aviso(p_secreto text, p_token text, p_cosas jsonb)
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
           or (x ? 'tipo' and (jsonb_typeof(x->'tipo') is distinct from 'string'
                               or x->>'tipo' not in ('mochila', 'medicacion', 'agua', 'ejercicio')))
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
create or replace function public.marcar_hecho_desde_aviso(p_codigo text)
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
  v_medicacion jsonb;
  v_tomadas integer;
  v_nuevo   jsonb;
  v_cuidado integer := 0;
  v_otro    jsonb;
  r_cosa    record;
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
     where coalesce(x->>'tipo', 'mochila') = 'mochila'
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

  -- Medicación (D-185): la dosis de ese día pasa a «tomada» (por persona y nombre, como la mochila).
  with cosas as (
    select x->>'texto' as texto, coalesce(x->>'personaId', '') as persona, x->>'para' as para
      from jsonb_array_elements(v_accion.cosas) x
     where x->>'tipo' = 'medicacion'
  ), med as (
    select m, o,
           (select c.para from cosas c
             where c.texto = m->>'nombre' and c.persona = coalesce(m->>'personaId', '')
             limit 1) as para
      from jsonb_array_elements(privado.lista(v_estado->'medicacion')) with ordinality as t(m, o)
  )
  select coalesce(jsonb_agg(
           case when para is not null and not (privado.lista(m->'tomadas') ? para)
                then jsonb_set(m, '{tomadas}', privado.lista(m->'tomadas') || to_jsonb(para))
                else m end
           order by o), '[]'::jsonb),
         count(*) filter (where para is not null and not (privado.lista(m->'tomadas') ? para))
    into v_medicacion, v_tomadas
    from med;

  v_nuevo := v_estado;
  if v_marcadas > 0 then v_nuevo := jsonb_set(v_nuevo, '{mochila}', v_mochila); end if;
  if v_tomadas > 0 then v_nuevo := jsonb_set(v_nuevo, '{medicacion}', v_medicacion); end if;

  -- Cuidarse (D-202): un vaso más o el ejercicio de ese día, de esa persona.
  for r_cosa in
    select x->>'tipo' as tipo, coalesce(x->>'personaId', '') as persona, x->>'para' as para
      from jsonb_array_elements(v_accion.cosas) x
     where x->>'tipo' in ('agua', 'ejercicio')
  loop
    v_otro := privado.sumar_cuidado(v_nuevo, r_cosa.persona, r_cosa.para, r_cosa.tipo);
    if v_otro is distinct from v_nuevo then
      v_nuevo := v_otro;
      v_cuidado := v_cuidado + 1;
    end if;
  end loop;
  -- El agua es de un solo uso: otro toque en el mismo aviso no suma otro vaso.
  if exists (select 1 from jsonb_array_elements(v_accion.cosas) x where x->>'tipo' = 'agua') then
    delete from privado.aviso_accion where codigo = p_codigo;
  end if;

  if v_marcadas + v_tomadas + v_cuidado > 0 then
    -- Como un guardado más: sube la versión y los móviles lo reciben en directo.
    update public.hogar_estado
       set estado = v_nuevo,
           version = version + 1,
           actualizado_en = now(),
           actualizado_por = null
     where hogar_id = v_accion.hogar_id;
  end if;
  return v_marcadas + v_tomadas + v_cuidado;
end;
$$;

revoke all on function public.crear_accion_aviso(text, text, jsonb) from public;
grant execute on function public.crear_accion_aviso(text, text, jsonb) to anon, authenticated;
revoke all on function public.marcar_hecho_desde_aviso(text) from public;
grant execute on function public.marcar_hecho_desde_aviso(text) to anon, authenticated;
