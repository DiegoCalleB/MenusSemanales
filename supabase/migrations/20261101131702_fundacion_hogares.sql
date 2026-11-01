-- =============================================================================
-- Fundación multi-hogar
--
-- Hogares, miembros (usuarios con cuenta), invitaciones, personas (comensales,
-- con o sin cuenta) y asistencia a las comidas (patrón semanal + excepciones).
--
-- Principios:
--   * Toda tabla de datos lleva hogar_id y está protegida con RLS por hogar.
--   * Las referencias entre tablas incluyen hogar_id (FK compuesta), de modo
--     que la propia base de datos impide enlazar filas de hogares distintos.
--   * La lógica de pertenencia vive en el esquema `privado`, que no se expone
--     por la API REST de Supabase.
--   * anon no tiene acceso a nada.
-- =============================================================================

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.hogar (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 80),
  creado_por  uuid not null default auth.uid() references auth.users (id) on delete restrict,
  creado_en   timestamptz not null default now()
);

create table public.miembro (
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  rol        text not null default 'miembro' check (rol in ('admin', 'miembro')),
  creado_en  timestamptz not null default now(),
  primary key (hogar_id, user_id)
);
create index miembro_user_id_idx on public.miembro (user_id);

create table public.invitacion (
  id           uuid primary key default gen_random_uuid(),
  hogar_id     uuid not null references public.hogar (id) on delete cascade,
  codigo_hash  text not null unique,               -- sha256 del código; el código en claro no se guarda
  rol          text not null default 'miembro' check (rol in ('admin', 'miembro')),
  creada_por   uuid not null references auth.users (id) on delete cascade,
  creada_en    timestamptz not null default now(),
  caduca_en    timestamptz not null default now() + interval '7 days',
  usada_por    uuid references auth.users (id) on delete set null,
  usada_en     timestamptz
);
create index invitacion_hogar_id_idx on public.invitacion (hogar_id);
create index invitacion_creada_por_idx on public.invitacion (creada_por);
create index invitacion_usada_por_idx on public.invitacion (usada_por);

create table public.persona (
  id            uuid primary key default gen_random_uuid(),
  hogar_id      uuid not null references public.hogar (id) on delete cascade,
  nombre        text not null check (char_length(btrim(nombre)) between 1 and 60),
  tipo          text not null check (tipo in ('adulto', 'nino')),
  factor_racion numeric(3, 2) not null default 1 check (factor_racion > 0 and factor_racion <= 2),
  user_id       uuid references auth.users (id) on delete set null,   -- si la persona tiene cuenta
  activa        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (id, hogar_id)                                               -- destino de las FK compuestas
);
create index persona_hogar_id_idx on public.persona (hogar_id);
create unique index persona_user_por_hogar_uidx on public.persona (hogar_id, user_id) where user_id is not null;
create index persona_user_id_idx on public.persona (user_id);

