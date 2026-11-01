-- =============================================================================
-- El día a día del hogar: despensa, lista de la compra y reparto de responsabilidades
--
--   DESPENSA   despensa_item guarda el stock actual; TODO cambio pasa por una operación que deja
--              un registro de movimientos (despensa_operacion + despensa_movimiento). Eso permite
--              deshacer con exactitud y que el stock sea siempre la suma de sus movimientos.
--              La lógica de negocio (qué descontar al cocinar) vive en el dominio TypeScript; la
--              base de datos solo garantiza integridad: tenant, stock nunca negativo y atomicidad.
--   COMPRA     lista_compra_articulo mezcla artículos automáticos (calculados desde el menú y los
--              mínimos de stock) y manuales (lo que hoy se apunta en Google Keep).
--   CARGAS     carga y carga_turno reparten la carga mental: quien es responsable de algo lo
--              concibe y planifica; el turno dice quién lo ejecuta cada vez.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Despensa
-- -----------------------------------------------------------------------------
create table public.despensa_item (
  id              uuid primary key default gen_random_uuid(),
  hogar_id        uuid not null references public.hogar (id) on delete cascade,
  ingrediente_id  uuid not null references public.ingrediente (id) on delete restrict,
  ubicacion       text not null check (ubicacion in ('despensa', 'nevera', 'congelador')),
  cantidad        numeric(10, 2) not null default 0 check (cantidad >= 0),
  -- Stock mínimo: si la cantidad baja de aquí, el ingrediente entra solo en la lista de la compra.
  minimo          numeric(10, 2) check (minimo >= 0),
  -- Caducidad más próxima de lo que hay (una sola fecha por ingrediente y ubicación).
  caduca_en       date,
  actualizado_en  timestamptz not null default now(),
  unique (hogar_id, ingrediente_id, ubicacion)
);
create index despensa_item_ingrediente_idx on public.despensa_item (ingrediente_id);

create table public.despensa_operacion (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null references public.hogar (id) on delete cascade,
  tipo         text not null check (tipo in ('cocinar', 'compra', 'ajuste')),
  descripcion  text check (char_length(descripcion) <= 200),
  articulo_id  uuid,                                   -- artículo de la lista que originó la compra
  revierte_id  uuid references public.despensa_operacion (id) on delete set null,
  creada_por   uuid default auth.uid() references auth.users (id) on delete set null,
  creada_en    timestamptz not null default now(),
  deshecha_en  timestamptz,
  unique (id, hogar_id)
);
create index despensa_operacion_hogar_fecha_idx on public.despensa_operacion (hogar_id, creada_en desc);
create index despensa_operacion_creada_por_idx on public.despensa_operacion (creada_por);
create index despensa_operacion_revierte_idx on public.despensa_operacion (revierte_id);

create table public.despensa_movimiento (
  id              bigint generated always as identity primary key,
  hogar_id        uuid not null,
  operacion_id    uuid not null,
  ingrediente_id  uuid not null references public.ingrediente (id) on delete restrict,
  ubicacion       text not null check (ubicacion in ('despensa', 'nevera', 'congelador')),
  delta           numeric(10, 2) not null check (delta <> 0),
  foreign key (operacion_id, hogar_id) references public.despensa_operacion (id, hogar_id) on delete cascade
);
create index despensa_movimiento_operacion_idx on public.despensa_movimiento (operacion_id, hogar_id);
create index despensa_movimiento_ingrediente_idx on public.despensa_movimiento (ingrediente_id);

