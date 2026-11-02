-- =============================================================================
-- Esquema completo del hogar en tablas (D-085, fase 1)
--
-- Hasta ahora la app guardaba todo el hogar en UN documento (`hogar_estado`, D-063). Esta migración
-- crea las tablas que faltan para sacar de ahí lo que no tenía sitio: cumpleaños, apuntes, fechas
-- señaladas, tareas de la casa, tareas por persona, comida del mediodía y ajustes; y las tablas de
-- catálogo globales (plantillas de la casa, ideas de regalo, secciones del súper) que hoy viven en
-- el código. Es ADITIVA: no cambia ninguna tabla ni función que la app use hoy.
--
-- Seguridad (D-064): RLS forzada, nada para `anon`, y a `authenticated` solo lo que cada tabla
-- necesita. Los catálogos son de solo lectura (se siembran con migraciones).
-- El secreto de los regalos se aplica EN LA BASE DE DATOS: quien cumple (la persona del hogar
-- vinculada a su cuenta) no puede leer ni las ideas ni el estado de su propio regalo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Ajustes del hogar
-- ---------------------------------------------------------------------------
create table public.hogar_ajuste (
  hogar_id        uuid primary key references public.hogar (id) on delete cascade,
  horizonte       text not null default 'semana' check (horizonte in ('semana', 'quincena')),
  actualizado_en  timestamptz not null default now()
);

create table public.ingrediente_excluido (
  hogar_id        uuid not null references public.hogar (id) on delete cascade,
  ingrediente_id  uuid not null references public.ingrediente (id) on delete cascade,
  primary key (hogar_id, ingrediente_id)
);
create index ingrediente_excluido_ingrediente_idx on public.ingrediente_excluido (ingrediente_id);

-- Días en que no se cena en casa («saltado»): junto a «llega tarde», que ya está.
alter table public.dia_hogar add column saltado boolean not null default false;

-- ---------------------------------------------------------------------------
-- Cumpleaños y regalos
-- ---------------------------------------------------------------------------
create table public.cumple (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogar (id) on delete cascade,
  persona_id  uuid,                                    -- si es alguien del hogar
  nombre      text not null check (char_length(btrim(nombre)) between 1 and 60),
  dia         smallint not null check (dia between 1 and 31),
  mes         smallint not null check (mes between 1 and 12),
  anio        smallint check (anio between 1900 and 2100),
  relacion    text not null default 'familia' check (relacion in ('familia', 'amigo', 'cole', 'otro')),
  creado_en   timestamptz not null default now(),
  unique (id, hogar_id),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete set null (persona_id),
  check (dia <= case mes when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end)
);
create index cumple_hogar_id_idx on public.cumple (hogar_id);
create index cumple_persona_idx on public.cumple (persona_id, hogar_id);
create unique index cumple_persona_uidx on public.cumple (hogar_id, persona_id) where persona_id is not null;

-- Lo que NO debe ver quien cumple: estado del regalo, gustos e ideas.
create table public.cumple_regalo (
  cumple_id    uuid primary key,
  hogar_id     uuid not null,
  estado       text not null default 'sin-pensar' check (estado in ('sin-pensar', 'idea', 'comprado', 'entregado')),
  anio_estado  smallint check (anio_estado between 1900 and 2100),   -- el estado vale solo para ese año
  gustos       text[] not null default '{}' check (cardinality(gustos) <= 20),
  foreign key (cumple_id, hogar_id) references public.cumple (id, hogar_id) on delete cascade
);
create index cumple_regalo_hogar_idx on public.cumple_regalo (hogar_id);
create index cumple_regalo_cumple_hogar_idx on public.cumple_regalo (cumple_id, hogar_id);

create table public.cumple_idea (
  id         uuid primary key default gen_random_uuid(),
  hogar_id   uuid not null,
  cumple_id  uuid not null,
  texto      text not null check (char_length(btrim(texto)) between 1 and 200),
  origen     text not null default 'persona' check (origen in ('persona', 'ia', 'catalogo')),
  creado_en  timestamptz not null default now(),
  foreign key (cumple_id, hogar_id) references public.cumple (id, hogar_id) on delete cascade
);
create index cumple_idea_cumple_idx on public.cumple_idea (cumple_id, hogar_id);
create index cumple_idea_hogar_idx on public.cumple_idea (hogar_id);

