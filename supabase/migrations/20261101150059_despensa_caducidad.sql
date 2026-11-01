-- =============================================================================
-- Despensa: caducidad coherente con el registro de movimientos
--
-- Defecto detectado por las pruebas de propiedades del dominio: una fila de despensa vacía conservaba
-- su caducidad antigua, de modo que al comprar de nuevo el stock recién comprado heredaba una fecha
-- vencida y figuraba como caducado. Resolverlo borrando la fecha sin más habría permitido que
-- «deshacer» resucitara comida caducada como si fuera fresca. Reglas nuevas:
--
--   1. Una fila que llega a 0 pierde su caducidad (ya no hay nada a lo que aplicarla).
--   2. Cada movimiento guarda la caducidad que tenía la fila ANTES (`caduca_antes`); deshacer la
--      restaura, de modo que deshacer es exacto también en las fechas.
--   3. No se mezcla stock nuevo con stock caducado: añadir a una fila con stock caducado se rechaza;
--      hay que tirar lo caducado antes (un movimiento negativo). Excepción: deshacer.
-- =============================================================================

alter table public.despensa_movimiento add column caduca_antes date;

create or replace function privado.aplicar_movimientos(
  p_hogar_id uuid, p_tipo text, p_descripcion text, p_articulo_id uuid, p_mov jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op         uuid;
  v_m          jsonb;
  v_ing        uuid;
  v_ubi        text;
  v_delta      numeric;
  v_restaurar  date;
  v_es_deshacer boolean;
  v_fila       public.despensa_item%rowtype;
  v_antes      date;
begin
  if jsonb_typeof(p_mov) is distinct from 'array' or jsonb_array_length(p_mov) not between 1 and 100 then
    raise exception 'Movimientos no válidos' using errcode = '22023';
  end if;

  insert into public.despensa_operacion (hogar_id, tipo, descripcion, articulo_id, creada_por)
  values (p_hogar_id, p_tipo, left(p_descripcion, 200), p_articulo_id, (select auth.uid()))
  returning id into v_op;

  for v_m in select value from jsonb_array_elements(p_mov) loop
    begin
      v_ing         := (v_m ->> 'ingrediente_id')::uuid;
      v_ubi         := v_m ->> 'ubicacion';
      v_delta       := round((v_m ->> 'delta')::numeric, 2);
      v_es_deshacer := v_m ? 'restaurar_caducidad';
      v_restaurar   := nullif(v_m ->> 'restaurar_caducidad', '')::date;
    exception when others then
      raise exception 'Movimiento no válido' using errcode = '22023';
    end;
    if v_ing is null or v_ubi is null or v_ubi not in ('despensa', 'nevera', 'congelador')
       or v_delta is null or v_delta = 0 then
      raise exception 'Movimiento no válido' using errcode = '22023';
    end if;

    select * into v_fila from public.despensa_item
     where hogar_id = p_hogar_id and ingrediente_id = v_ing and ubicacion = v_ubi
     for update;
    v_antes := case when found then v_fila.caduca_en end;

    if v_delta > 0 then
      if found and v_fila.cantidad > 0 and v_fila.caduca_en is not null
         and v_fila.caduca_en < current_date and not v_es_deshacer then
        raise exception 'Hay stock caducado en esa ubicación: tíralo antes de añadir más'
          using errcode = '23514';
      end if;

      if not found then
        insert into public.despensa_item (hogar_id, ingrediente_id, ubicacion, cantidad, caduca_en)
        values (p_hogar_id, v_ing, v_ubi, v_delta, v_restaurar);
      elsif v_fila.cantidad = 0 then
        -- Fila vacía: es un lote nuevo, sin la caducidad del anterior (salvo que se esté deshaciendo).
        update public.despensa_item
           set cantidad = v_delta, caduca_en = v_restaurar, actualizado_en = now()
         where id = v_fila.id;
      else
        update public.despensa_item
           set cantidad = cantidad + v_delta, actualizado_en = now()
         where id = v_fila.id;
      end if;
    else
      if not found or v_fila.cantidad + v_delta < 0 then
        raise exception 'Stock insuficiente' using errcode = '23514';
      end if;
      update public.despensa_item
         set cantidad = cantidad + v_delta,
             caduca_en = case when cantidad + v_delta = 0 then null else caduca_en end,
             actualizado_en = now()
       where id = v_fila.id;
    end if;

    insert into public.despensa_movimiento
      (hogar_id, operacion_id, ingrediente_id, ubicacion, delta, caduca_antes)
    values (p_hogar_id, v_op, v_ing, v_ubi, v_delta, v_antes);
  end loop;

  return v_op;
end;
$$;

-- Deshacer: movimientos inversos en orden inverso, restaurando la caducidad que había antes.
create or replace function public.deshacer_operacion_despensa(p_operacion_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op    public.despensa_operacion%rowtype;
  v_art   public.lista_compra_articulo%rowtype;
  v_mov   jsonb;
  v_nueva uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  select * into v_op from public.despensa_operacion where id = p_operacion_id for update;
  if not found or not privado.es_miembro(v_op.hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_op.deshecha_en is not null then
    raise exception 'La operación ya está deshecha' using errcode = '23505';
  end if;
  if v_op.revierte_id is not null then
    raise exception 'Una operación de deshacer no se puede deshacer' using errcode = '22023';
  end if;
  if v_op.creada_en < now() - interval '48 hours' then
    raise exception 'Han pasado más de 48 horas: ya no se puede deshacer' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'ingrediente_id', ingrediente_id, 'ubicacion', ubicacion, 'delta', -delta,
           'restaurar_caducidad', caduca_antes) order by id desc)
    into v_mov
  from public.despensa_movimiento where operacion_id = p_operacion_id;

  begin
    v_nueva := privado.aplicar_movimientos(
      v_op.hogar_id, 'ajuste', 'Deshacer: ' || coalesce(v_op.descripcion, v_op.tipo), null, v_mov);
  exception when check_violation then
    raise exception 'No se puede deshacer: parte del stock ya se ha consumido' using errcode = '23514';
  end;

  update public.despensa_operacion set revierte_id = p_operacion_id where id = v_nueva;
  update public.despensa_operacion set deshecha_en = now() where id = p_operacion_id;

  select * into v_art from public.lista_compra_articulo
   where id = v_op.articulo_id and hogar_id = v_op.hogar_id;
  if found then
    if v_art.origen <> 'manual' and exists (
         select 1 from public.lista_compra_articulo o
         where o.hogar_id = v_art.hogar_id and o.ingrediente_id = v_art.ingrediente_id
           and o.origen <> 'manual' and not o.comprado and o.id <> v_art.id) then
      delete from public.lista_compra_articulo where id = v_art.id;
    else
      update public.lista_compra_articulo set comprado = false where id = v_art.id;
    end if;
  end if;
  return v_nueva;
end;
$$;