-- -----------------------------------------------------------------------------
-- 2. Lista de la compra
-- -----------------------------------------------------------------------------
create table public.lista_compra_articulo (
  id              uuid primary key default gen_random_uuid(),
  hogar_id        uuid not null references public.hogar (id) on delete cascade,
  ingrediente_id  uuid references public.ingrediente (id) on delete restrict,   -- null: artículo libre
  nombre          text not null check (char_length(btrim(nombre)) between 1 and 80),
  cantidad        numeric(10, 2) check (cantidad > 0),
  origen          text not null default 'manual' check (origen in ('manual', 'auto')),
  motivo          text check (char_length(motivo) <= 100),         -- "Cena del martes", "Stock mínimo"
  seccion         text not null default 'otros'
                    check (seccion in ('fruta_verdura', 'carne', 'pescado', 'lacteos', 'huevos',
                                       'panaderia', 'despensa', 'congelados', 'conservas',
                                       'bebidas', 'limpieza', 'otros')),
  comprado        boolean not null default false,
  comprado_en     timestamptz,
  comprado_por    uuid references auth.users (id) on delete set null,
  creado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  check (origen = 'manual' or ingrediente_id is not null)
);
-- Un solo artículo automático pendiente por ingrediente (los ya comprados no cuentan).
create unique index lista_compra_auto_pendiente_uidx
  on public.lista_compra_articulo (hogar_id, ingrediente_id)
  where origen <> 'manual' and not comprado;
create index lista_compra_hogar_comprado_idx on public.lista_compra_articulo (hogar_id, comprado);
create index lista_compra_ingrediente_idx on public.lista_compra_articulo (ingrediente_id);
create index lista_compra_comprado_por_idx on public.lista_compra_articulo (comprado_por);
create index lista_compra_creado_por_idx on public.lista_compra_articulo (creado_por);

-- -----------------------------------------------------------------------------
-- 3. Cargas y turnos (reparto de la carga mental)
-- -----------------------------------------------------------------------------
create table public.carga (
  id                  uuid primary key default gen_random_uuid(),
  hogar_id            uuid not null references public.hogar (id) on delete cascade,
  nombre              text not null check (char_length(btrim(nombre)) between 1 and 80),
  tipo                text not null check (tipo in ('cena', 'compra', 'tarea', 'cole', 'otro')),
  -- Minutos de ejecutar la carga una vez (cocinar, ir a comprar...).
  esfuerzo_min        smallint not null check (esfuerzo_min between 1 and 480),
  -- Minutos semanales de trabajo INVISIBLE: acordarse, decidir, organizar. Lo hace quien es responsable.
  planificacion_min   smallint not null default 0 check (planificacion_min between 0 and 480),
  frecuencia          text not null default 'semanal'
                        check (frecuencia in ('diaria', 'semanal', 'quincenal', 'mensual', 'puntual')),
  responsable_id      uuid,
  activa              boolean not null default true,
  creado_en           timestamptz not null default now(),
  unique (id, hogar_id),
  foreign key (responsable_id, hogar_id) references public.persona (id, hogar_id)
    on delete set null (responsable_id)
);
create index carga_hogar_idx on public.carga (hogar_id);
create index carga_responsable_idx on public.carga (responsable_id, hogar_id);

create table public.carga_turno (
  hogar_id    uuid not null,
  carga_id    uuid not null,
  fecha       date not null,
  persona_id  uuid not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'saltado')),
  hecho_en    timestamptz,
  primary key (carga_id, fecha),
  foreign key (carga_id, hogar_id) references public.carga (id, hogar_id) on delete cascade,
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id)
);
create index carga_turno_carga_idx on public.carga_turno (carga_id, hogar_id);
create index carga_turno_persona_idx on public.carga_turno (persona_id, hogar_id);
create index carga_turno_hogar_fecha_idx on public.carga_turno (hogar_id, fecha);

-- -----------------------------------------------------------------------------
-- 4. Funciones y disparadores internos
-- -----------------------------------------------------------------------------

