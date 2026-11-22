-- =============================================================================
-- Avisos personales y «Posponer» (D-204)
--
-- 1. Cada persona elige qué avisos quiere y a qué hora (agua, ejercicio, objetivos, revisión del
--    domingo): el resumen del servidor lleva ahora, de quien pidió avisos, su `avisosCfg` (solo
--    interruptores y horas). Copia de 20261124010000.
-- 2. «Posponer 1 hora»: la notificación puede llevar un segundo botón. El código de un solo uso de
--    la notificación guarda además el mensaje y, al pulsar el botón, la base de datos lo deja para
--    dentro de unos 50 minutos; la llamada de cada hora lo recoge y lo vuelve a mandar. Hasta 3
--    veces seguidas. El mensaje es el mismo que ya salió por la notificación (nada nuevo).
-- =============================================================================

alter table privado.aviso_accion
  add column if not exists persona text,
  add column if not exists mensaje jsonb,
  add column if not exists repetir_en timestamptz,
  add column if not exists pospuestas integer not null default 0;
create index if not exists aviso_accion_repetir_idx
  on privado.aviso_accion (repetir_en) where repetir_en is not null;

-- La llamada programada guarda el mensaje de la notificación junto a su código.
create or replace function public.recordar_aviso(p_secreto text, p_codigo text, p_persona text, p_mensaje jsonb)
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
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$'
     or p_mensaje is null or jsonb_typeof(p_mensaje) <> 'object'
     or char_length(p_mensaje::text) > 2000
     or char_length(coalesce(p_persona, '')) > 80 then
    return false;
  end if;
  update privado.aviso_accion
     set persona = p_persona, mensaje = p_mensaje
   where codigo = p_codigo and caduca > now();
  return found;
end;
$$;

