-- =============================================================================
-- Menú planificado, valoraciones y vocabulario de grupos del motor de menú (D-041, D-042)
--
--   GRUPOS        el vocabulario de grupos pasa a coincidir con el del dominio y con el
--                 «Recomendador de cenas» del cole: pasta y arroz se distinguen y carne no se
--                 parte en blanca/roja (el recomendador no las distingue). Producción aún no tiene
--                 datos, así que el cambio es seguro; los valores antiguos se convierten igual.
--   COMIDA        comida_planificada: qué se cena cada día (una por hogar, día y momento).
--   DÍA           dia_hogar: marcas de día, hoy «llego tarde» (tiempo máximo de 15 min).
--   VALORACIÓN    valoracion_plato: de 1 a 5 por persona del hogar; el motor usa la media.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Grupos alimenticios
-- -----------------------------------------------------------------------------
alter domain public.grupo_alimenticio drop constraint grupo_alimenticio_check;

update public.plato                    set grupo = case grupo when 'cereal_patata' then 'pasta' when 'carne_blanca' then 'carne' when 'carne_roja' then 'carne' else grupo end;
update public.plato_compartido         set grupo = case grupo when 'cereal_patata' then 'pasta' when 'carne_blanca' then 'carne' when 'carne_roja' then 'carne' else grupo end;
update public.menu_cole_dia            set grupo_primero = case grupo_primero when 'cereal_patata' then 'pasta' when 'carne_blanca' then 'carne' when 'carne_roja' then 'carne' else grupo_primero end,
                                           grupo_segundo = case grupo_segundo when 'cereal_patata' then 'pasta' when 'carne_blanca' then 'carne' when 'carne_roja' then 'carne' else grupo_segundo end;

alter domain public.grupo_alimenticio add constraint grupo_alimenticio_check
  check (value in ('verdura', 'legumbre', 'pasta', 'arroz', 'pescado', 'carne', 'huevo', 'lacteo', 'otro'));

-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------
create table public.comida_planificada (
  id          uuid primary key default gen_random_uuid(),
  hogar_id    uuid not null references public.hogar (id) on delete cascade,
  fecha       date not null,
  momento     text not null default 'cena' check (momento in ('comida', 'cena')),
  plato_id    uuid not null,
  -- Suma de los factores de ración de quienes comen (D-012); la fija quien planifica.
  raciones    numeric(4, 2) not null check (raciones > 0 and raciones <= 40),
  estado      text not null default 'planificada' check (estado in ('planificada', 'cocinada', 'saltada')),
  creado_por  uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now(),
  unique (hogar_id, fecha, momento),
  foreign key (plato_id, hogar_id) references public.plato (id, hogar_id) on delete cascade
);
create index comida_planificada_plato_idx on public.comida_planificada (plato_id, hogar_id);
create index comida_planificada_creado_por_idx on public.comida_planificada (creado_por);

create table public.dia_hogar (
  hogar_id     uuid not null references public.hogar (id) on delete cascade,
  fecha        date not null,
  llega_tarde  boolean not null default false,
  primary key (hogar_id, fecha)
);

create table public.valoracion_plato (
  hogar_id    uuid not null,
  plato_id    uuid not null,
  persona_id  uuid not null,
  puntos      smallint not null check (puntos between 1 and 5),
  en          timestamptz not null default now(),
  primary key (plato_id, persona_id),
  foreign key (plato_id, hogar_id) references public.plato (id, hogar_id) on delete cascade,
  foreign key (persona_id, hogar_id) references public.persona (id, hogar_id) on delete cascade
);
create index valoracion_plato_plato_idx on public.valoracion_plato (plato_id, hogar_id);
create index valoracion_plato_persona_idx on public.valoracion_plato (persona_id, hogar_id);
create index valoracion_plato_hogar_idx on public.valoracion_plato (hogar_id);

-- -----------------------------------------------------------------------------
-- 3. Seguridad: RLS forzada, `anon` sin nada, el hogar gestiona lo suyo
-- -----------------------------------------------------------------------------
alter table public.comida_planificada enable row level security;
alter table public.dia_hogar          enable row level security;
alter table public.valoracion_plato   enable row level security;
alter table public.comida_planificada force row level security;
alter table public.dia_hogar          force row level security;
alter table public.valoracion_plato   force row level security;

revoke all on public.comida_planificada, public.dia_hogar, public.valoracion_plato from anon, public;

grant select, delete on public.comida_planificada to authenticated;
grant insert (hogar_id, fecha, momento, plato_id, raciones) on public.comida_planificada to authenticated;
grant update (plato_id, raciones, estado) on public.comida_planificada to authenticated;
grant select, insert, update, delete on public.dia_hogar to authenticated;
grant select, insert, update, delete on public.valoracion_plato to authenticated;

create policy comida_planificada_all on public.comida_planificada for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy dia_hogar_all on public.dia_hogar for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
create policy valoracion_plato_all on public.valoracion_plato for all to authenticated
  using ((select privado.es_miembro(hogar_id))) with check ((select privado.es_miembro(hogar_id)));