-- Aplica movimientos de forma atómica y los registra. SIN comprobación de pertenencia: solo la
-- llaman funciones públicas que ya la han hecho. Nunca deja un stock negativo.
create function privado.aplicar_movimientos(
  p_hogar_id uuid, p_tipo text, p_descripcion text, p_articulo_id uuid, p_mov jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op    uuid;
  v_m     jsonb;
  v_ing   uuid;
  v_ubi   text;
  v_delta numeric;
begin
  if jsonb_typeof(p_mov) is distinct from 'array' or jsonb_array_length(p_mov) not between 1 and 100 then
    raise exception 'Movimientos no válidos' using errcode = '22023';
  end if;

  insert into public.despensa_operacion (hogar_id, tipo, descripcion, articulo_id, creada_por)
  values (p_hogar_id, p_tipo, left(p_descripcion, 200), p_articulo_id, (select auth.uid()))
  returning id into v_op;

  for v_m in select value from jsonb_array_elements(p_mov) loop
    begin
      v_ing   := (v_m ->> 'ingrediente_id')::uuid;
      v_ubi   := v_m ->> 'ubicacion';
      v_delta := round((v_m ->> 'delta')::numeric, 2);
    exception when others then
      raise exception 'Movimiento no válido' using errcode = '22023';
    end;
    if v_ing is null or v_ubi is null or v_ubi not in ('despensa', 'nevera', 'congelador')
       or v_delta is null or v_delta = 0 then
      raise exception 'Movimiento no válido' using errcode = '22023';
    end if;

    if v_delta > 0 then
      insert into public.despensa_item (hogar_id, ingrediente_id, ubicacion, cantidad)
      values (p_hogar_id, v_ing, v_ubi, v_delta)
      on conflict (hogar_id, ingrediente_id, ubicacion)
      do update set cantidad = public.despensa_item.cantidad + excluded.cantidad,
                    actualizado_en = now();
    else
      update public.despensa_item
         set cantidad = cantidad + v_delta, actualizado_en = now()
       where hogar_id = p_hogar_id and ingrediente_id = v_ing and ubicacion = v_ubi
         and cantidad + v_delta >= 0;
      if not found then
        raise exception 'Stock insuficiente' using errcode = '23514';
      end if;
    end if;

    insert into public.despensa_movimiento (hogar_id, operacion_id, ingrediente_id, ubicacion, delta)
    values (p_hogar_id, v_op, v_ing, v_ubi, v_delta);
  end loop;

  return v_op;
end;
$$;
revoke all on function privado.aplicar_movimientos(uuid, text, text, uuid, jsonb) from public;

create function privado.sellar_compra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.comprado and not old.comprado then
    new.comprado_en := now();
    new.comprado_por := (select auth.uid());
  elsif not new.comprado and old.comprado then
    new.comprado_en := null;
    new.comprado_por := null;
  end if;
  return new;
end;
$$;
revoke all on function privado.sellar_compra() from public;
create trigger lista_compra_sellar
  before update of comprado on public.lista_compra_articulo
  for each row execute function privado.sellar_compra();

-- La carga mental se reparte entre personas adultas activas del hogar.
create function privado.validar_persona_adulta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona uuid;
begin
  if tg_table_name = 'carga' then
    v_persona := new.responsable_id;
  else
    v_persona := new.persona_id;
  end if;
  if v_persona is not null and not exists (
    select 1 from public.persona
    where id = v_persona and hogar_id = new.hogar_id and tipo = 'adulto' and activa
  ) then
    raise exception 'La persona responsable debe ser un adulto activo del hogar' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function privado.validar_persona_adulta() from public;
create trigger carga_validar_responsable
  before insert or update of responsable_id on public.carga
  for each row execute function privado.validar_persona_adulta();
create trigger carga_turno_validar_persona
  before insert or update of persona_id on public.carga_turno
  for each row execute function privado.validar_persona_adulta();

-- -----------------------------------------------------------------------------
-- 5. RLS y privilegios mínimos
-- -----------------------------------------------------------------------------
alter table public.despensa_item           enable row level security;
alter table public.despensa_operacion      enable row level security;
alter table public.despensa_movimiento     enable row level security;
alter table public.lista_compra_articulo   enable row level security;
alter table public.carga                   enable row level security;
alter table public.carga_turno             enable row level security;

alter table public.despensa_item           force row level security;
alter table public.despensa_operacion      force row level security;
alter table public.despensa_movimiento     force row level security;
alter table public.lista_compra_articulo   force row level security;
alter table public.carga                   force row level security;
alter table public.carga_turno             force row level security;

revoke all on public.despensa_item, public.despensa_operacion, public.despensa_movimiento,
              public.lista_compra_articulo, public.carga, public.carga_turno from anon, public;

-- Despensa: lectura para el hogar; la cantidad SOLO cambia mediante operaciones (con registro).
grant select, delete on public.despensa_item to authenticated;
grant update (minimo, caduca_en) on public.despensa_item to authenticated;
create policy despensa_item_select on public.despensa_item for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy despensa_item_update on public.despensa_item for update to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy despensa_item_delete on public.despensa_item for delete to authenticated
  using ((select privado.es_miembro(hogar_id)) and cantidad = 0);

grant select on public.despensa_operacion, public.despensa_movimiento to authenticated;
create policy despensa_operacion_select on public.despensa_operacion for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy despensa_movimiento_select on public.despensa_movimiento for select to authenticated
  using ((select privado.es_miembro(hogar_id)));

-- Compra: los artículos manuales los gestiona cualquier miembro; los automáticos solo se tocan por
-- sincronizar_compra_auto() y marcar_comprado().
grant select, delete on public.lista_compra_articulo to authenticated;
grant insert (hogar_id, nombre, cantidad, ingrediente_id, seccion) on public.lista_compra_articulo to authenticated;
grant update (nombre, cantidad, comprado) on public.lista_compra_articulo to authenticated;
create policy lista_compra_select on public.lista_compra_articulo for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy lista_compra_insert on public.lista_compra_articulo for insert to authenticated
  with check ((select privado.es_miembro(hogar_id)));
create policy lista_compra_update on public.lista_compra_articulo for update to authenticated
  using ((select privado.es_miembro(hogar_id)) and origen = 'manual')
  with check ((select privado.es_miembro(hogar_id)) and origen = 'manual');
create policy lista_compra_delete on public.lista_compra_articulo for delete to authenticated
  using ((select privado.es_miembro(hogar_id)) and origen = 'manual');

-- Cargas y turnos: el reparto lo acuerda y edita todo el hogar.
grant select, insert, update, delete on public.carga, public.carga_turno to authenticated;
create policy carga_all on public.carga for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy carga_turno_all on public.carga_turno for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));

