-- =============================================================================
-- Sincronización del hogar entre dispositivos (D-063)
--
-- Cada hogar guarda su plan completo (menú, compra, despensa, tareas…) como UN documento versionado.
-- Los dispositivos lo leen, lo guardan con control de versión (si alguien guardó antes, el guardado
-- se rechaza y el cliente reaplica sus cambios sobre lo nuevo) y se enteran de los cambios por
-- Realtime. Solo los miembros del hogar leen; nadie escribe directamente: se guarda con la función.
-- =============================================================================

create table public.hogar_estado (
  hogar_id        uuid primary key references public.hogar (id) on delete cascade,
  version         bigint not null default 1 check (version >= 1),
  estado          jsonb not null check (jsonb_typeof(estado) = 'object'),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null
);
create index hogar_estado_actualizado_por_idx on public.hogar_estado (actualizado_por);

alter table public.hogar_estado enable row level security;
alter table public.hogar_estado force row level security;
revoke all on public.hogar_estado from anon, public;
grant select on public.hogar_estado to authenticated;

create policy hogar_estado_select on public.hogar_estado for select to authenticated
  using ((select privado.es_miembro(hogar_id)));

-- Guarda el estado si la versión que el cliente conoce sigue siendo la actual (0 = aún no hay estado).
-- Devuelve la versión nueva. Si otro dispositivo guardó antes: error 40001 y el cliente reintenta.
create function public.guardar_estado_hogar(
  p_hogar_id uuid, p_version_esperada bigint, p_estado jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_version bigint;
begin
  if v_user is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  if p_estado is null or jsonb_typeof(p_estado) <> 'object' then
    raise exception 'El estado debe ser un objeto' using errcode = '22023';
  end if;
  if octet_length(p_estado::text) > 1500000 then
    raise exception 'El estado es demasiado grande' using errcode = '54000';
  end if;

  if p_version_esperada = 0 then
    begin
      insert into public.hogar_estado (hogar_id, version, estado, actualizado_por)
      values (p_hogar_id, 1, p_estado, v_user)
      returning version into v_version;
    exception when unique_violation then
      raise exception 'Conflicto de versión' using errcode = '40001';
    end;
    return v_version;
  end if;

  update public.hogar_estado
     set estado = p_estado, version = version + 1, actualizado_en = now(), actualizado_por = v_user
   where hogar_id = p_hogar_id and version = p_version_esperada
  returning version into v_version;

  if v_version is null then
    raise exception 'Conflicto de versión' using errcode = '40001';
  end if;
  return v_version;
end;
$$;

revoke all on function public.guardar_estado_hogar(uuid, bigint, jsonb) from public, anon;
grant execute on function public.guardar_estado_hogar(uuid, bigint, jsonb) to authenticated;

-- Realtime: los dispositivos reciben los cambios (la RLS decide quién los ve).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hogar_estado;
  end if;
end $$;
