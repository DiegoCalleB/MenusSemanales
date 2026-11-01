-- Índices que cubren las claves foráneas señaladas por el advisor de rendimiento.
create index hogar_creado_por_idx on public.hogar (creado_por);
create index patron_asistencia_persona_hogar_idx on public.patron_asistencia (persona_id, hogar_id);
create index excepcion_asistencia_persona_hogar_idx on public.excepcion_asistencia (persona_id, hogar_id);
