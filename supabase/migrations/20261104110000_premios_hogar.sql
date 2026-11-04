-- =============================================================================
-- Estrellas y premios del zafarrancho (D-117)
--
-- Las estrellas NO se guardan: se calculan (una por tarea hecha en un día). Aquí van solo los
-- premios que fija la familia («Elegir la peli», 5 estrellas) y los canjes (cuándo y quién
-- gastó estrellas en qué). Viajan por el mismo motor que «Lo de hoy»: las dos funciones de
-- lectura y escritura del registro se amplían con `premios` y `canjes`.
-- =============================================================================

create table public.premio_hogar (
  id        uuid primary key,
  hogar_id  uuid not null references public.hogar (id) on delete cascade,
  nombre    text not null check (char_length(btrim(nombre)) between 2 and 40),
  coste     integer not null check (coste between 1 and 99),
  emoji     text not null default '🎁' check (char_length(emoji) between 1 and 16),
  creado_en timestamptz not null default now()
);
create unique index premio_hogar_nombre_uidx on public.premio_hogar (hogar_id, lower(btrim(nombre)));

-- Un canje guarda el nombre y el coste de entonces: cambiar o borrar el premio no reescribe el pasado.
create table public.canje_hogar (
  id         uuid primary key,
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  premio_id  uuid,
  nombre     text not null check (char_length(btrim(nombre)) between 2 and 40),
  coste      integer not null check (coste between 1 and 99),
  persona_id uuid not null,
  fecha      date not null,
  creado_en  timestamptz not null default now(),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
create index canje_hogar_persona_idx on public.canje_hogar (persona_id, hogar_id);
create index canje_hogar_hogar_idx on public.canje_hogar (hogar_id, fecha desc);

alter table public.premio_hogar enable row level security;
alter table public.premio_hogar force row level security;
alter table public.canje_hogar enable row level security;
alter table public.canje_hogar force row level security;
revoke all on public.premio_hogar, public.canje_hogar from anon, authenticated, public;
grant select, insert, update, delete on public.premio_hogar, public.canje_hogar to authenticated;
create policy premio_hogar_all on public.premio_hogar for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy canje_hogar_all on public.canje_hogar for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));

create or replace function public.leer_registro_tablas(p_hogar_id uuid)
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
  return jsonb_build_object(
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'fecha', r.fecha::text, 'que', r.que, 'personaId', r.persona_id)
             order by r.fecha, r.id)
        from public.registro_hogar r
       where r.hogar_id = p_hogar_id
         and r.fecha >= (now() at time zone 'Europe/Madrid')::date - 60), '[]'::jsonb),
    'premios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'nombre', p.nombre, 'coste', p.coste, 'emoji', p.emoji)
             order by p.coste, p.nombre)
        from public.premio_hogar p where p.hogar_id = p_hogar_id), '[]'::jsonb),
    'canjes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'premioId', c.premio_id, 'nombre', c.nombre, 'coste', c.coste,
               'personaId', c.persona_id, 'fecha', c.fecha::text)
             order by c.fecha, c.id)
        from public.canje_hogar c where c.hogar_id = p_hogar_id), '[]'::jsonb));
end;
$$;

-- Formato de `p_cambios` (todo opcional):
--   {"upsert": [...], "borrar": [ids],                       -- lo de hoy
--    "premios": {"upsert": [{id, nombre, coste, emoji}], "borrar": [ids]},
--    "canjes":  {"upsert": [{id, premioId, nombre, coste, personaId, fecha}], "borrar": [ids]}}
create or replace function public.aplicar_cambios_registro(p_hogar_id uuid, p_cambios jsonb)
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

  insert into public.premio_hogar (id, hogar_id, nombre, coste, emoji)
  select x.id, p_hogar_id, btrim(x.nombre), x.coste, coalesce(nullif(btrim(x.emoji), ''), '🎁')
    from jsonb_to_recordset(coalesce(p_cambios->'premios'->'upsert', '[]'))
         as x(id uuid, nombre text, coste integer, emoji text)
  on conflict (id) do update
     set nombre = excluded.nombre, coste = excluded.coste, emoji = excluded.emoji
   where public.premio_hogar.hogar_id = p_hogar_id;

  delete from public.premio_hogar
   where hogar_id = p_hogar_id
     and id in (select (jsonb_array_elements_text(coalesce(p_cambios->'premios'->'borrar', '[]')))::uuid);

  insert into public.canje_hogar (id, hogar_id, premio_id, nombre, coste, persona_id, fecha)
  select x.id, p_hogar_id, x."premioId", btrim(x.nombre), x.coste, x."personaId", x.fecha
    from jsonb_to_recordset(coalesce(p_cambios->'canjes'->'upsert', '[]'))
         as x(id uuid, "premioId" uuid, nombre text, coste integer, "personaId" uuid, fecha date)
  on conflict (id) do nothing;

  delete from public.canje_hogar
   where hogar_id = p_hogar_id
     and id in (select (jsonb_array_elements_text(coalesce(p_cambios->'canjes'->'borrar', '[]')))::uuid);
end;
$$;

-- En directo: un premio o un canje aparece en el móvil de la otra persona.
alter table public.premio_hogar replica identity full;
alter table public.canje_hogar replica identity full;
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['premio_hogar', 'canje_hogar'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