-- -----------------------------------------------------------------------------
-- 6. Funciones de la API
-- -----------------------------------------------------------------------------

-- Aplica una operación de despensa (cocinar, compra, ajuste) con sus movimientos.
create function public.aplicar_operacion_despensa(
  p_hogar_id uuid, p_tipo text, p_descripcion text, p_movimientos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_tipo not in ('cocinar', 'compra', 'ajuste') then
    raise exception 'Tipo de operación no válido' using errcode = '22023';
  end if;
  return privado.aplicar_movimientos(p_hogar_id, p_tipo, p_descripcion, null, p_movimientos);
end;
$$;

-- Deshace una operación aplicando los movimientos inversos. Una sola vez, en 48 horas, y solo si
-- el stock lo permite (p. ej. no se deshace una compra cuyo contenido ya se ha consumido).
create function public.deshacer_operacion_despensa(p_operacion_id uuid)
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
           'ingrediente_id', ingrediente_id, 'ubicacion', ubicacion, 'delta', -delta))
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

  -- Si la operación venía de marcar un artículo como comprado, vuelve a dejarlo pendiente. Salvo que
  -- ya haya otro pendiente del mismo ingrediente (la lista se recalculó mientras tanto): entonces la
  -- necesidad ya está representada y el comprado se elimina para no duplicarla.
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

