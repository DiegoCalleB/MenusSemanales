-- Denegación explícita: nadie accede a la lista de administradores por la API. Solo las funciones
-- internas (SECURITY DEFINER) la consultan. Hace visible la intención y silencia el aviso del linter.
create policy administrador_plataforma_ninguno on public.administrador_plataforma
  for all to authenticated using (false) with check (false);
