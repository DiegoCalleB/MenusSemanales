-- =============================================================================
-- Catálogo de platos: ingredientes, platos del hogar y biblioteca comunitaria
--
--   ingrediente              Catálogo GLOBAL de ingredientes normalizados (una unidad por
--                            ingrediente) para poder sumar la compra entre platos y familias.
--   plato / plato_ingrediente  Catálogo PRIVADO de cada hogar (cantidades por ración).
--   plato_compartido (+ingredientes, +autor)  Biblioteca COMUNITARIA: una familia envía un
--                            plato, el administrador de la plataforma lo revisa y, si lo
--                            publica, lo ven todas. Quien lo usa lo "adopta" (copia propia).
--
-- Privacidad: el hogar autor de un plato compartido NUNCA es visible para otras familias; vive
-- en una tabla aparte que solo ve el propio hogar y el administrador.
-- Moderación: pensada para que cueste un toque por plato (bandeja con avisos automáticos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Administrador de la plataforma (quien modera). Sin acceso desde la API: solo se da de alta
--    con SQL desde el panel (ver docs/moderacion.md) y solo lo consultan funciones internas.
-- -----------------------------------------------------------------------------
create table public.administrador_plataforma (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  creado_en  timestamptz not null default now()
);
alter table public.administrador_plataforma enable row level security;
alter table public.administrador_plataforma force row level security;
revoke all on public.administrador_plataforma from anon, authenticated, public;

create function privado.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administrador_plataforma a where a.user_id = (select auth.uid())
  );
$$;
revoke all on function privado.es_admin_plataforma() from public;
grant execute on function privado.es_admin_plataforma() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Ingredientes (catálogo global)
-- -----------------------------------------------------------------------------
create table public.ingrediente (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null check (char_length(btrim(nombre)) between 2 and 80),
  -- Minúsculas y sin tildes (la ñ se conserva): evita duplicados tipo "Tomate" / "tomaté".
  nombre_normalizado  text generated always as (translate(lower(btrim(nombre)), 'áéíóúü', 'aeiouu')) stored,
  unidad              text not null check (unidad in ('g', 'ml', 'ud')),
  seccion             text not null default 'otros'
                        check (seccion in ('fruta_verdura', 'carne', 'pescado', 'lacteos', 'huevos',
                                           'panaderia', 'despensa', 'congelados', 'conservas',
                                           'bebidas', 'limpieza', 'otros')),
  verificado          boolean not null default false,   -- revisado por el administrador
  creado_por          uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en           timestamptz not null default now(),
  unique (nombre_normalizado)
);
create index ingrediente_creado_por_idx on public.ingrediente (creado_por);

-- -----------------------------------------------------------------------------
-- 3. Biblioteca comunitaria (se crea antes que `plato`, que puede apuntar a ella)
-- -----------------------------------------------------------------------------
create table public.plato_compartido (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (char_length(btrim(nombre)) between 2 and 120),
  rol                text not null check (rol in ('principal', 'guarnicion', 'basico')),
  grupo              public.grupo_alimenticio not null,
  tiempo_activo_min  smallint check (tiempo_activo_min between 1 and 240),
  tiempo_total_min   smallint not null check (tiempo_total_min between 1 and 600),
  etiquetas          text[] not null default '{}' check (cardinality(etiquetas) <= 10),
  pasos              text check (char_length(pasos) <= 4000),
  alias_autor        text check (char_length(btrim(alias_autor)) between 1 and 40),
  estado             text not null default 'pendiente'
                       check (estado in ('pendiente', 'publicado', 'rechazado', 'retirado')),
  motivo_rechazo     text check (char_length(motivo_rechazo) <= 300),
  adopciones         integer not null default 0 check (adopciones >= 0),
  enviado_en         timestamptz not null default now(),
  revisado_en        timestamptz,
  revisado_por       uuid references auth.users (id) on delete set null,
  check (tiempo_activo_min is null or tiempo_activo_min <= tiempo_total_min)
);
create index plato_compartido_estado_idx on public.plato_compartido (estado, enviado_en);
create index plato_compartido_revisado_por_idx on public.plato_compartido (revisado_por);

