\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Conchi, más completa (D-216).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@ejemplo.test');
create temp table _s (clave text primary key, v text);
grant all on _s to anon, authenticated;

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _s values ('hogar', public.crear_hogar('Hogar A')::text);
insert into _s values ('token', public.enlace_calendario((select v from _s where clave = 'hogar')::uuid, false));
select public.guardar_estado_hogar((select v from _s where clave = 'hogar')::uuid, 0, $j${
  "manuales": [
    {"id": "m1", "nombre": "Leche", "comprado": false},
    {"id": "m2", "nombre": "Pan", "comprado": true},
    {"id": "m3", "nombre": "Huevos", "comprado": false}
  ]
}$j$::jsonb);
select pg_temp.fin();

select pg_temp.como(null);
-- Leer la compra: lo apuntado a mano y sin comprar.
select pg_temp.igual('La compra: solo lo que falta por comprar',
  (public.alexa_compra((select v from _s where clave = 'token')) = '["Leche","Huevos"]'::jsonb)::int, 1);
select pg_temp.igual('La compra con token falso, nada',
  (public.alexa_compra(repeat('0', 64)) is null)::int, 1);

-- Quitar de la compra: entra en la cola con su tipo.
select pg_temp.igual('Quitar de la compra se guarda',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'quitar_compra', 'leche') = 'ok')::int, 1);
select pg_temp.igual('Quitar una cita necesita su día',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'quitar_cita', 'dentista') = 'no-valido')::int, 1);

-- Deshacer lo último: quita lo último apuntado y no se puede deshacer dos veces lo mismo.
select pg_temp.igual('Apuntar algo para deshacerlo',
  (public.alexa_anadir((select v from _s where clave = 'token'), 'pendiente', 'llamar al fontanero') = 'ok')::int, 1);
select pg_temp.igual('Deshacer devuelve lo quitado',
  (public.alexa_deshacer((select v from _s where clave = 'token')) = '{"tipo":"pendiente","texto":"llamar al fontanero"}'::jsonb)::int, 1);
select pg_temp.igual('Deshacer otra vez no vuelve a quitar lo mismo (no queda nada que deshacer)',
  (public.alexa_deshacer((select v from _s where clave = 'token')) is null)::int, 1);
select pg_temp.igual('Deshacer con token falso, nada',
  (public.alexa_deshacer(repeat('0', 64)) is null)::int, 1);
select pg_temp.fin();

select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
select pg_temp.igual('Se recoge todo, también lo de quitar',
  ((select count(*) from jsonb_array_elements(public.recoger_entradas_alexa((select v from _s where clave = 'hogar')::uuid)) x
    where x->>'tipo' in ('quitar_compra', 'quitar_pendiente', 'pendiente')) = 3)::int, 1);
select pg_temp.fin();

-- Avisar: con token falso o texto vacío, nada.
select pg_temp.como(null);
select pg_temp.igual('Avisar con token falso, no',
  (public.alexa_avisar(repeat('0', 64), 'leche') = false)::int, 1);
select pg_temp.igual('Avisar sin texto, no',
  (public.alexa_avisar((select v from _s where clave = 'token'), '  ') = false)::int, 1);

-- Quién habla.
select pg_temp.igual('Vincular una voz',
  (public.alexa_vincular_voz((select v from _s where clave = 'token'), 'amzn1.ask.person.AAAAAAAAAA', 'diego') = 'ok')::int, 1);
select pg_temp.igual('La voz vinculada da su persona',
  (public.alexa_voz_persona((select v from _s where clave = 'token'), 'amzn1.ask.person.AAAAAAAAAA') = 'diego')::int, 1);
select pg_temp.igual('Otra voz, nadie',
  (public.alexa_voz_persona((select v from _s where clave = 'token'), 'amzn1.ask.person.BBBBBBBBBB') is null)::int, 1);
select pg_temp.igual('Vincular de nuevo se guarda',
  (public.alexa_vincular_voz((select v from _s where clave = 'token'), 'amzn1.ask.person.AAAAAAAAAA', 'ana') = 'ok')::int, 1);
select pg_temp.igual('Y cambia la persona',
  (public.alexa_voz_persona((select v from _s where clave = 'token'), 'amzn1.ask.person.AAAAAAAAAA') = 'ana')::int, 1);
select pg_temp.igual('Una persona mal escrita no vale',
  (public.alexa_vincular_voz((select v from _s where clave = 'token'), 'amzn1.ask.person.CCCCCCCCCC', 'Diego!') = 'no-valido')::int, 1);
select pg_temp.igual('Con token falso, nada',
  (public.alexa_vincular_voz(repeat('0', 64), 'amzn1.ask.person.AAAAAAAAAA', 'diego') is null)::int, 1);
select pg_temp.fin();

select pg_temp.igual('Las tablas nuevas no se tocan directamente',
  (has_table_privilege('anon', 'public.alexa_voz', 'SELECT') or has_table_privilege('authenticated', 'public.alexa_voz', 'SELECT')
   or has_table_privilege('anon', 'public.alexa_aviso', 'SELECT') or has_table_privilege('authenticated', 'public.alexa_aviso', 'SELECT'))::int, 0);

rollback;