-- ¿La persona que pregunta es quien cumple? (su persona del hogar está vinculada a su cuenta)
create function privado.es_quien_cumple(p_cumple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.cumple c
      join public.persona p on p.id = c.persona_id and p.hogar_id = c.hogar_id
     where c.id = p_cumple_id and p.user_id = (select auth.uid())
  );
$$;
revoke all on function privado.es_quien_cumple(uuid) from public;
grant execute on function privado.es_quien_cumple(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Fechas y apuntes
-- ---------------------------------------------------------------------------
create table public.apunte (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogar (id) on delete cascade,
  fecha       date not null,
  hasta       date,
  hora        time,
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 120),
  creado_por  uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now(),
  check (hasta is null or hasta > fecha)
);
create index apunte_hogar_fecha_idx on public.apunte (hogar_id, fecha);
create index apunte_creado_por_idx on public.apunte (creado_por);
create unique index apunte_unico_uidx on public.apunte (hogar_id, fecha, lower(btrim(titulo)));

create table public.fecha_senalada (
  hogar_id  uuid not null references public.hogar (id) on delete cascade,
  fecha     date not null,
  titulo    text not null check (char_length(btrim(titulo)) between 1 and 80),
  emoji     text not null default '📌' check (char_length(emoji) between 1 and 16),
  primary key (hogar_id, fecha)
);

-- ---------------------------------------------------------------------------
-- Tareas de la casa (recurrentes) y por persona
-- ---------------------------------------------------------------------------
create table public.tarea_casa (
  id              uuid primary key default gen_random_uuid(),
  hogar_id        uuid not null references public.hogar (id) on delete cascade,
  titulo          text not null check (char_length(btrim(titulo)) between 1 and 80),
  emoji           text not null default '🏠' check (char_length(emoji) between 1 and 16),
  cada_dias       integer not null check (cada_dias between 1 and 3650),
  responsable_id  uuid,                              -- null = a los dos
  ultima_vez      date,
  desde           date not null,                     -- primera vez que toca si nunca se hizo
  aplazada_hasta  date,
  compra          text check (char_length(compra) <= 60),   -- qué comprar para hacerla
  creado_en       timestamptz not null default now(),
  unique (id, hogar_id),
  foreign key (responsable_id, hogar_id) references public.persona (id, hogar_id) on delete set null (responsable_id)
);
create index tarea_casa_hogar_idx on public.tarea_casa (hogar_id);
create index tarea_casa_responsable_idx on public.tarea_casa (responsable_id, hogar_id);
create unique index tarea_casa_titulo_uidx on public.tarea_casa (hogar_id, lower(btrim(titulo)));