create table public.plato_compartido_ingrediente (
  plato_compartido_id  uuid not null references public.plato_compartido (id) on delete cascade,
  ingrediente_id       uuid not null references public.ingrediente (id) on delete restrict,
  cantidad_por_racion  numeric(8, 2) not null check (cantidad_por_racion > 0),
  opcional             boolean not null default false,
  primary key (plato_compartido_id, ingrediente_id)
);
create index plato_compartido_ingrediente_ingrediente_idx
  on public.plato_compartido_ingrediente (ingrediente_id);

-- Autoría PRIVADA: qué hogar envió el plato. Solo la ve ese hogar y el administrador.
create table public.plato_compartido_autor (
  plato_compartido_id  uuid primary key references public.plato_compartido (id) on delete cascade,
  hogar_id             uuid references public.hogar (id) on delete set null,
  plato_id             uuid,           -- plato de origen en el hogar (sin FK: el hogar puede borrarlo)
  creado_en            timestamptz not null default now()
);
create index plato_compartido_autor_hogar_idx on public.plato_compartido_autor (hogar_id);
create index plato_compartido_autor_plato_idx on public.plato_compartido_autor (plato_id);

-- -----------------------------------------------------------------------------
-- 4. Platos del hogar (privados)
-- -----------------------------------------------------------------------------
create table public.plato (
  id                   uuid primary key default gen_random_uuid(),
  hogar_id             uuid not null references public.hogar (id) on delete cascade,
  nombre               text not null check (char_length(btrim(nombre)) between 2 and 120),
  rol                  text not null check (rol in ('principal', 'guarnicion', 'basico')),
  grupo                public.grupo_alimenticio,
  tiempo_activo_min    smallint check (tiempo_activo_min between 1 and 240),
  tiempo_total_min     smallint check (tiempo_total_min between 1 and 600),
  etiquetas            text[] not null default '{}' check (cardinality(etiquetas) <= 10),
  pasos                text check (char_length(pasos) <= 4000),
  origen               text not null default 'propio' check (origen in ('propio', 'semilla', 'compartido')),
  plato_compartido_id  uuid references public.plato_compartido (id) on delete set null,
  no_proponer          boolean not null default false,
  activo               boolean not null default true,
  creado_por           uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en            timestamptz not null default now(),
  unique (id, hogar_id),
  check (tiempo_activo_min is null or tiempo_total_min is null or tiempo_activo_min <= tiempo_total_min)
);
create index plato_hogar_id_idx on public.plato (hogar_id);
create index plato_compartido_id_idx on public.plato (plato_compartido_id);
create index plato_creado_por_idx on public.plato (creado_por);

-- La unidad la fija el ingrediente (una sola por ingrediente): simplifica sumar la compra.
create table public.plato_ingrediente (
  hogar_id             uuid not null,
  plato_id             uuid not null,
  ingrediente_id       uuid not null references public.ingrediente (id) on delete restrict,
  cantidad_por_racion  numeric(8, 2) not null check (cantidad_por_racion > 0),
  opcional             boolean not null default false,
  primary key (plato_id, ingrediente_id),
  foreign key (plato_id, hogar_id) references public.plato (id, hogar_id) on delete cascade
);
create index plato_ingrediente_plato_hogar_idx on public.plato_ingrediente (plato_id, hogar_id);
create index plato_ingrediente_ingrediente_idx on public.plato_ingrediente (ingrediente_id);
create index plato_ingrediente_hogar_idx on public.plato_ingrediente (hogar_id);

