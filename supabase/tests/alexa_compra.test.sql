\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Alexa → lista de la compra (D-214).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s values ('token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid, false));
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('Con un token que no existe, nada',
  (public.alexa_anadir_compra(repeat('0', 64), 'leche') is null)::int, 1);
select pg_temp.igual('Con un token mal escrito, nada',
  (public.alexa_anadir_compra('x', 'leche') is null)::int, 1);
select pg_temp.igual('Vacío no vale',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), '   ') = 'no-valido')::int, 1);
select pg_temp.igual('Demasiado largo no vale',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), repeat('a', 81)) = 'no-valido')::int, 1);
select pg_temp.igual('Con el token del hogar se guarda',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), '  pan   de  molde ') = 'ok')::int, 1);
select pg_temp.igual('Y otro',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), 'leche') = 'ok')::int, 1);
select pg_temp.falla('Sin sesión no se recoge nada',
  $q$select public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('bbbbbbbb-0000-0000-0000-00000000000b');
select pg_temp.falla('Otro hogar no recoge lo ajeno',
  $q$select public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid)$q$, '42501');
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('El miembro recoge lo pendiente, limpio y en orden',
  (public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid) = '["pan de molde","leche"]'::jsonb)::int, 1);
select pg_temp.igual('Una segunda vez ya no hay nada (cada producto se recibe una sola vez)',
  (public.recoger_compra_alexa((select v from _s where clave = 'hogar')::uuid) = '[]'::jsonb)::int, 1);
select pg_temp.fin();

-- Conchi (D-215): pendientes, citas y tareas hechas, y el tope de la IA.
select pg_temp.como(null);
select pg_temp.igual('Un pendiente se guarda',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'pendiente', 'llamar al dentista') = 'ok')::int, 1);
select pg_temp.igual('Una cita lleva su día y su hora',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'cita', 'psicotécnico', '2026-12-03', '18:00') = 'ok')::int, 1);
select pg_temp.igual('Una cita sin día no vale',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'cita', 'psicotécnico') = 'no-valido')::int, 1);
select pg_temp.igual('Un pendiente con día no vale',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'pendiente', 'x', '2026-12-03') = 'no-valido')::int, 1);
select pg_temp.igual('Una hora mal escrita no vale',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'cita', 'x', '2026-12-03', '25:99') = 'no-valido')::int, 1);
select pg_temp.igual('Un tipo raro no vale',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'borrar', 'x') = 'no-valido')::int, 1);
select pg_temp.igual('Una tarea hecha se guarda',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'hecha', 'Sábanas') = 'ok')::int, 1);
select pg_temp.igual('Con token falso, nada',
  (public.alexa_anadir(repeat('0', 64), 'pendiente', 'x') is null)::int, 1);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Se recoge todo con su tipo, día y hora',
  (public.recoger_entradas_alexa((select v from _s where clave = 'hogar')::uuid) =
   '[{"tipo":"pendiente","texto":"llamar al dentista","fecha":null,"hora":null},
     {"tipo":"cita","texto":"psicotécnico","fecha":"2026-12-03","hora":"18:00"},
     {"tipo":"hecha","texto":"Sábanas","fecha":null,"hora":null}]'::jsonb)::int, 1);
select pg_temp.igual('Y la segunda vez, nada',
  (public.recoger_entradas_alexa((select v from _s where clave = 'hogar')::uuid) = '[]'::jsonb)::int, 1);
select pg_temp.fin();

select pg_temp.como(null);
select pg_temp.igual('La IA de Conchi: con token, ok',
  (public.alexa_usar_ia((select v from _s where clave = 'token')) = 'ok')::int, 1);
select pg_temp.igual('La IA de Conchi: token falso, nada',
  (public.alexa_usar_ia(repeat('0', 64)) is null)::int, 1);
do $$ begin
  for i in 1..45 loop
    perform public.alexa_usar_ia((select v from _s where clave = 'token'));
  end loop;
end $$;
select pg_temp.igual('La IA de Conchi: al llegar al tope (40 al día), tope',
  (public.alexa_usar_ia((select v from _s where clave = 'token')) = 'tope')::int, 1);
select pg_temp.fin();

select pg_temp.como(null);
do $$ begin
  for i in 1..60 loop
    perform public.alexa_anadir_compra((select v from _s where clave = 'token'), 'cosa ' || i);
  end loop;
end $$;
select pg_temp.igual('Al día hay tope (60 entradas)',
  (public.alexa_anadir_compra((select v from _s where clave = 'token'), 'otra') = 'demasiadas')::int, 1);
select pg_temp.fin();


select pg_temp.igual('La tabla no se toca directamente',
  (has_table_privilege('anon', 'public.alexa_entrada', 'SELECT')
   or has_table_privilege('authenticated', 'public.alexa_entrada', 'SELECT'))::int, 0);

rollback;
