-- =============================================================================
-- Centro (colegio) compartido
--
-- El menú del comedor es el mismo para todas las familias de un colegio: se carga una vez y
-- lo ven todas. Es una EXCEPCIÓN deliberada al aislamiento por hogar, con estas salvaguardas:
--   * El vínculo es del HOGAR (nunca de un niño): no se comparte quién es cada niño.
--   * Un hogar no puede ver qué otros hogares están vinculados al mismo centro.
--   * Compartir centro NO da acceso a ningún dato privado de otro hogar.
--   * Alta solo mediante un código (caduca, tiene límite de usos y se puede revocar).
--   * Todo cambio en el menú queda en un historial inmutable que solo ven los curadores.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Corrección de la migración de fundación: derecho de supresión (RGPD)
--    hogar.creado_por tenía ON DELETE RESTRICT: no se podía borrar la cuenta de quien creó
--    un hogar. Ahora la autoría se anula (SET NULL) y el hogar permanece.
-- -----------------------------------------------------------------------------
alter table public.hogar alter column creado_por drop not null;
alter table public.hogar drop constraint hogar_creado_por_fkey;
alter table public.hogar
  add constraint hogar_creado_por_fkey
  foreign key (creado_por) references auth.users (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 1. Grupos alimenticios (dominio reutilizable: menú del cole y catálogo de platos)
-- -----------------------------------------------------------------------------
create domain public.grupo_alimenticio as text
  check (value in ('verdura', 'legumbre', 'cereal_patata', 'pescado', 'carne_blanca',
                   'carne_roja', 'huevo', 'lacteo', 'otro'));

-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------
create table public.centro (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 3 and 120),
  localidad   text check (char_length(localidad) <= 80),
  creado_por  uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index centro_creado_por_idx on public.centro (creado_por);

-- Vínculo hogar <-> centro. 'curador' puede crear códigos, borrar días del menú y ver el historial.
create table public.centro_hogar (
  centro_id  uuid not null references public.centro (id) on delete cascade,
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  rol        text not null default 'miembro' check (rol in ('curador', 'miembro')),
  unido_en   timestamptz not null default now(),
  primary key (centro_id, hogar_id)
);
create index centro_hogar_hogar_id_idx on public.centro_hogar (hogar_id);

-- Códigos para unirse a un centro (se comparten en el grupo de la clase). Solo se guarda el hash.
create table public.centro_codigo (
  id           uuid primary key default gen_random_uuid(),
  centro_id    uuid not null references public.centro (id) on delete cascade,
  codigo_hash  text not null unique,
  creado_por   uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en    timestamptz not null default now(),
  caduca_en    timestamptz not null default now() + interval '30 days',
  max_usos     integer not null default 50 check (max_usos between 1 and 500),
  usos         integer not null default 0 check (usos >= 0),
  revocado     boolean not null default false,
  check (usos <= max_usos)
);
create index centro_codigo_centro_id_idx on public.centro_codigo (centro_id);
create index centro_codigo_creado_por_idx on public.centro_codigo (creado_por);

create table public.menu_cole_dia (
  centro_id       uuid not null references public.centro (id) on delete cascade,
  fecha           date not null,
  primero         text check (char_length(btrim(primero)) between 1 and 200),
  segundo         text check (char_length(btrim(segundo)) between 1 and 200),
  postre          text check (char_length(btrim(postre)) between 1 and 200),
  grupo_primero   public.grupo_alimenticio,
  grupo_segundo   public.grupo_alimenticio,
  actualizado_en  timestamptz not null default now(),
  primary key (centro_id, fecha),
  check (primero is not null or segundo is not null)
);

-- Historial inmutable: nadie puede modificarlo ni borrarlo desde la API.
create table public.menu_cole_dia_historial (
  id         bigint generated always as identity primary key,
  centro_id  uuid not null references public.centro (id) on delete cascade,
  fecha      date not null,
  operacion  text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  anterior   jsonb,
  nuevo      jsonb,
  usuario    uuid references auth.users (id) on delete set null,
  en         timestamptz not null default now()
);
create index menu_cole_dia_historial_centro_fecha_idx
  on public.menu_cole_dia_historial (centro_id, fecha, en desc);
create index menu_cole_dia_historial_usuario_idx on public.menu_cole_dia_historial (usuario);

-- -----------------------------------------------------------------------------
-- 3. Funciones de pertenencia (esquema no expuesto `privado`)
-- -----------------------------------------------------------------------------
create function privado.es_de_centro(p_centro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.centro_hogar ch
    join public.miembro m on m.hogar_id = ch.hogar_id
    where ch.centro_id = p_centro_id and m.user_id = (select auth.uid())
  );
$$;

create function privado.es_curador(p_centro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.centro_hogar ch
    join public.miembro m on m.hogar_id = ch.hogar_id
    where ch.centro_id = p_centro_id and ch.rol = 'curador' and m.user_id = (select auth.uid())
  );
$$;

revoke all on function privado.es_de_centro(uuid) from public;
revoke all on function privado.es_curador(uuid)   from public;
grant execute on function privado.es_de_centro(uuid) to authenticated;
grant execute on function privado.es_curador(uuid)   to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Disparadores: fecha de actualización e historial
-- -----------------------------------------------------------------------------
create function privado.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create function privado.registrar_cambio_menu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.menu_cole_dia_historial (centro_id, fecha, operacion, anterior, nuevo, usuario)
    values (old.centro_id, old.fecha, tg_op, to_jsonb(old), null, (select auth.uid()));
  elsif tg_op = 'INSERT' then
    insert into public.menu_cole_dia_historial (centro_id, fecha, operacion, anterior, nuevo, usuario)
    values (new.centro_id, new.fecha, tg_op, null, to_jsonb(new), (select auth.uid()));
  else
    insert into public.menu_cole_dia_historial (centro_id, fecha, operacion, anterior, nuevo, usuario)
    values (new.centro_id, new.fecha, tg_op, to_jsonb(old), to_jsonb(new), (select auth.uid()));
  end if;
  return null;
end;
$$;

revoke all on function privado.tocar_actualizado_en()  from public;
revoke all on function privado.registrar_cambio_menu() from public;

create trigger menu_cole_dia_actualizado_en
  before update on public.menu_cole_dia
  for each row execute function privado.tocar_actualizado_en();

create trigger menu_cole_dia_historial_trg
  after insert or update or delete on public.menu_cole_dia
  for each row execute function privado.registrar_cambio_menu();

-- -----------------------------------------------------------------------------
-- 5. RLS y privilegios mínimos
-- -----------------------------------------------------------------------------
alter table public.centro                   enable row level security;
alter table public.centro_hogar             enable row level security;
alter table public.centro_codigo            enable row level security;
alter table public.menu_cole_dia            enable row level security;
alter table public.menu_cole_dia_historial  enable row level security;

alter table public.centro                   force row level security;
alter table public.centro_hogar             force row level security;
alter table public.centro_codigo            force row level security;
alter table public.menu_cole_dia            force row level security;
alter table public.menu_cole_dia_historial  force row level security;

revoke all on public.centro, public.centro_hogar, public.centro_codigo,
              public.menu_cole_dia, public.menu_cole_dia_historial from anon, public;

grant select                              on public.centro                  to authenticated;
grant update (nombre, localidad)          on public.centro                  to authenticated;
grant select, delete                      on public.centro_hogar            to authenticated;
grant select                              on public.centro_codigo           to authenticated;
grant update (revocado)                   on public.centro_codigo           to authenticated;
grant select, insert, update, delete      on public.menu_cole_dia           to authenticated;
grant select                              on public.menu_cole_dia_historial to authenticated;

-- centro: lo ven los hogares vinculados; solo un curador edita nombre y localidad.
create policy centro_select on public.centro for select to authenticated
  using ((select privado.es_de_centro(id)));
create policy centro_update on public.centro for update to authenticated
  using ((select privado.es_curador(id)))
  with check ((select privado.es_curador(id)));

-- centro_hogar: cada hogar ve SOLO su propio vínculo (nunca qué otros hogares participan) y
-- puede salir del centro si es administrador de su hogar. El alta va por unirse_a_centro().
create policy centro_hogar_select on public.centro_hogar for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy centro_hogar_delete on public.centro_hogar for delete to authenticated
  using ((select privado.es_admin(hogar_id)));

-- centro_codigo: solo los curadores los ven y pueden revocarlos (única columna modificable).
create policy centro_codigo_select on public.centro_codigo for select to authenticated
  using ((select privado.es_curador(centro_id)));
create policy centro_codigo_update on public.centro_codigo for update to authenticated
  using ((select privado.es_curador(centro_id)))
  with check ((select privado.es_curador(centro_id)));

-- menu_cole_dia: cualquier hogar vinculado lee y propone; solo un curador borra.
-- WITH CHECK impide mover un día a un centro ajeno.
create policy menu_select on public.menu_cole_dia for select to authenticated
  using ((select privado.es_de_centro(centro_id)));
create policy menu_insert on public.menu_cole_dia for insert to authenticated
  with check ((select privado.es_de_centro(centro_id)));
create policy menu_update on public.menu_cole_dia for update to authenticated
  using ((select privado.es_de_centro(centro_id)))
  with check ((select privado.es_de_centro(centro_id)));
create policy menu_delete on public.menu_cole_dia for delete to authenticated
  using ((select privado.es_curador(centro_id)));

-- historial: solo lectura y solo para curadores (contiene el autor de cada cambio).
create policy menu_historial_select on public.menu_cole_dia_historial for select to authenticated
  using ((select privado.es_curador(centro_id)));

-- -----------------------------------------------------------------------------
-- 6. Funciones de la API (SECURITY DEFINER: operan donde el usuario aún no tiene permiso)
-- -----------------------------------------------------------------------------

-- Crea un centro y vincula el hogar como curador. Límite de 3 centros por usuario (anti-spam).
create function public.crear_centro(p_hogar_id uuid, p_nombre text, p_localidad text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_centro uuid;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador del hogar puede crear un centro' using errcode = '42501';
  end if;
  if (select count(*) from public.centro where creado_por = v_user) >= 3 then
    raise exception 'Límite de centros alcanzado' using errcode = '54000';
  end if;

  insert into public.centro (nombre, localidad, creado_por)
  values (p_nombre, p_localidad, v_user)
  returning id into v_centro;

  insert into public.centro_hogar (centro_id, hogar_id, rol) values (v_centro, p_hogar_id, 'curador');
  return v_centro;
end;
$$;

-- Devuelve el código en claro UNA vez; en base de datos solo queda su hash.
create function public.crear_codigo_centro(
  p_centro_id uuid, p_dias integer default 30, p_max_usos integer default 50
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_codigo text;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_curador(p_centro_id) then
    raise exception 'Solo un curador puede crear códigos' using errcode = '42501';
  end if;
  if p_dias not between 1 and 90 or p_max_usos not between 1 and 500 then
    raise exception 'Parámetros fuera de rango' using errcode = '22023';
  end if;

  v_codigo := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 12));

  insert into public.centro_codigo (centro_id, codigo_hash, creado_por, caduca_en, max_usos)
  values (p_centro_id,
          encode(extensions.digest(v_codigo, 'sha256'), 'hex'),
          v_user,
          now() + make_interval(days => p_dias),
          p_max_usos);

  return v_codigo;
end;
$$;

-- Vincula un hogar a un centro con un código. Idempotente: repetirlo no consume otro uso.
-- El error es el mismo para código inexistente, caducado, revocado o agotado (no revela cuál).
create function public.unirse_a_centro(p_hogar_id uuid, p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_cod  public.centro_codigo%rowtype;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador del hogar puede vincularlo a un centro'
      using errcode = '42501';
  end if;

  select * into v_cod
  from public.centro_codigo
  where codigo_hash = encode(extensions.digest(upper(btrim(p_codigo)), 'sha256'), 'hex')
  for update;

  if not found or v_cod.revocado or v_cod.caduca_en <= now() then
    raise exception 'Código no válido o caducado' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.centro_hogar
             where centro_id = v_cod.centro_id and hogar_id = p_hogar_id) then
    return v_cod.centro_id;
  end if;

  if v_cod.usos >= v_cod.max_usos then
    raise exception 'Código no válido o caducado' using errcode = 'P0002';
  end if;

  insert into public.centro_hogar (centro_id, hogar_id) values (v_cod.centro_id, p_hogar_id);
  update public.centro_codigo set usos = usos + 1 where id = v_cod.id;
  return v_cod.centro_id;
end;
$$;

revoke all on function public.crear_centro(uuid, text, text)             from public, anon;
revoke all on function public.crear_codigo_centro(uuid, integer, integer) from public, anon;
revoke all on function public.unirse_a_centro(uuid, text)                from public, anon;
grant execute on function public.crear_centro(uuid, text, text)             to authenticated;
grant execute on function public.crear_codigo_centro(uuid, integer, integer) to authenticated;
grant execute on function public.unirse_a_centro(uuid, text)                to authenticated;