-- -----------------------------------------------------------------------------
-- 5. Funciones internas (esquema `privado`)
-- -----------------------------------------------------------------------------
create function privado.puede_ver_plato_compartido(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plato_compartido pc
    where pc.id = p_id
      and (
        pc.estado = 'publicado'
        or privado.es_admin_plataforma()
        or exists (
          select 1
          from public.plato_compartido_autor a
          join public.miembro m on m.hogar_id = a.hogar_id
          where a.plato_compartido_id = pc.id and m.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Avisos automáticos para que la revisión sea de un vistazo. Lista vacía = nada raro.
create function privado.avisos_plato_compartido(p_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when not exists (select 1 from public.plato_compartido_ingrediente i
                          where i.plato_compartido_id = pc.id) then 'sin_ingredientes' end,
    case when coalesce(char_length(btrim(pc.pasos)), 0) < 20 then 'sin_pasos' end,
    case when pc.tiempo_total_min > 45 then 'tiempo_alto' end,
    case when coalesce(pc.pasos, '') ~* '(https?://|www\.)' or pc.nombre ~* '(https?://|www\.)'
         then 'enlace_en_texto' end,
    case when exists (select 1
                      from public.plato_compartido_ingrediente i
                      join public.ingrediente g on g.id = i.ingrediente_id
                      where i.plato_compartido_id = pc.id and not g.verificado)
         then 'ingrediente_nuevo' end,
    case when exists (select 1 from public.plato_compartido o
                      where o.id <> pc.id and o.estado = 'publicado'
                        and translate(lower(btrim(o.nombre)), 'áéíóúü', 'aeiouu')
                          = translate(lower(btrim(pc.nombre)), 'áéíóúü', 'aeiouu'))
         then 'posible_duplicado' end
  ], null)
  from public.plato_compartido pc
  where pc.id = p_id;
$$;

revoke all on function privado.puede_ver_plato_compartido(uuid) from public;
revoke all on function privado.avisos_plato_compartido(uuid)   from public;
grant execute on function privado.puede_ver_plato_compartido(uuid) to authenticated;
-- avisos_plato_compartido solo la usan funciones internas: no se concede a authenticated.

-- -----------------------------------------------------------------------------
-- 6. RLS y privilegios mínimos
-- -----------------------------------------------------------------------------
alter table public.ingrediente                    enable row level security;
alter table public.plato                          enable row level security;
alter table public.plato_ingrediente              enable row level security;
alter table public.plato_compartido               enable row level security;
alter table public.plato_compartido_ingrediente   enable row level security;
alter table public.plato_compartido_autor         enable row level security;

alter table public.ingrediente                    force row level security;
alter table public.plato                          force row level security;
alter table public.plato_ingrediente              force row level security;
alter table public.plato_compartido               force row level security;
alter table public.plato_compartido_ingrediente   force row level security;
alter table public.plato_compartido_autor         force row level security;

revoke all on public.ingrediente, public.plato, public.plato_ingrediente, public.plato_compartido,
              public.plato_compartido_ingrediente, public.plato_compartido_autor from anon, public;

-- Ingredientes: los ve cualquiera con sesión; se crean por función; solo el administrador los edita.
grant select, update, delete on public.ingrediente to authenticated;
create policy ingrediente_select on public.ingrediente for select to authenticated using (true);
create policy ingrediente_update on public.ingrediente for update to authenticated
  using ((select privado.es_admin_plataforma())) with check ((select privado.es_admin_plataforma()));
create policy ingrediente_delete on public.ingrediente for delete to authenticated
  using ((select privado.es_admin_plataforma()));

-- Platos del hogar: cualquier miembro. `origen` y `plato_compartido_id` NO se pueden fijar a mano
-- (privilegios por columna): solo adoptar_plato_compartido() y el importador del seed los asignan.
grant select, delete on public.plato to authenticated;
grant insert (hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos)
  on public.plato to authenticated;
grant update (nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos,
              no_proponer, activo)
  on public.plato to authenticated;
create policy plato_select on public.plato for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy plato_insert on public.plato for insert to authenticated
  with check ((select privado.es_miembro(hogar_id)));
create policy plato_update on public.plato for update to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy plato_delete on public.plato for delete to authenticated
  using ((select privado.es_miembro(hogar_id)));

grant select, insert, update, delete on public.plato_ingrediente to authenticated;
create policy plato_ingrediente_all on public.plato_ingrediente for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));

-- Biblioteca: solo lectura desde la API; los publicados los ve cualquiera, los pendientes y
-- rechazados solo el hogar autor y el administrador. Todo lo demás, por funciones.
grant select on public.plato_compartido, public.plato_compartido_ingrediente,
                public.plato_compartido_autor to authenticated;
create policy plato_compartido_select on public.plato_compartido for select to authenticated
  using ((select privado.puede_ver_plato_compartido(id)));
create policy plato_compartido_ingrediente_select on public.plato_compartido_ingrediente
  for select to authenticated
  using ((select privado.puede_ver_plato_compartido(plato_compartido_id)));
