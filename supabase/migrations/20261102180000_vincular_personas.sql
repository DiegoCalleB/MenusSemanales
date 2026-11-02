-- =============================================================================
-- Vincular cada persona del hogar con su cuenta (D-091)
--
-- El secreto de los regalos (D-087) depende de saber QUÉ cuenta es QUÉ persona. Ese vínculo no
-- puede cambiarlo cualquier miembro (D-088), así que solo se crea por dos puertas estrechas:
--
--  · Invitación para una persona: un administrador genera un código para «Ana»; cuando Ana entra
--    con ese código su cuenta queda vinculada a su persona. El código es de un solo uso y caduca.
--  · Vincularse a sí mismo: el administrador que creó el hogar elige cuál de las personas es él.
--
-- Una cuenta solo puede tener una persona por hogar y una persona solo una cuenta.
-- Límite reconocido: quien tiene el código (o es administrador) podría vincularse a otra persona
-- antes que ella; es confianza entre miembros del hogar, no una barrera contra extraños.
-- =============================================================================

alter table public.invitacion add column persona_id uuid;
alter table public.invitacion
  add constraint invitacion_persona_fk foreign key (persona_id, hogar_id)
  references public.persona (id, hogar_id) on delete cascade;
create index invitacion_persona_idx on public.invitacion (persona_id, hogar_id);

-- Código para que una persona concreta entre y quede vinculada. Se devuelve en claro UNA vez.
create function public.crear_invitacion_persona(p_hogar_id uuid, p_persona_id uuid)
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
  if not exists (select 1 from public.persona p
                  where p.id = p_persona_id and p.hogar_id = p_hogar_id and p.activa and p.user_id is null) then
    raise exception 'Esa persona no existe, está desactivada o ya tiene cuenta' using errcode = '22023';
  end if;

  -- Un solo código vivo por persona: el anterior deja de valer.
  delete from public.invitacion
   where hogar_id = p_hogar_id and persona_id = p_persona_id and usada_en is null;

  v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 10));
  insert into public.invitacion (hogar_id, persona_id, codigo_hash, rol, creada_por)
  values (p_hogar_id, p_persona_id, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), 'miembro', v_user);
  return v_codigo;
end;
$$;

-- Canjear un código: entra al hogar y, si el código era para una persona, queda vinculada a ella.
create or replace function public.unirse_a_hogar(p_codigo text)
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

  if v_inv.persona_id is not null then
    if exists (select 1 from public.persona
                where hogar_id = v_inv.hogar_id and user_id = v_user and id <> v_inv.persona_id) then
      raise exception 'Tu cuenta ya está vinculada a otra persona de este hogar' using errcode = '22023';
    end if;
    update public.persona set user_id = v_user
     where id = v_inv.persona_id and hogar_id = v_inv.hogar_id and user_id is null;
    if not found and not exists (select 1 from public.persona
                                  where id = v_inv.persona_id and user_id = v_user) then
      raise exception 'Esa persona ya tiene otra cuenta' using errcode = '22023';
    end if;
  end if;

  insert into public.miembro (hogar_id, user_id, rol)
  values (v_inv.hogar_id, v_user, v_inv.rol)
  on conflict (hogar_id, user_id) do nothing;

  update public.invitacion set usada_por = v_user, usada_en = now() where id = v_inv.id;
  return v_inv.hogar_id;
end;
$$;

-- El administrador elige cuál de las personas es él.
create function public.vincular_persona_propia(p_hogar_id uuid, p_persona_id uuid)
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
  if not privado.es_admin(p_hogar_id) then
    raise exception 'Solo un administrador puede vincularse a una persona' using errcode = '42501';
  end if;
  if exists (select 1 from public.persona where hogar_id = p_hogar_id and user_id = v_user) then
    raise exception 'Tu cuenta ya está vinculada a una persona de este hogar' using errcode = '22023';
  end if;
  update public.persona set user_id = v_user
   where id = p_persona_id and hogar_id = p_hogar_id and activa and user_id is null;
  if not found then
    raise exception 'Esa persona no existe, está desactivada o ya tiene cuenta' using errcode = '22023';
  end if;
end;
$$;

-- Qué persona es la mía en este hogar (null si aún no me he vinculado).
create function public.mi_persona(p_hogar_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id from public.persona p
   where p.hogar_id = p_hogar_id and p.user_id = (select auth.uid())
$$;

revoke all on function public.crear_invitacion_persona(uuid, uuid) from public, anon;
revoke all on function public.vincular_persona_propia(uuid, uuid)  from public, anon;
revoke all on function public.mi_persona(uuid)                     from public, anon;
grant execute on function public.crear_invitacion_persona(uuid, uuid) to authenticated;
grant execute on function public.vincular_persona_propia(uuid, uuid)  to authenticated;
grant execute on function public.mi_persona(uuid)                     to authenticated;