-- Patrón semanal: dónde come cada persona cada día y comida.
-- dia_semana sigue ISO 8601 (1 = lunes ... 7 = domingo).
create table public.patron_asistencia (
  hogar_id    uuid not null,
  persona_id  uuid not null,
  dia_semana  smallint not null check (dia_semana between 1 and 7),
  comida      text not null check (comida in ('comida', 'cena')),
  lugar       text not null check (lugar in ('casa', 'cole', 'trabajo', 'otro')),
  primary key (persona_id, dia_semana, comida),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
create index patron_asistencia_hogar_id_idx on public.patron_asistencia (hogar_id);

-- Excepciones a un día concreto (p. ej. Ana come en casa el jueves; tupper).
create table public.excepcion_asistencia (
  hogar_id     uuid not null,
  persona_id   uuid not null,
  fecha        date not null,
  comida       text not null check (comida in ('comida', 'cena')),
  lugar        text not null check (lugar in ('casa', 'cole', 'trabajo', 'otro')),
  para_llevar  boolean not null default false,    -- tupper: cuenta como comensal aunque coma fuera
  nota         text check (char_length(nota) <= 200),
  primary key (persona_id, fecha, comida),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
create index excepcion_asistencia_hogar_fecha_idx on public.excepcion_asistencia (hogar_id, fecha);

-- -----------------------------------------------------------------------------
-- Funciones de pertenencia (no expuestas por la API: esquema `privado`)
-- -----------------------------------------------------------------------------

create function privado.es_miembro(p_hogar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembro m
    where m.hogar_id = p_hogar_id and m.user_id = (select auth.uid())
  );
$$;

create function privado.es_admin(p_hogar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.miembro m
    where m.hogar_id = p_hogar_id and m.user_id = (select auth.uid()) and m.rol = 'admin'
  );
$$;

revoke all on function privado.es_miembro(uuid) from public;
revoke all on function privado.es_admin(uuid) from public;
grant execute on function privado.es_miembro(uuid) to authenticated;
grant execute on function privado.es_admin(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.hogar                enable row level security;
alter table public.miembro              enable row level security;
alter table public.invitacion           enable row level security;
alter table public.persona              enable row level security;
alter table public.patron_asistencia    enable row level security;
alter table public.excepcion_asistencia enable row level security;

alter table public.hogar                force row level security;
alter table public.miembro              force row level security;
alter table public.invitacion           force row level security;
alter table public.persona              force row level security;
alter table public.patron_asistencia    force row level security;
alter table public.excepcion_asistencia force row level security;

-- Privilegios mínimos: anon nada; authenticated solo lo que cada tabla permite.
revoke all on public.hogar, public.miembro, public.invitacion, public.persona,
              public.patron_asistencia, public.excepcion_asistencia from anon, public;

grant select, update, delete             on public.hogar                to authenticated;
grant select, update, delete             on public.miembro              to authenticated;
grant select                             on public.invitacion           to authenticated;
grant select, insert, update, delete     on public.persona              to authenticated;
grant select, insert, update, delete     on public.patron_asistencia    to authenticated;
grant select, insert, update, delete     on public.excepcion_asistencia to authenticated;

-- hogar: lo ve cualquier miembro; solo un admin lo edita o borra.
-- (La creación va por la función crear_hogar.)
create policy hogar_select on public.hogar for select to authenticated
  using ((select privado.es_miembro(id)));
create policy hogar_update on public.hogar for update to authenticated
  using ((select privado.es_admin(id)))
  with check ((select privado.es_admin(id)));
create policy hogar_delete on public.hogar for delete to authenticated
  using ((select privado.es_admin(id)));

-- miembro: los miembros ven a sus compañeros; solo un admin modifica o expulsa.
-- (El alta va por crear_hogar / unirse_a_hogar.)
create policy miembro_select on public.miembro for select to authenticated
  using ((select privado.es_miembro(hogar_id)));
create policy miembro_update on public.miembro for update to authenticated
  using ((select privado.es_admin(hogar_id)))
  with check ((select privado.es_admin(hogar_id)));
create policy miembro_delete on public.miembro for delete to authenticated
  using ((select privado.es_admin(hogar_id)));

-- invitacion: solo la ven los admins; se crea y consume mediante funciones.
create policy invitacion_select on public.invitacion for select to authenticated
  using ((select privado.es_admin(hogar_id)));

-- persona y asistencia: cualquier miembro del hogar lee y escribe.
-- WITH CHECK impide mover una fila a otro hogar.
create policy persona_all on public.persona for all to authenticated
  using ((select privado.es_miembro(hogar_id)))
  with check ((select privado.es_miembro(hogar_id)));

create policy patron_asistencia_all on public.patron_asistencia for all to authenticated
  using ((select privado.es_miembro(hogar_id)))
  with check ((select privado.es_miembro(hogar_id)));

create policy excepcion_asistencia_all on public.excepcion_asistencia for all to authenticated
  using ((select privado.es_miembro(hogar_id)))
  with check ((select privado.es_miembro(hogar_id)));

-- -----------------------------------------------------------------------------
-- Funciones de la API (RPC). Son SECURITY DEFINER porque operan sobre tablas
-- en las que el usuario aún no tiene permiso (alta de hogar, canje de código).
-- Cada una exige sesión y fija search_path.
-- -----------------------------------------------------------------------------

create function public.crear_hogar(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_hogar uuid;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  insert into public.hogar (nombre, creado_por) values (p_nombre, v_user)
  returning id into v_hogar;

  insert into public.miembro (hogar_id, user_id, rol) values (v_hogar, v_user, 'admin');
  return v_hogar;
end;
$$;

-- Devuelve el código en claro UNA vez; en base de datos solo queda su hash.
create function public.crear_invitacion(p_hogar_id uuid, p_rol text default 'miembro')
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
  if not privado.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador puede invitar' using errcode = '42501';
  end if;

  v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));

  insert into public.invitacion (hogar_id, codigo_hash, rol, creada_por)
  values (p_hogar_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), p_rol, v_user);

  return v_codigo;
end;
$$;

create function public.unirse_a_hogar(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inv  public.invitacion%rowtype;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;

  select * into v_inv
  from public.invitacion
  where codigo_hash = encode(extensions.digest(upper(btrim(p_codigo)), 'sha256'), 'hex')
    and usada_en is null
    and caduca_en > now()
  for update;

  if not found then
    raise exception 'Invitación no válida o caducada' using errcode = 'P0002';
  end if;

  insert into public.miembro (hogar_id, user_id, rol)
  values (v_inv.hogar_id, v_user, v_inv.rol)
  on conflict (hogar_id, user_id) do nothing;

  update public.invitacion set usada_por = v_user, usada_en = now() where id = v_inv.id;
  return v_inv.hogar_id;
end;
$$;

revoke all on function public.crear_hogar(text)              from public, anon;
revoke all on function public.crear_invitacion(uuid, text)   from public, anon;
revoke all on function public.unirse_a_hogar(text)           from public, anon;
grant execute on function public.crear_hogar(text)            to authenticated;
grant execute on function public.crear_invitacion(uuid, text) to authenticated;
grant execute on function public.unirse_a_hogar(text)         to authenticated;