create policy plato_compartido_autor_select on public.plato_compartido_autor
  for select to authenticated
  using ((select privado.es_miembro(hogar_id)) or (select privado.es_admin_plataforma()));

-- -----------------------------------------------------------------------------
-- 7. Funciones de la API
-- -----------------------------------------------------------------------------

-- Devuelve el ingrediente existente (aunque cambie mayúsculas o tildes) o lo crea. Máx. 50 nuevos
-- por usuario y día.
create function public.crear_ingrediente(p_nombre text, p_unidad text, p_seccion text default 'otros')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_norm text := translate(lower(btrim(p_nombre)), 'áéíóúü', 'aeiouu');
  v_id   uuid;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  select id into v_id from public.ingrediente where nombre_normalizado = v_norm;
  if found then
    return v_id;
  end if;

  if (select count(*) from public.ingrediente
      where creado_por = v_user and creado_en > now() - interval '1 day') >= 50 then
    raise exception 'Demasiados ingredientes nuevos hoy' using errcode = '54000';
  end if;

  insert into public.ingrediente (nombre, unidad, seccion, creado_por)
  values (btrim(p_nombre), p_unidad, p_seccion, v_user)
  on conflict (nombre_normalizado) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.ingrediente where nombre_normalizado = v_norm;
  end if;
  return v_id;
end;
$$;

-- Envía un plato del hogar a la biblioteca comunitaria (queda pendiente de revisión).
create function public.enviar_plato_a_catalogo(p_plato_id uuid, p_alias text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_plato public.plato%rowtype;
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  select * into v_plato from public.plato where id = p_plato_id;
  -- Mismo error si no existe o no es de tu hogar: no se revela qué platos existen.
  if not found or not privado.es_miembro(v_plato.hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  if v_plato.origen = 'compartido' then
    raise exception 'Un plato adoptado de la biblioteca no puede volver a enviarse' using errcode = '22023';
  end if;
  if v_plato.grupo is null or v_plato.tiempo_total_min is null then
    raise exception 'Faltan datos: indica el grupo alimenticio y el tiempo total' using errcode = '22023';
  end if;
  if not exists (select 1 from public.plato_ingrediente where plato_id = p_plato_id) then
    raise exception 'Faltan ingredientes' using errcode = '22023';
  end if;

  if exists (select 1
             from public.plato_compartido_autor a
             join public.plato_compartido pc on pc.id = a.plato_compartido_id
             where a.plato_id = p_plato_id and pc.estado in ('pendiente', 'publicado')) then
    raise exception 'Este plato ya está enviado' using errcode = '23505';
  end if;
  if (select count(*)
      from public.plato_compartido_autor a
      join public.plato_compartido pc on pc.id = a.plato_compartido_id
      where a.hogar_id = v_plato.hogar_id and pc.estado = 'pendiente') >= 5 then
    raise exception 'Demasiados platos pendientes de revisión' using errcode = '54000';
  end if;

  insert into public.plato_compartido
    (nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos, alias_autor)
  values
    (v_plato.nombre, v_plato.rol, v_plato.grupo, v_plato.tiempo_activo_min, v_plato.tiempo_total_min,
     v_plato.etiquetas, v_plato.pasos, nullif(btrim(p_alias), ''))
  returning id into v_id;

  insert into public.plato_compartido_ingrediente
    (plato_compartido_id, ingrediente_id, cantidad_por_racion, opcional)
  select v_id, ingrediente_id, cantidad_por_racion, opcional
  from public.plato_ingrediente where plato_id = p_plato_id;

  insert into public.plato_compartido_autor (plato_compartido_id, hogar_id, plato_id)
  values (v_id, v_plato.hogar_id, p_plato_id);

  return v_id;
end;
$$;

-- Copia un plato publicado al catálogo del hogar, para poder adaptarlo. Idempotente.
create function public.adoptar_plato_compartido(p_hogar_id uuid, p_plato_compartido_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_nuevo uuid;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plato_compartido
                 where id = p_plato_compartido_id and estado = 'publicado') then
    raise exception 'Plato no disponible' using errcode = 'P0002';
  end if;

  select id into v_nuevo from public.plato
  where hogar_id = p_hogar_id and plato_compartido_id = p_plato_compartido_id;
  if found then
    return v_nuevo;
  end if;

  insert into public.plato
    (hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos,
     origen, plato_compartido_id)
  select p_hogar_id, nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, pasos,
         'compartido', id
  from public.plato_compartido where id = p_plato_compartido_id
  returning id into v_nuevo;

  insert into public.plato_ingrediente (hogar_id, plato_id, ingrediente_id, cantidad_por_racion, opcional)
  select p_hogar_id, v_nuevo, ingrediente_id, cantidad_por_racion, opcional
  from public.plato_compartido_ingrediente where plato_compartido_id = p_plato_compartido_id;

  update public.plato_compartido set adopciones = adopciones + 1 where id = p_plato_compartido_id;
  return v_nuevo;
end;
$$;

-- Bandeja de revisión del administrador: lo pendiente, con avisos y sus ingredientes.
create function public.bandeja_revision()
returns table (
  id uuid, nombre text, rol text, grupo public.grupo_alimenticio,
  tiempo_activo_min smallint, tiempo_total_min smallint, etiquetas text[], pasos text,
  alias_autor text, enviado_en timestamptz, avisos text[], ingredientes jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_admin_plataforma() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return query
  select pc.id, pc.nombre, pc.rol, pc.grupo, pc.tiempo_activo_min, pc.tiempo_total_min,
         pc.etiquetas, pc.pasos, pc.alias_autor, pc.enviado_en,
         privado.avisos_plato_compartido(pc.id),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'nombre', g.nombre, 'cantidad', i.cantidad_por_racion,
                     'unidad', g.unidad, 'opcional', i.opcional, 'verificado', g.verificado)
                   order by g.nombre)
                   from public.plato_compartido_ingrediente i
                   join public.ingrediente g on g.id = i.ingrediente_id
                   where i.plato_compartido_id = pc.id), '[]'::jsonb)
  from public.plato_compartido pc
  where pc.estado = 'pendiente'
  order by pc.enviado_en;
