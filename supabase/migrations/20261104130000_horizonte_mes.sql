-- Planificar el menú a un mes vista: el horizonte admite también 'mes' (además de semana y quincena).
alter table public.hogar_ajuste drop constraint if exists hogar_ajuste_horizonte_check;
alter table public.hogar_ajuste
  add constraint hogar_ajuste_horizonte_check check (horizonte in ('semana', 'quincena', 'mes'));