create table public.tarea_persona (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null,
  persona_id  uuid not null,
  texto       text not null check (char_length(btrim(texto)) between 1 and 120),
  frecuencia  text not null default 'puntual' check (frecuencia in ('diaria', 'puntual')),
  creado_en   timestamptz not null default now(),
  unique (id, hogar_id),
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
create index tarea_persona_hogar_idx on public.tarea_persona (hogar_id);
create index tarea_persona_persona_idx on public.tarea_persona (persona_id, hogar_id);

create table public.tarea_persona_hecha (
  tarea_id  uuid not null,
  hogar_id  uuid not null,
  fecha     date not null,
  primary key (tarea_id, fecha),
  foreign key (tarea_id, hogar_id) references public.tarea_persona (id, hogar_id) on delete cascade
);
create index tarea_persona_hecha_hogar_idx on public.tarea_persona_hecha (hogar_id);
create index tarea_persona_hecha_tarea_hogar_idx on public.tarea_persona_hecha (tarea_id, hogar_id);

-- ---------------------------------------------------------------------------
-- La comida del mediodía (texto libre o plato del catálogo)
-- ---------------------------------------------------------------------------
create table public.almuerzo (
  id         uuid primary key default gen_random_uuid(),
  hogar_id   uuid not null references public.hogar (id) on delete cascade,
  fecha      date not null,
  texto      text not null check (char_length(btrim(texto)) between 1 and 80),
  plato_id   uuid,
  creado_en  timestamptz not null default now(),
  foreign key (plato_id, hogar_id) references public.plato (id, hogar_id) on delete set null (plato_id)
);
create index almuerzo_hogar_fecha_idx on public.almuerzo (hogar_id, fecha);
create index almuerzo_plato_idx on public.almuerzo (plato_id, hogar_id);
create unique index almuerzo_unico_uidx on public.almuerzo (hogar_id, fecha, lower(btrim(texto)));

-- ---------------------------------------------------------------------------
-- Catálogos globales (solo lectura; se siembran con migraciones). Antes vivían en el código.
-- ---------------------------------------------------------------------------
create table public.catalogo_categoria_super (
  id      text primary key check (id ~ '^[a-z_]{2,30}$'),
  nombre  text not null check (char_length(btrim(nombre)) between 1 and 60),
  emoji   text not null check (char_length(emoji) between 1 and 16),
  orden   smallint not null unique
);

-- Reglas para saber en qué sección del súper va un artículo escrito a mano. Gana la primera que
-- coincide (por orden). `patron` es una expresión regular sobre el texto en minúsculas y sin tildes.
create table public.catalogo_regla_categoria (
  id         uuid primary key default gen_random_uuid(),
  categoria  text not null references public.catalogo_categoria_super (id) on delete cascade,
  patron     text not null check (char_length(patron) between 1 and 1000),
  orden      smallint not null unique
);
create index catalogo_regla_categoria_categoria_idx on public.catalogo_regla_categoria (categoria);

create table public.catalogo_plantilla_casa (
  id          uuid primary key default gen_random_uuid(),
  conjunto    text not null check (conjunto in ('casa', 'gatos')),
  titulo      text not null check (char_length(btrim(titulo)) between 1 and 80),
  emoji       text not null check (char_length(emoji) between 1 and 16),
  cada_dias   integer not null check (cada_dias between 1 and 3650),
  empieza_en  smallint not null default 0 check (empieza_en between 0 and 365),
  compra      text check (char_length(compra) <= 60),
  orden       smallint not null,
  unique (conjunto, titulo),
  unique (conjunto, orden)
);

-- Ideas de regalo por edad (hasta `edad_hasta` años, inclusive) y, si aplica, por relación.
create table public.catalogo_idea_regalo (
  id          uuid primary key default gen_random_uuid(),
  edad_hasta  smallint not null check (edad_hasta between 0 and 200),
  relacion    text check (relacion in ('familia', 'amigo', 'cole', 'otro')),
  texto       text not null check (char_length(btrim(texto)) between 1 and 200),
  orden       smallint not null,
  unique (edad_hasta, relacion, texto)
);

-- ---------------------------------------------------------------------------
-- RLS y privilegios
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'hogar_ajuste', 'ingrediente_excluido', 'cumple', 'cumple_regalo', 'cumple_idea', 'apunte',
    'fecha_senalada', 'tarea_casa', 'tarea_persona', 'tarea_persona_hecha', 'almuerzo',
    'catalogo_categoria_super', 'catalogo_regla_categoria', 'catalogo_plantilla_casa',
    'catalogo_idea_regalo'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
  end loop;
end $$;

-- Tablas del hogar: cualquier miembro lee y escribe lo de su hogar.
do $$
declare t text;
begin
  foreach t in array array[
    'hogar_ajuste', 'ingrediente_excluido', 'cumple', 'apunte', 'fecha_senalada', 'tarea_casa',
    'tarea_persona', 'tarea_persona_hecha', 'almuerzo'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select privado.es_miembro(hogar_id)))
         with check ((select privado.es_miembro(hogar_id)))', t || '_hogar', t);
  end loop;
end $$;

-- Regalos: igual, pero NO para quien cumple.
grant select, insert, update, delete on public.cumple_regalo to authenticated;
grant select, insert, update, delete on public.cumple_idea to authenticated;
create policy cumple_regalo_secreto on public.cumple_regalo for all to authenticated
  using ((select privado.es_miembro(hogar_id)) and not (select privado.es_quien_cumple(cumple_id)))
  with check ((select privado.es_miembro(hogar_id)) and not (select privado.es_quien_cumple(cumple_id)));
create policy cumple_idea_secreto on public.cumple_idea for all to authenticated
  using ((select privado.es_miembro(hogar_id)) and not (select privado.es_quien_cumple(cumple_id)))
  with check ((select privado.es_miembro(hogar_id)) and not (select privado.es_quien_cumple(cumple_id)));

-- Catálogos: lectura para cualquiera con sesión; nadie escribe desde la app.
do $$
declare t text;
begin
  foreach t in array array[
    'catalogo_categoria_super', 'catalogo_regla_categoria', 'catalogo_plantilla_casa',
    'catalogo_idea_regalo'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)', t || '_lectura', t);
  end loop;
end $$;
