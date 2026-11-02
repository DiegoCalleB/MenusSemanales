-- =============================================================================
-- Secreto del regalo robusto (D-088)
--
-- Hallazgo: el secreto de D-087 dependía de dos vínculos que cualquier miembro podía cambiar:
--   · `persona.user_id` (qué cuenta es qué persona), con privilegio de UPDATE/INSERT sobre toda
--     la tabla; y
--   · `cumple.persona_id` (de quién es el cumpleaños), editable por cualquier miembro.
-- Quien cumple podía desvincularse (user_id = null, o persona_id = null en su cumpleaños) y dejar
-- de ser «quien cumple» para la base de datos, y entonces ver y editar su propio regalo.
--
-- Arreglo:
--  1. `persona.user_id` ya no se puede escribir directamente: solo con una función de confianza
--     (la de vincular, que se añadirá con la pantalla de personas). Se conceden columnas concretas.
--  2. Quien cumple no puede cambiar ni quitar el vínculo de su cumpleaños, ni borrarlo.
-- =============================================================================

-- 1. Privilegios por columna en persona (user_id queda fuera).
revoke insert, update on public.persona from authenticated;
grant insert (id, hogar_id, nombre, tipo, factor_racion, activa, creado_en) on public.persona to authenticated;
grant update (nombre, tipo, factor_racion, activa) on public.persona to authenticated;

-- 2. Quien cumple no toca el vínculo de su cumpleaños.
create function privado.proteger_cumple_propio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.persona_id is distinct from old.persona_id and privado.es_quien_cumple(old.id) then
      raise exception 'No puedes cambiar a quién corresponde tu propio cumpleaños' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Borrado directo (no en cascada desde el hogar): tampoco.
  if pg_trigger_depth() = 1 and privado.es_quien_cumple(old.id) then
    raise exception 'No puedes borrar tu propio cumpleaños' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function privado.proteger_cumple_propio() from public;

create trigger cumple_proteger_propio_upd
  before update of persona_id on public.cumple
  for each row execute function privado.proteger_cumple_propio();
create trigger cumple_proteger_propio_del
  before delete on public.cumple
  for each row execute function privado.proteger_cumple_propio();

-- 3. Nadie borra la persona vinculada a su propia cuenta: al borrarla, el vínculo de su cumpleaños
--    se soltaría en cascada y ya no se sabría que era quien cumple.
create function privado.proteger_persona_propia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 and old.user_id is not null and old.user_id = (select auth.uid()) then
    raise exception 'No puedes borrar tu propia persona' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke all on function privado.proteger_persona_propia() from public;

create trigger persona_proteger_propia
  before delete on public.persona
  for each row execute function privado.proteger_persona_propia();