-- Marca un artículo como comprado y, si es un ingrediente con cantidad, lo mete en la despensa.
-- Devuelve la operación (para poder deshacer) o null si no afecta al stock.
create function public.marcar_comprado(p_articulo_id uuid, p_ubicacion text default 'despensa')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_art public.lista_compra_articulo%rowtype;
  v_op  uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  select * into v_art from public.lista_compra_articulo where id = p_articulo_id for update;
  if not found or not privado.es_miembro(v_art.hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if v_art.comprado then
    raise exception 'Ya está comprado' using errcode = '23505';
  end if;
  if p_ubicacion not in ('despensa', 'nevera', 'congelador') then
    raise exception 'Ubicación no válida' using errcode = '22023';
  end if;

  update public.lista_compra_articulo set comprado = true where id = p_articulo_id;

  if v_art.ingrediente_id is not null and v_art.cantidad is not null then
    v_op := privado.aplicar_movimientos(
      v_art.hogar_id, 'compra', 'Compra: ' || v_art.nombre, p_articulo_id,
      jsonb_build_array(jsonb_build_object(
        'ingrediente_id', v_art.ingrediente_id, 'ubicacion', p_ubicacion, 'delta', v_art.cantidad)));
  end if;
  return v_op;
end;
$$;

-- Sustituye los artículos AUTOMÁTICOS pendientes por los calculados por el dominio. No toca los
-- manuales ni los ya comprados. Devuelve cuántos quedan.
create function public.sincronizar_compra_auto(p_hogar_id uuid, p_articulos jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if jsonb_typeof(p_articulos) is distinct from 'array' or jsonb_array_length(p_articulos) > 300 then
    raise exception 'Artículos no válidos' using errcode = '22023';
  end if;

  begin
    delete from public.lista_compra_articulo
     where hogar_id = p_hogar_id and origen = 'auto' and not comprado
       and ingrediente_id not in (
         select (e ->> 'ingrediente_id')::uuid
         from jsonb_array_elements(p_articulos) e where e ->> 'ingrediente_id' is not null);

    insert into public.lista_compra_articulo (hogar_id, ingrediente_id, nombre, cantidad, origen, motivo, seccion)
    select p_hogar_id, g.id, g.nombre, round((e ->> 'cantidad')::numeric, 2), 'auto',
           left(e ->> 'motivo', 100), g.seccion
    from jsonb_array_elements(p_articulos) e
    join public.ingrediente g on g.id = (e ->> 'ingrediente_id')::uuid
    on conflict (hogar_id, ingrediente_id) where origen <> 'manual' and not comprado
    do update set cantidad = excluded.cantidad, motivo = excluded.motivo,
                  nombre = excluded.nombre, seccion = excluded.seccion;
  exception when invalid_text_representation or invalid_parameter_value or numeric_value_out_of_range then
    raise exception 'Artículos no válidos' using errcode = '22023';
  end;

  select count(*) into v_n from public.lista_compra_articulo
   where hogar_id = p_hogar_id and origen = 'auto' and not comprado;
  return v_n;
end;
$$;

revoke all on function public.aplicar_operacion_despensa(uuid, text, text, jsonb) from public, anon;
revoke all on function public.deshacer_operacion_despensa(uuid)                   from public, anon;
revoke all on function public.marcar_comprado(uuid, text)                          from public, anon;
revoke all on function public.sincronizar_compra_auto(uuid, jsonb)                 from public, anon;
grant execute on function public.aplicar_operacion_despensa(uuid, text, text, jsonb) to authenticated;
grant execute on function public.deshacer_operacion_despensa(uuid)                   to authenticated;
grant execute on function public.marcar_comprado(uuid, text)                          to authenticated;
grant execute on function public.sincronizar_compra_auto(uuid, jsonb)                 to authenticated;