-- El botón «Posponer» de la notificación: el código es el permiso (aleatorio, caduca y solo sirve
-- para esto). Hasta 3 veces seguidas.
create or replace function public.posponer_aviso(p_codigo text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_codigo is null or p_codigo !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  update privado.aviso_accion
     set repetir_en = now() + interval '50 minutes'
   where codigo = p_codigo and caduca > now()
     and mensaje is not null and repetir_en is null and pospuestas < 3;
  return found;
end;
$$;

-- Lo pospuesto que ya toca de ese hogar: se entrega una sola vez.
create or replace function public.avisos_pospuestos(p_secreto text, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hogar uuid;
  v_sale  jsonb;
begin
  if not privado.secreto_avisos_valido(p_secreto) then
    return '[]'::jsonb;
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return '[]'::jsonb;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return '[]'::jsonb;
  end if;
  with due as (
    update privado.aviso_accion
       set repetir_en = null, pospuestas = pospuestas + 1
     where hogar_id = v_hogar and repetir_en <= now() and caduca > now() and mensaje is not null
     returning codigo, persona, mensaje, pospuestas
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', codigo, 'persona', persona, 'mensaje', mensaje, 'pospuestas', pospuestas)), '[]'::jsonb)
    into v_sale
    from due;
  return v_sale;
end;
$$;

revoke all on function public.recordar_aviso(text, text, text, jsonb) from public;
grant execute on function public.recordar_aviso(text, text, text, jsonb) to anon, authenticated;
revoke all on function public.posponer_aviso(text) from public;
grant execute on function public.posponer_aviso(text) to anon, authenticated;
revoke all on function public.avisos_pospuestos(text, text) from public;
grant execute on function public.avisos_pospuestos(text, text) to anon, authenticated;

create or replace function public.estado_para_calendario(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_hogar  uuid;
  v_estado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select c.hogar_id into v_hogar from public.hogar_calendario c where c.token = p_token;
  if v_hogar is null then
    return null;
  end if;

  -- Hogar con sus datos en tablas.
  if exists (select 1 from public.persona p where p.hogar_id = v_hogar) then
    return jsonb_build_object(
      -- Qué llevar (D-136) sigue en el documento del hogar.
      'mochila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personaId', x->'personaId', 'texto', x->'texto', 'dias', x->'dias',
          'fecha', x->'fecha', 'antes', x->'antes',
          'soloConCole', coalesce(x->'soloConCole' <> 'false'::jsonb, true)))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'mochila')) x), '[]'::jsonb),
      -- Calendario escolar (D-144): lo que apunta la familia, también en el documento.
      'diasCole', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'hay', x->'hay', 'motivo', x->'motivo'))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'diasCole')) x), '[]'::jsonb),
      -- Medicación (D-166): también en el documento del hogar.
      'medicacion', coalesce((
        select jsonb_agg(jsonb_build_object('personaId', x->'personaId', 'nombre', x->'nombre',
                                            'hora', x->'hora', 'dias', x->'dias', 'tomadas', x->'tomadas'))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'medicacion')) x), '[]'::jsonb),
      -- Papeles y vencimientos (D-174): también en el documento del hogar.
      'vencimientos', coalesce((
        select jsonb_agg(jsonb_build_object('titulo', x->'titulo', 'categoria', x->'categoria',
                                            'personaId', x->'personaId', 'fecha', x->'fecha',
                                            'avisos', x->'avisos', 'hechoEn', x->'hechoEn'))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'vencimientos')) x), '[]'::jsonb),
      -- Pendientes sin fecha (D-175): también en el documento del hogar.
      'pendientes', coalesce((
        select jsonb_agg(jsonb_build_object('texto', x->'texto', 'personaId', x->'personaId',
                                            'importante', x->'importante', 'creadoEn', x->'creadoEn',
                                            'hechoEn', x->'hechoEn'))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'pendientes')) x), '[]'::jsonb),
      -- Cuidarse (D-183): solo de quien pidió avisos; agua y ejercicio, nunca los hábitos.
      'cuidado', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'personaId', x->'personaId', 'metaAgua', x->'metaAgua', 'ejercicio', x->'ejercicio',
                 'avisos', (x->'avisos' = 'true'::jsonb),
                 'cfg', x->'avisosCfg',
                 'miDia', case when jsonb_typeof(x->'avisoDia') = 'number'
                               then jsonb_build_object('hora', x->'avisoDia',
                                                       'total', jsonb_array_length(privado.lista(x->'habitos')))
                               else null end,
                 'dias', coalesce((
                   select jsonb_agg(jsonb_build_object('fecha', d.k, 'agua', d.v->'agua', 'ejercicio', d.v->'ejercicio',
                                           'lista', jsonb_array_length(privado.lista(d.v->'habitos'))))
                     from jsonb_each(case when jsonb_typeof(x->'dias') = 'object' then x->'dias' else '{}'::jsonb end) as d(k, v)
                    where d.k ~ '^\d{4}-\d{2}-\d{2}$' and d.k >= (current_date - 3)::text), '[]'::jsonb)))
          from jsonb_array_elements(privado.lista((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)->'cuidado')) x
         where x->'avisos' = 'true'::jsonb or jsonb_typeof(x->'avisoDia') = 'number'), '[]'::jsonb),
      -- Objetivos y notas (D-203): solo cuántos, nunca el texto.
      'objetivos', privado.cuentas_personales((select e.estado from public.hogar_estado e where e.hogar_id = v_hogar)),
      -- Menú del cole (D-141), del colegio del hogar: de ayer a 60 días vista, solo los platos.
      'cole', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', m.fecha::text, 'primero', m.primero, 'segundo', m.segundo, 'postre', m.postre)
               order by m.fecha)
          from public.centro_hogar ch
          join public.menu_cole_dia m on m.centro_id = ch.centro_id
         where ch.hogar_id = v_hogar
           and m.fecha between current_date - 1 and current_date + 60), '[]'::jsonb),
      'personas', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'tipo', p.tipo, 'activa', p.activa)
                         order by p.creado_en, p.nombre)
          from public.persona p where p.hogar_id = v_hogar), '[]'::jsonb),
      -- Una entrada por plato de cada cena, en su orden.
      'cenas', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', c.fecha::text, 'nombre', pl.nombre)
                         order by c.fecha, cp.orden)
          from public.comida_planificada c
          join public.comida_plato cp on cp.comida_id = c.id and cp.hogar_id = c.hogar_id
          join public.plato pl on pl.id = cp.plato_id and pl.hogar_id = cp.hogar_id
         where c.hogar_id = v_hogar and c.momento = 'cena'), '[]'::jsonb),
      'almuerzos', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', a.fecha::text, 'texto', a.texto) order by a.fecha, a.creado_en)
          from public.almuerzo a where a.hogar_id = v_hogar), '[]'::jsonb),
      'eventos', coalesce((
        select jsonb_object_agg(f.fecha::text, jsonb_build_object('titulo', f.titulo, 'emoji', f.emoji))
          from public.fecha_senalada f where f.hogar_id = v_hogar), '{}'::jsonb),
      'agenda', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', a.fecha::text, 'hasta', a.hasta::text, 'hora', to_char(a.hora, 'HH24:MI'), 'titulo', a.titulo)
               order by a.fecha, a.hora nulls first, a.titulo)
          from public.apunte a where a.hogar_id = v_hogar), '[]'::jsonb),
      'casa', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'titulo', t.titulo, 'emoji', t.emoji, 'cadaDias', t.cada_dias,
                 'responsableId', t.responsable_id, 'ultimaVez', t.ultima_vez::text, 'desde', t.desde::text,
                 'aplazadaHasta', t.aplazada_hasta::text)
               order by t.creado_en, t.titulo)
          from public.tarea_casa t where t.hogar_id = v_hogar), '[]'::jsonb),
      -- Cumpleaños: solo quién, cuándo y de qué persona del hogar es. Nunca ideas, gustos ni regalo.
      'cumples', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'nombre', c.nombre, 'dia', c.dia, 'mes', c.mes, 'anio', c.anio, 'personaId', c.persona_id)
               order by c.mes, c.dia, c.nombre)
          from public.cumple c where c.hogar_id = v_hogar), '[]'::jsonb)
    );
  end if;

  -- Hogar que aún solo tiene el documento.
  select e.estado into v_estado from public.hogar_estado e where e.hogar_id = v_hogar;
  if v_estado is null then
    return null;
  end if;
  return jsonb_build_object(
    'mochila', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personaId', x->'personaId', 'texto', x->'texto', 'dias', x->'dias',
          'fecha', x->'fecha', 'antes', x->'antes',
          'soloConCole', coalesce(x->'soloConCole' <> 'false'::jsonb, true)))
          from jsonb_array_elements(privado.lista(v_estado->'mochila')) x), '[]'::jsonb),
    'diasCole', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'hay', x->'hay', 'motivo', x->'motivo'))
          from jsonb_array_elements(privado.lista(v_estado->'diasCole')) x), '[]'::jsonb),
    'medicacion', coalesce((
        select jsonb_agg(jsonb_build_object('personaId', x->'personaId', 'nombre', x->'nombre',
                                            'hora', x->'hora', 'dias', x->'dias', 'tomadas', x->'tomadas'))
          from jsonb_array_elements(privado.lista(v_estado->'medicacion')) x), '[]'::jsonb),
    'vencimientos', coalesce((
        select jsonb_agg(jsonb_build_object('titulo', x->'titulo', 'categoria', x->'categoria',
                                            'personaId', x->'personaId', 'fecha', x->'fecha',
                                            'avisos', x->'avisos', 'hechoEn', x->'hechoEn'))
          from jsonb_array_elements(privado.lista(v_estado->'vencimientos')) x), '[]'::jsonb),
    'pendientes', coalesce((
        select jsonb_agg(jsonb_build_object('texto', x->'texto', 'personaId', x->'personaId',
                                            'importante', x->'importante', 'creadoEn', x->'creadoEn',
                                            'hechoEn', x->'hechoEn'))
          from jsonb_array_elements(privado.lista(v_estado->'pendientes')) x), '[]'::jsonb),
    -- Cuidarse (D-183): solo de quien pidió avisos; agua y ejercicio, nunca los hábitos.
    'cuidado', coalesce((
      select jsonb_agg(jsonb_build_object(
               'personaId', x->'personaId', 'metaAgua', x->'metaAgua', 'ejercicio', x->'ejercicio',
               'avisos', (x->'avisos' = 'true'::jsonb),
                 'cfg', x->'avisosCfg',
               'miDia', case when jsonb_typeof(x->'avisoDia') = 'number'
                             then jsonb_build_object('hora', x->'avisoDia',
                                                     'total', jsonb_array_length(privado.lista(x->'habitos')))
                             else null end,
               'dias', coalesce((
                 select jsonb_agg(jsonb_build_object('fecha', d.k, 'agua', d.v->'agua', 'ejercicio', d.v->'ejercicio',
                                           'lista', jsonb_array_length(privado.lista(d.v->'habitos'))))
                   from jsonb_each(case when jsonb_typeof(x->'dias') = 'object' then x->'dias' else '{}'::jsonb end) as d(k, v)
                  where d.k ~ '^\d{4}-\d{2}-\d{2}$' and d.k >= (current_date - 3)::text), '[]'::jsonb)))
        from jsonb_array_elements(privado.lista(v_estado->'cuidado')) x
       where x->'avisos' = 'true'::jsonb or jsonb_typeof(x->'avisoDia') = 'number'), '[]'::jsonb),
      'objetivos', privado.cuentas_personales(v_estado),
      'cole', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'fecha', k, 'primero', v->'textoPrimero', 'segundo', v->'textoSegundo', 'postre', v->'postre')
               order by k)
          from jsonb_each(case when jsonb_typeof(v_estado->'colegio') = 'object'
                               then v_estado->'colegio' else '{}'::jsonb end) as c(k, v)
         where k ~ '^\d{4}-\d{2}-\d{2}$'), '[]'::jsonb),
      'personas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x->'id', 'nombre', x->'nombre', 'tipo', x->'tipo',
        'activa', coalesce(x->'activa' <> 'false'::jsonb, true)))
        from jsonb_array_elements(privado.lista(v_estado->'personas')) x), '[]'::jsonb),
    'cenas', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'nombre', x->'plato'->'nombre'))
        from jsonb_array_elements(privado.lista(v_estado->'comidas')) x), '[]'::jsonb),
    'almuerzos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', x->'fecha', 'texto', x->'texto'))
        from jsonb_array_elements(privado.lista(v_estado->'almuerzos')) x), '[]'::jsonb),
    'eventos', case when jsonb_typeof(v_estado->'eventos') = 'object' then v_estado->'eventos' else '{}'::jsonb end,
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fecha', x->'fecha', 'hasta', x->'hasta', 'hora', x->'hora', 'titulo', x->'titulo'))
        from jsonb_array_elements(privado.lista(v_estado->'agenda')) x), '[]'::jsonb),
    'casa', coalesce((
      select jsonb_agg(jsonb_build_object(
        'titulo', x->'titulo', 'emoji', x->'emoji', 'cadaDias', x->'cadaDias',
        'responsableId', x->'responsableId', 'ultimaVez', x->'ultimaVez', 'desde', x->'desde',
        'aplazadaHasta', x->'aplazadaHasta'))
        from jsonb_array_elements(privado.lista(v_estado->'casa')) x), '[]'::jsonb),
    'cumples', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', x->'nombre', 'dia', x->'dia', 'mes', x->'mes', 'anio', x->'anio',
        'personaId', x->'personaId'))
        from jsonb_array_elements(privado.lista(v_estado->'cumples')) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.estado_para_calendario(text) from public;
grant execute on function public.estado_para_calendario(text) to anon, authenticated;
