\set ON_ERROR_STOP on
begin;
\i supabase/tests/lib/helpers.sql

-- Catálogos de fábrica (D-085, fase 2): lo que antes estaba en el código ahora está en tablas.
select pg_temp.igual('14 secciones del súper', (select count(*) from public.catalogo_categoria_super), 14);
select pg_temp.igual('Todas las reglas apuntan a una sección y compilan como expresión regular de Postgres',
  (select count(*) from public.catalogo_regla_categoria r where ''::text ~ r.patron is not null), (select count(*) from public.catalogo_regla_categoria));
select pg_temp.igual('Hay reglas (más de 8)', (select (count(*) > 8)::int from public.catalogo_regla_categoria), 1);

-- Las reglas de Postgres clasifican igual que el código (la traducción \b → \y no cambia nada).
create temp table _articulos (texto text, esperado text);
insert into _articulos values
    ('pienso para gatos', 'mascotas'),
    ('arena gato', 'mascotas'),
    ('pañales talla 4', 'higiene'),
    ('papel higienico', 'higiene'),
    ('bolsas de basura', 'limpieza'),
    ('detergente', 'limpieza'),
    ('lavavajillas', 'limpieza'),
    ('leche', 'lacteos'),
    ('yogures', 'lacteos'),
    ('tomates', 'fruta_verdura'),
    ('pan', 'panaderia'),
    ('cerveza', 'bebidas'),
    ('pollo', 'carne'),
    ('salmon', 'pescado'),
    ('huevos', 'huevos'),
    ('arroz', 'despensa'),
    ('atun en lata', 'pescado'),
    ('guisantes congelados', 'congelados'),
    ('agua', 'bebidas'),
    ('pilas', 'limpieza'),
    ('crema solar', 'higiene'),
    ('gel de ducha', 'higiene'),
    ('premios gato', 'mascotas'),
    ('cepillo de dientes', 'higiene'),
    ('queso', 'lacteos'),
    ('manzanas', 'fruta_verdura'),
    ('helado', 'congelados');
select pg_temp.igual('Las reglas de la base de datos coinciden con las del código en todos los ejemplos',
  (select count(*) from _articulos a
    where coalesce((select r.categoria from public.catalogo_regla_categoria r
                     where translate(lower(a.texto), 'áéíóúñ', 'aeioun') ~ r.patron order by r.orden limit 1), 'otros') <> a.esperado), 0);

-- Plantillas.
select pg_temp.igual('12 tareas de casa y 8 de gatos',
  (select count(*) from public.catalogo_plantilla_casa where conjunto = 'casa') * 100
  + (select count(*) from public.catalogo_plantilla_casa where conjunto = 'gatos'), 1208);
select pg_temp.igual('Comprar arena y comida llevan qué comprar',
  (select count(*) from public.catalogo_plantilla_casa where compra in ('Arena para gatos', 'Comida de los gatos')), 2);
select pg_temp.igual('Los areneros se limpian cada día y empiezan hoy',
  (select count(*) from public.catalogo_plantilla_casa where titulo = 'Limpiar los areneros' and cada_dias = 1 and empieza_en = 0), 1);

-- Ideas de regalo.
select pg_temp.igual('Hay ideas para las 6 franjas de edad (hasta 2, 5, 8, 12, 17 y 200 años)',
  (select count(distinct edad_hasta) from public.catalogo_idea_regalo where relacion is null), 6);
select pg_temp.igual('Hay ideas para amigos del cole',
  (select count(*) from public.catalogo_idea_regalo where relacion = 'cole'), 5);

-- Ingredientes y platos.
select pg_temp.igual('51 ingredientes verificados', (select count(*) from public.ingrediente where verificado), 51);
select pg_temp.igual('54 platos publicados, ninguno pendiente',
  (select count(*) from public.plato_compartido where estado = 'publicado') * 100
  + (select count(*) from public.plato_compartido where estado <> 'publicado'), 5400);
select pg_temp.igual('Todos los platos tienen ingredientes',
  (select count(*) from public.plato_compartido p where not exists (select 1 from public.plato_compartido_ingrediente i where i.plato_compartido_id = p.id)), 0);
select pg_temp.igual('Todos van marcados por revisar (las cantidades son estimadas)',
  (select count(*) from public.plato_compartido where not ('por-revisar' = any (etiquetas))), 0);
select pg_temp.igual('Los platos ligeros son guarnición',
  (select count(*) from public.plato_compartido where 'ligero' = any (etiquetas) and rol <> 'guarnicion'), 0);
select pg_temp.igual('Gulas lleva gulas y pan',
  (select count(*) from public.plato_compartido_ingrediente i join public.plato_compartido p on p.id = i.plato_compartido_id
    where p.nombre = 'Gulas'), 2);

-- Volver a ejecutar la semilla no duplica nada.
select count(*) as antes_ing from public.ingrediente \gset
select count(*) as antes_pla from public.plato_compartido \gset
select count(*) as antes_pi from public.plato_compartido_ingrediente \gset
select count(*) as antes_reg from public.catalogo_regla_categoria \gset
\i supabase/migrations/20261102150000_catalogos_de_fabrica.sql
select pg_temp.igual('Repetir la semilla no duplica ingredientes ni platos ni reglas',
  (select count(*) from public.ingrediente) - :antes_ing + (select count(*) from public.plato_compartido) - :antes_pla
  + (select count(*) from public.plato_compartido_ingrediente) - :antes_pi + (select count(*) from public.catalogo_regla_categoria) - :antes_reg, 0);

-- De punta a punta: un hogar nuevo adopta un plato del catálogo y se lo lleva con sus ingredientes.
insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@ejemplo.test');
create temp table _ids (clave text primary key, id uuid);
grant all on _ids to authenticated;
select pg_temp.como('aaaaaaaa-0000-0000-0000-00000000000a');
insert into _ids values ('HA', public.crear_hogar('Hogar A'));
select public.adoptar_plato_compartido((select id from _ids where clave = 'HA'), (select id from public.plato_compartido where nombre = 'Tomates rellenos'));
select pg_temp.igual('El hogar tiene el plato adoptado', (select count(*) from public.plato where nombre = 'Tomates rellenos' and origen = 'compartido'), 1);
select pg_temp.igual('Con sus tres ingredientes',
  (select count(*) from public.plato_ingrediente pi join public.plato p on p.id = pi.plato_id and p.hogar_id = pi.hogar_id where p.nombre = 'Tomates rellenos'), 3);
select pg_temp.falla('Nadie cambia el catálogo desde la app',
  $q$update public.plato_compartido set nombre = 'Hackeado'$q$, '42501');
select pg_temp.fin();

rollback;
\echo 'catalogos_de_fabrica: OK'
