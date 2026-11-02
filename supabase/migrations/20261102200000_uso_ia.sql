-- =============================================================================
-- Tope de uso de la IA por hogar (D-098)
--
-- Cada llamada a la IA gasta dinero de quien paga la clave. El servidor, antes de llamar, apunta el
-- uso aquí; si el hogar ha llegado a su tope del día, no se llama. El tope vive en la base de
-- datos, no en el cliente: ningún miembro puede subírselo (la tabla de ajustes no tiene permisos
-- para usuarios; se cambia a mano con SQL).
-- =============================================================================

create table public.ia_uso (
  hogar_id  uuid not null references public.hogar (id) on delete cascade,
  dia       date not null,
  usadas    integer not null default 0 check (usadas >= 0),
  primary key (hogar_id, dia)
);

create table public.ia_ajuste (
  hogar_id       uuid primary key references public.hogar (id) on delete cascade,
  limite_diario  integer not null default 40 check (limite_diario between 0 and 1000)
);

alter table public.ia_uso    enable row level security;
alter table public.ia_ajuste enable row level security;
alter table public.ia_uso    force row level security;
alter table public.ia_ajuste force row level security;
revoke all on public.ia_uso, public.ia_ajuste from anon, authenticated, public;

-- Apunta una llamada de IA del hogar. Devuelve cuántas lleva hoy y el tope; si ya está al tope,
-- falla (53400) sin apuntar nada. Solo los miembros del hogar.
create function public.usar_ia(p_hogar_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer;
  v_dia    date := (now() at time zone 'Europe/Madrid')::date;
  v_usadas integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere sesión' using errcode = '28000';
  end if;
  if not privado.es_miembro(p_hogar_id) then
    raise exception 'No perteneces a este hogar' using errcode = '42501';
  end if;

  select coalesce((select a.limite_diario from public.ia_ajuste a where a.hogar_id = p_hogar_id), 40)
    into v_limite;

  insert into public.ia_uso (hogar_id, dia, usadas) values (p_hogar_id, v_dia, 0)
  on conflict (hogar_id, dia) do nothing;

  -- Se suma solo si cabe, en una sola orden: dos llamadas a la vez no se pasan del tope.
  update public.ia_uso set usadas = usadas + 1
   where hogar_id = p_hogar_id and dia = v_dia and usadas < v_limite
  returning usadas into v_usadas;

  if v_usadas is null then
    raise exception 'Tope diario de IA alcanzado' using errcode = '53400';
  end if;
  return jsonb_build_object('usadas', v_usadas, 'limite', v_limite);
end;
$$;

revoke all on function public.usar_ia(uuid) from public, anon;
grant execute on function public.usar_ia(uuid) to authenticated;
