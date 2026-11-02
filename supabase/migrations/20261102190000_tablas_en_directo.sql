-- =============================================================================
-- Tablas del hogar en directo (D-095)
--
-- Para que un cambio hecho en un móvil llegue enseguida a los demás, las tablas que ya sustituyen
-- al documento entran en la publicación de Realtime. `replica identity full` hace que también
-- lleguen los BORRADOS filtrados por hogar (sin ella, el filtro `hogar_id=…` no los reconoce).
-- La RLS sigue decidiendo quién recibe qué: el secreto del regalo se mantiene.
-- =============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'persona', 'hogar_ajuste', 'dia_hogar', 'cumple', 'cumple_regalo', 'cumple_idea',
    'apunte', 'fecha_senalada', 'tarea_casa', 'tarea_persona', 'tarea_persona_hecha'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