end;
$$;

-- Un toque: publicar (verifica además sus ingredientes), rechazar (con motivo) o retirar.
create function public.revisar_plato_compartido(
  p_id uuid, p_decision text, p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_admin_plataforma() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_decision not in ('publicar', 'rechazar', 'retirar') then
    raise exception 'Decisión no válida' using errcode = '22023';
  end if;
  if p_decision = 'rechazar' and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Indica el motivo del rechazo' using errcode = '22023';
  end if;

  if p_decision = 'publicar' then
    update public.plato_compartido
       set estado = 'publicado', motivo_rechazo = null, revisado_en = now(), revisado_por = v_user
     where id = p_id and estado = 'pendiente';
    if not found then
      raise exception 'Plato no pendiente' using errcode = 'P0002';
    end if;
    update public.ingrediente set verificado = true
     where id in (select ingrediente_id from public.plato_compartido_ingrediente
                  where plato_compartido_id = p_id);
  elsif p_decision = 'rechazar' then
    update public.plato_compartido
       set estado = 'rechazado', motivo_rechazo = left(btrim(p_motivo), 300),
           revisado_en = now(), revisado_por = v_user
     where id = p_id and estado = 'pendiente';
    if not found then
      raise exception 'Plato no pendiente' using errcode = 'P0002';
    end if;
  else
    update public.plato_compartido
       set estado = 'retirado', revisado_en = now(), revisado_por = v_user
     where id = p_id and estado = 'publicado';
    if not found then
      raise exception 'Plato no publicado' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

revoke all on function public.crear_ingrediente(text, text, text)          from public, anon;
revoke all on function public.enviar_plato_a_catalogo(uuid, text)          from public, anon;
revoke all on function public.adoptar_plato_compartido(uuid, uuid)         from public, anon;
revoke all on function public.bandeja_revision()                           from public, anon;
revoke all on function public.revisar_plato_compartido(uuid, text, text)   from public, anon;
grant execute on function public.crear_ingrediente(text, text, text)        to authenticated;
grant execute on function public.enviar_plato_a_catalogo(uuid, text)        to authenticated;
grant execute on function public.adoptar_plato_compartido(uuid, uuid)       to authenticated;
grant execute on function public.bandeja_revision()                         to authenticated;
grant execute on function public.revisar_plato_compartido(uuid, text, text) to authenticated;
