-- =============================================================================
-- «Lo de hoy»: quién ha hecho qué cada día (D-108)
--
-- Una fila por cosa hecha por una persona un día («Diego · Cena · 3 nov»). Es un diario: se añade
-- y se quita, no se edita. El id lo calcula la app (UUID v5 de fecha + cosa + persona), así que
-- tocar dos veces lo mismo no duplica, y la restricción única lo garantiza también aquí.
-- =============================================================================

create table public.registro_hogar (
  id          uuid primary key,
  hogar_id    uuid not null references public.hogar (id) on delete cascade,
  fecha       date not null,
  que         text not null check (char_length(btrim(que)) between 2 and 40),
  persona_id  uuid not null,
  creado_en   timestamptz not null default now(),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
-- La misma cosa el mismo día por la misma persona, una sola vez (sin mayúsculas ni espacios de más).
create unique index registro_hogar_unico_uidx
  on public.registro_hogar (hogar_id, fecha, lower(btrim(que)), persona_id);
create index registro_hogar_fecha_idx on public.registro_hogar (hogar_id, fecha desc);
create index registro_hogar_persona_idx on public.registro_hogar (persona_id, hogar_id);

alter table public.registro_hogar enable row level security;
alter table public.registro_hogar force row level security;
revoke all on public.registro_hogar from anon, authenticated, public;
grant select, insert, update, delete on public.registro_hogar to authenticated;
create policy registro_hogar_all on public.registro_hogar for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));

-- Los últimos 60 días del hogar.
create function public.leer_registro_tablas(p_hogar_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  return jsonb_build_object('filas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', r.id, 'fecha', r.fecha::text, 'que', r.que, 'personaId', r.persona_id)
           order by r.fecha, r.id)
      from public.registro_hogar r
     where r.hogar_id = p_hogar_id
       and r.fecha >= (now() at time zone 'Europe/Madrid')::date - 60), '[]'::jsonb));
end;
$$;

-- Formato de `p_cambios`:
--   {"upsert": [{id, fecha, que, personaId}], "borrar": [ids]}
create function public.aplicar_cambios_registro(p_hogar_id uuid, p_cambios jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
    raise exception 'Cambios no válidos' using errcode = '22023';
  end if;
  if octet_length(p_cambios::text) > 500000 then
    raise exception 'Demasiados cambios de una vez' using errcode = '54000';
  end if;

  insert into public.registro_hogar (id, hogar_id, fecha, que, persona_id)
  select x.id, p_hogar_id, x.fecha, btrim(x.que), x."personaId"
    from jsonb_to_recordset(coalesce(p_cambios->'upsert', '[]'))
         as x(id uuid, fecha date, que text, "personaId" uuid)
  on conflict (id) do nothing;

  delete from public.registro_hogar
   where hogar_id = p_hogar_id
     and id in (select (jsonb_array_elements_text(coalesce(p_cambios->'borrar', '[]')))::uuid);
end;
$$;

revoke all on function public.leer_registro_tablas(uuid)            from public, anon;
revoke all on function public.aplicar_cambios_registro(uuid, jsonb) from public, anon;
grant execute on function public.leer_registro_tablas(uuid)            to authenticated;
grant execute on function public.aplicar_cambios_registro(uuid, jsonb) to authenticated;

-- En directo: lo que apunta una persona aparece en el móvil de la otra.
alter table public.registro_hogar replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registro_hogar') then
    alter publication supabase_realtime add table public.registro_hogar;
  end if;
end $$;
