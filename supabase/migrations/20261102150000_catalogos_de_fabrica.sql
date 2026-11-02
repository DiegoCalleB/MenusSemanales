-- =============================================================================
-- Catálogos de fábrica (D-085, fase 2)
--
-- Datos de REFERENCIA que hasta ahora vivían en el código: secciones del súper y sus reglas,
-- plantillas de la casa y de los gatos, ideas de regalo por edad, ingredientes y platos base.
-- No hay datos personales de ninguna familia. Se generó a partir de las constantes del código el
-- 2026-11-02 (sin reescribir a mano). Es idempotente: se puede volver a ejecutar sin duplicar.
--
-- Los platos entran como «publicados» en el catálogo compartido (plato_compartido): cada hogar los
-- adopta (adoptar_plato_compartido) y los edita sin tocar el original. Sus ingredientes, cantidades
-- y tiempos son ESTIMADOS: llevan la etiqueta «por-revisar».
-- =============================================================================

-- 1. Secciones del súper
insert into public.catalogo_categoria_super (id, nombre, emoji, orden) values
  ('fruta_verdura', 'Fruta y verdura', '🥦', 1),
  ('panaderia', 'Panadería', '🍞', 2),
  ('carne', 'Carne y charcutería', '🥩', 3),
  ('pescado', 'Pescado', '🐟', 4),
  ('lacteos', 'Lácteos', '🥛', 5),
  ('huevos', 'Huevos', '🥚', 6),
  ('conservas', 'Conservas', '🥫', 7),
  ('despensa', 'Despensa', '🍝', 8),
  ('congelados', 'Congelados', '🧊', 9),
  ('bebidas', 'Bebidas', '🥤', 10),
  ('limpieza', 'Limpieza y hogar', '🧴', 11),
  ('higiene', 'Higiene y bebé', '🧼', 12),
  ('mascotas', 'Mascotas', '🐱', 13),
  ('otros', 'Otros', '🛒', 14)
on conflict (id) do nothing;

-- 2. Reglas para clasificar un artículo (gana la primera que coincide; patrón sobre texto en minúsculas y sin tildes)
insert into public.catalogo_regla_categoria (categoria, patron, orden) values
  ('mascotas', '\ygato|\ygatos|pienso|arena (verde|gato)|premios', 1),
  ('higiene', 'panal|toallit|tissue|papel higienico|pasta de dientes|cepillo|champu|acondicionador|mascarilla|gel\y|desodorante|crema (cara|sol|solar|nivea|calm|del cuerpo|para el cuerpo)|jabon|bastoncillos|discos desmaquill|espuma de afeitar|papilla|tiritas|algodon|colonia|spray pelo|arco dental', 2),
  ('limpieza', 'detergente|lavavajillas|friegasuelos|friega suelos|bolsas? (de )?basura|papel (de )?cocina|rollos de papel|estropajo|ambientador|escoba|recogedor|fregona|lejia|suavizante|desinfectante|papel film|film|papel horno|pilas?\y|bombilla|sal (para )?lavavajillas|abrillantador|trapo|guantes|flash|liquido (azul|tejidos)|eliminador olores|cubo limpieza|spray madera|antihumedad', 3),
  ('bebidas', 'cerveza|cocacola|coca-?cola|coca cola|fanta|limonada|tonica|gin\y|tanqueray|tinto de verano|agua\y|refresco|vino|zumo|hielos|infusion|ladron de manzanas|bebida', 4),
  ('congelados', 'congelad|helado|pizza|lasana|palitos de verduras', 5),
  ('huevos', '\yhuevos?\y', 6),
  ('lacteos', 'leche|yogur|kefir|queso|quesito|cubiquesos|cuby|mantequilla|margarina|nata\y|natillas|mozzarella|gelatina|cuajada', 7),
  ('pescado', 'pescado|salmon|lubina|merluza|atun|bocarte|gamba|sepia|calamar|bacalao|pulpo|dorada', 8),
  ('carne', 'pollo|pavo|lomo|ternera|cerdo|carne|salchicha|fuet|chorizo|jamon|bacon|embutido|salchichon|charcuteria|hamburguesa|costilla', 9),
  ('panaderia', '\ypan\y|pan de|panecillo|piadina|tortita|croissant|cruasan|bimbo|regana|picos|bizcocho|tostad|empanada|empanadilla|obleas|fajitas?|tortilla de trigo|tortitas', 10),
  ('conservas', 'conserva|tomate frito|garbanzos|lentejas|maiz|aceitunas|guacamole|hummus|humus|salsa|mermelada|nocilla|crema lotus|crema lotu', 11),
  ('fruta_verdura', 'fruta|platano|manzana|naranja|mandarina|limon|pera\y|peras|uvas|fresas?|arandano|cereza|melocoton|sandia|melon|kiwi|aguacate|tomate|lechuga|cebolla|ajos?\y|zanahoria|berenjena|coliflor|judias verdes|calabac|calabaza|patata|pimiento|espinaca|brocoli|ensalada|jengibre|albahaca|oregano fresco|verdura|champinon', 12),
  ('despensa', 'arroz|pasta|fideos|cuscus|harina|azucar|sal\y|aceite|vinagre|cafe|cacao|cereales|galletas?|chocolate|choco|chispas|pasas|frutos secos|almendras|miel|levadura|copos|curry|comino|canela|curcuma|oregano|picoteo|patatas fritas|nachos|chuches|chicles|bombones|lacasitos|mikado|digestive|obleas|infusion|esencia|sopa|crema de calabaza|cremas? calabaza|gelatina|pepitas|decoraciones|sandy|maiz', 13)
on conflict (orden) do nothing;

-- 3. Plantillas de la casa y de los gatos
insert into public.catalogo_plantilla_casa (conjunto, titulo, emoji, cada_dias, empieza_en, compra, orden) values
  ('casa', 'Cambiar las sábanas de mamá y papá', '🛏️', 14, 0, null, 1),
  ('casa', 'Cambiar las sábanas de las niñas', '🧸', 7, 1, null, 2),
  ('casa', 'Cambiar las toallas del baño', '🛁', 7, 2, null, 3),
  ('casa', 'Cambiar toallas de manos y trapos de cocina', '🧺', 3, 1, null, 4),
  ('casa', 'Limpiar la nevera', '🧊', 30, 6, null, 5),
  ('casa', 'Limpiar los filtros de la campana', '🍳', 90, 12, null, 6),
  ('casa', 'Cambiar el filtro del aspirador', '🧹', 90, 20, null, 7),
  ('casa', 'Cambiar los cepillos de dientes', '🪥', 90, 15, null, 8),
  ('casa', 'Revisar el botiquín y las caducidades', '🩹', 180, 25, null, 9),
  ('casa', 'Revisión de la caldera', '🔥', 365, 40, null, 10),
  ('casa', 'Revisión del coche', '🚗', 365, 45, null, 11),
  ('casa', 'Cita del dentista de la familia', '🦷', 180, 30, null, 12),
  ('gatos', 'Limpiar los areneros', '🐱', 1, 0, null, 1),
  ('gatos', 'Lavar comederos y bebederos de los gatos', '🥣', 3, 1, null, 2),
  ('gatos', 'Cambiar toda la arena de los areneros', '🧼', 14, 3, null, 3),
  ('gatos', 'Cepillar a los gatos', '🪮', 7, 2, null, 4),
  ('gatos', 'Comprar arena para los gatos', '🛒', 30, 7, 'Arena para gatos', 5),
  ('gatos', 'Comprar comida de los gatos', '🥫', 14, 5, 'Comida de los gatos', 6),
  ('gatos', 'Desparasitar a los gatos', '💊', 90, 20, null, 7),
  ('gatos', 'Revisión y vacunas de los gatos (veterinario)', '🩺', 365, 45, null, 8)
on conflict (conjunto, titulo) do nothing;

-- 4. Ideas de regalo (por edad hasta N años; las de amigos del cole, hasta 12)
insert into public.catalogo_idea_regalo (edad_hasta, relacion, texto, orden) values
  (2, null, 'Juguete de apilar o encajar', 1),
  (2, null, 'Libro de cartón con texturas', 2),
  (2, null, 'Instrumento musical sencillo', 3),
  (2, null, 'Ropa cómoda', 4),
  (2, null, 'Juguete para el baño', 5),
  (5, null, 'Disfraz o juego de roles (médico, cocinita…)', 1),
  (5, null, 'Puzle de su personaje favorito', 2),
  (5, null, 'Libro de cuentos ilustrado', 3),
  (5, null, 'Set de manualidades y pegatinas', 4),
  (5, null, 'Juego de mesa cooperativo sencillo', 5),
  (5, null, 'Bici, patinete o juego de exterior', 6),
  (8, null, 'Juego de construcción (piezas encajables)', 1),
  (8, null, 'Libro de aventuras o cómic infantil', 2),
  (8, null, 'Kit de manualidades o de ciencia', 3),
  (8, null, 'Juego de mesa para jugar en familia', 4),
  (8, null, 'Material de dibujo y pintura', 5),
  (8, null, 'Una experiencia: cine, parque de atracciones o taller', 6),
  (12, null, 'Libro de una saga que le guste', 1),
  (12, null, 'Kit de ciencia, robótica o experimentos', 2),
  (12, null, 'Juego de mesa o de cartas', 3),
  (12, null, 'Material creativo (acuarelas, cuadernos, pulseras)', 4),
  (12, null, 'Equipamiento de su deporte o afición', 5),
  (12, null, 'Una experiencia: taller, excursión o espectáculo', 6),
  (17, null, 'Libro o cómic de su género favorito', 1),
  (17, null, 'Auriculares o accesorio tecnológico', 2),
  (17, null, 'Ropa o complementos de su estilo', 3),
  (17, null, 'Entradas a un concierto o evento', 4),
  (17, null, 'Material de su afición', 5),
  (17, null, 'Tarjeta regalo de su tienda favorita', 6),
  (200, null, 'Una experiencia (cena, escapada, taller)', 1),
  (200, null, 'Un libro que encaje con sus gustos', 2),
  (200, null, 'Algo para su afición', 3),
  (200, null, 'Un detalle hecho a mano o personalizado', 4),
  (200, null, 'Productos de cuidado personal o del hogar', 5),
  (200, null, 'Una suscripción o entradas a algo que le guste', 6),
  (12, 'cole', 'Un libro o cuento', 1),
  (12, 'cole', 'Set de pegatinas y manualidades pequeño', 2),
  (12, 'cole', 'Juego de cartas o de mesa pequeño', 3),
  (12, 'cole', 'Material de dibujo', 4),
  (12, 'cole', 'Un detalle de su personaje favorito', 5)
on conflict (edad_hasta, relacion, texto) do nothing;

-- 5. Ingredientes
insert into public.ingrediente (nombre, unidad, seccion, verificado, creado_por) values
  ('Pechuga de pollo', 'g', 'carne', true, null),
  ('Ternera picada', 'g', 'carne', true, null),
  ('Filete de ternera', 'g', 'carne', true, null),
  ('Ternera para guisar', 'g', 'carne', true, null),
  ('Solomillo de cerdo', 'g', 'carne', true, null),
  ('Lomo de cerdo', 'g', 'carne', true, null),
  ('Costillas', 'g', 'carne', true, null),
  ('Bacon', 'g', 'carne', true, null),
  ('Salchichas', 'ud', 'carne', true, null),
  ('Chorizo', 'g', 'carne', true, null),
  ('Jamón', 'g', 'carne', true, null),
  ('Sepia', 'g', 'pescado', true, null),
  ('Gulas', 'g', 'pescado', true, null),
  ('Merluza', 'g', 'pescado', true, null),
  ('Salmón', 'g', 'pescado', true, null),
  ('Lubina', 'g', 'pescado', true, null),
  ('Atún en lata', 'ud', 'conservas', true, null),
  ('Huevos', 'ud', 'huevos', true, null),
  ('Queso', 'g', 'lacteos', true, null),
  ('Mozzarella', 'g', 'lacteos', true, null),
  ('Leche', 'ml', 'lacteos', true, null),
  ('Nata para cocinar', 'ml', 'lacteos', true, null),
  ('Tomate', 'g', 'fruta_verdura', true, null),
  ('Pimiento', 'g', 'fruta_verdura', true, null),
  ('Cebolla', 'g', 'fruta_verdura', true, null),
  ('Patata', 'g', 'fruta_verdura', true, null),
  ('Zanahoria', 'g', 'fruta_verdura', true, null),
  ('Calabacín', 'g', 'fruta_verdura', true, null),
  ('Calabaza', 'g', 'fruta_verdura', true, null),
  ('Berenjena', 'g', 'fruta_verdura', true, null),
  ('Coliflor', 'g', 'fruta_verdura', true, null),
  ('Judías verdes', 'g', 'fruta_verdura', true, null),
  ('Guisantes', 'g', 'congelados', true, null),
  ('Espinacas', 'g', 'fruta_verdura', true, null),
  ('Champiñones', 'g', 'fruta_verdura', true, null),
  ('Lechuga', 'g', 'fruta_verdura', true, null),
  ('Aguacate', 'ud', 'fruta_verdura', true, null),
  ('Pan', 'ud', 'panaderia', true, null),
  ('Pan rallado', 'g', 'despensa', true, null),
  ('Tortillas de trigo', 'ud', 'panaderia', true, null),
  ('Hojaldre', 'ud', 'panaderia', true, null),
  ('Harina', 'g', 'despensa', true, null),
  ('Pasta', 'g', 'despensa', true, null),
  ('Arroz', 'g', 'despensa', true, null),
  ('Cuscús', 'g', 'despensa', true, null),
  ('Lentejas', 'g', 'despensa', true, null),
  ('Garbanzos cocidos', 'g', 'conservas', true, null),
  ('Tomate frito', 'ml', 'conservas', true, null),
  ('Croquetas', 'ud', 'congelados', true, null),
  ('Empanadillas', 'ud', 'congelados', true, null),
  ('Piadinas', 'ud', 'panaderia', true, null)
on conflict (nombre_normalizado) do nothing;

-- 6. Platos base (catálogo compartido, publicados). Cada ingrediente: [nombre sin tildes, cantidad por ración, opcional]
do $semilla$
declare
  p jsonb;
  v_id uuid;
begin
  for p in select * from jsonb_array_elements($json$
[
  {"nombre":"Sepia","rol":"principal","grupo":"pescado","min":15,"etiquetas":["por-revisar"],"ingredientes":[["sepia",150,false]]},
  {"nombre":"Gulas","rol":"guarnicion","grupo":"pescado","min":10,"etiquetas":["por-revisar","ligero"],"ingredientes":[["gulas",80,false],["pan",0.5,false]]},
  {"nombre":"Champiñones","rol":"guarnicion","grupo":"verdura","min":10,"etiquetas":["por-revisar","ligero"],"ingredientes":[["champiñones",200,false]]},
  {"nombre":"Tomates rellenos","rol":"principal","grupo":"verdura","min":25,"etiquetas":["por-revisar"],"ingredientes":[["tomate",250,false],["ternera picada",60,false],["cebolla",30,false]]},
  {"nombre":"Filetes de ternera","rol":"principal","grupo":"carne","min":10,"etiquetas":["por-revisar"],"ingredientes":[["filete de ternera",130,false]]},
  {"nombre":"Solomillitos","rol":"principal","grupo":"carne","min":15,"etiquetas":["por-revisar"],"ingredientes":[["solomillo de cerdo",130,false]]},
  {"nombre":"Solomillo con bacon y queso","rol":"principal","grupo":"carne","min":20,"etiquetas":["por-revisar"],"ingredientes":[["solomillo de cerdo",130,false],["bacon",30,false],["queso",30,false]]},
  {"nombre":"Hamburguesas de ternera","rol":"principal","grupo":"carne","min":15,"etiquetas":["por-revisar"],"ingredientes":[["ternera picada",110,false],["pan",1,false]]},
  {"nombre":"Hamburguesas de pollo","rol":"principal","grupo":"carne","min":15,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",110,false],["pan",1,false]]},
  {"nombre":"Arroz con pollo al curry","rol":"principal","grupo":"arroz","min":25,"etiquetas":["por-revisar"],"ingredientes":[["arroz",70,false],["pechuga de pollo",100,false],["cebolla",30,false],["nata para cocinar",30,false]]},
  {"nombre":"Judías verdes","rol":"guarnicion","grupo":"verdura","min":15,"etiquetas":["por-revisar","ligero"],"ingredientes":[["judias verdes",200,false],["patata",100,false]]},
  {"nombre":"Patatas Ana","rol":"guarnicion","grupo":"otro","min":20,"etiquetas":["por-revisar","ligero"],"ingredientes":[["patata",250,false],["cebolla",40,false]]},
  {"nombre":"Milanesa de pollo","rol":"principal","grupo":"carne","min":20,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",130,false],["huevos",0.5,false],["pan rallado",30,false]]},
  {"nombre":"Garbanzos saltarines","rol":"principal","grupo":"legumbre","min":15,"etiquetas":["por-revisar"],"ingredientes":[["garbanzos cocidos",120,false],["espinacas",60,false]]},
  {"nombre":"Cocido","rol":"principal","grupo":"legumbre","min":30,"etiquetas":["por-revisar"],"ingredientes":[["garbanzos cocidos",100,false],["ternera para guisar",60,false],["patata",100,false],["zanahoria",50,false]]},
  {"nombre":"Costillas barbacoa","rol":"principal","grupo":"carne","min":15,"etiquetas":["por-revisar"],"ingredientes":[["costillas",250,false]]},
  {"nombre":"Carne guisada","rol":"principal","grupo":"carne","min":25,"etiquetas":["por-revisar"],"ingredientes":[["ternera para guisar",130,false],["patata",100,false],["zanahoria",50,false],["cebolla",30,false]]},
  {"nombre":"Hojaldre de pollo barbacoa","rol":"principal","grupo":"carne","min":25,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",100,false],["hojaldre",0.5,false],["queso",20,false]]},
  {"nombre":"Tosta","rol":"guarnicion","grupo":"otro","min":10,"etiquetas":["por-revisar","ligero"],"ingredientes":[["pan",1,false],["tomate",60,false],["jamon",30,false]]},
  {"nombre":"Croquetas","rol":"guarnicion","grupo":"otro","min":20,"etiquetas":["por-revisar","ligero"],"ingredientes":[["croquetas",5,false]]},
  {"nombre":"Crema de calabaza","rol":"principal","grupo":"verdura","min":20,"etiquetas":["por-revisar"],"ingredientes":[["calabaza",250,false],["patata",50,false],["cebolla",30,false]]},
  {"nombre":"Crema de calabacín","rol":"principal","grupo":"verdura","min":20,"etiquetas":["por-revisar"],"ingredientes":[["calabacin",250,false],["patata",50,false],["cebolla",30,false]]},
  {"nombre":"Coliflor con salchichas","rol":"principal","grupo":"verdura","min":20,"etiquetas":["por-revisar"],"ingredientes":[["coliflor",200,false],["salchichas",2,false],["patata",100,false]]},
  {"nombre":"Guisantes con jamón","rol":"guarnicion","grupo":"verdura","min":15,"etiquetas":["por-revisar","ligero"],"ingredientes":[["guisantes",150,false],["jamon",40,false]]},
  {"nombre":"Ensalada de tomate, aguacate y mozzarella","rol":"guarnicion","grupo":"verdura","min":10,"etiquetas":["por-revisar","ligero"],"ingredientes":[["tomate",120,false],["aguacate",0.5,false],["mozzarella",60,false]]},
  {"nombre":"Ensaladilla rusa","rol":"guarnicion","grupo":"otro","min":25,"etiquetas":["por-revisar","ligero"],"ingredientes":[["patata",150,false],["zanahoria",40,false],["atun en lata",0.5,false],["huevos",0.5,false]]},
  {"nombre":"Puré de patata","rol":"guarnicion","grupo":"verdura","min":15,"etiquetas":["por-revisar","ligero"],"ingredientes":[["patata",250,false],["leche",50,false]]},
  {"nombre":"Tortilla francesa","rol":"principal","grupo":"huevo","min":10,"etiquetas":["por-revisar"],"ingredientes":[["huevos",2,false]]},
  {"nombre":"Pasta con chorizo","rol":"principal","grupo":"pasta","min":20,"etiquetas":["por-revisar"],"ingredientes":[["pasta",80,false],["chorizo",40,false],["tomate frito",60,false]]},
  {"nombre":"Berenjena rebozada","rol":"principal","grupo":"verdura","min":25,"etiquetas":["por-revisar"],"ingredientes":[["berenjena",200,false],["huevos",0.5,false],["harina",20,false]]},
  {"nombre":"Lubina","rol":"principal","grupo":"pescado","min":15,"etiquetas":["por-revisar"],"ingredientes":[["lubina",160,false]]},
  {"nombre":"Salmorejo","rol":"guarnicion","grupo":"verdura","min":10,"etiquetas":["por-revisar","ligero"],"ingredientes":[["tomate",300,false],["pan",0.5,false]]},
  {"nombre":"Fajitas","rol":"principal","grupo":"carne","min":25,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",100,false],["pimiento",60,false],["cebolla",40,false],["tortillas de trigo",1.5,false]]},
  {"nombre":"Salmón al horno con patatas","rol":"principal","grupo":"pescado","min":15,"etiquetas":["por-revisar"],"ingredientes":[["salmon",130,false],["patata",150,false]]},
  {"nombre":"Lentejas","rol":"principal","grupo":"legumbre","min":25,"etiquetas":["por-revisar"],"ingredientes":[["lentejas",80,false],["zanahoria",40,false],["cebolla",30,false]]},
  {"nombre":"Huevos Marialuisa","rol":"principal","grupo":"huevo","min":20,"etiquetas":["por-revisar"],"ingredientes":[["huevos",2,false],["patata",100,false]]},
  {"nombre":"Verduras en tempura","rol":"principal","grupo":"verdura","min":25,"etiquetas":["por-revisar"],"ingredientes":[["calabacin",100,false],["zanahoria",50,false],["harina",30,false],["huevos",0.5,false]]},
  {"nombre":"Albóndigas con arroz","rol":"principal","grupo":"carne","min":30,"etiquetas":["por-revisar"],"ingredientes":[["ternera picada",100,false],["arroz",60,false],["tomate frito",60,false],["cebolla",20,false]]},
  {"nombre":"Cuscús","rol":"principal","grupo":"pasta","min":15,"etiquetas":["por-revisar"],"ingredientes":[["cuscus",70,false],["zanahoria",40,false],["calabacin",60,false]]},
  {"nombre":"Pizza casera","rol":"principal","grupo":"otro","min":30,"etiquetas":["por-revisar"],"ingredientes":[["harina",120,false],["tomate frito",60,false],["mozzarella",60,false],["jamon",30,false]]},
  {"nombre":"Sándwich","rol":"principal","grupo":"otro","min":10,"etiquetas":["por-revisar"],"ingredientes":[["pan",2,false],["jamon",40,false],["queso",30,false]]},
  {"nombre":"Pasta fresca","rol":"principal","grupo":"pasta","min":15,"etiquetas":["por-revisar"],"ingredientes":[["pasta",120,false],["tomate frito",60,false],["queso",15,false]]},
  {"nombre":"Pollo frito (freidora de aire)","rol":"principal","grupo":"carne","min":15,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",130,false]]},
  {"nombre":"Sopa","rol":"guarnicion","grupo":"pasta","min":15,"etiquetas":["por-revisar","ligero"],"ingredientes":[["pasta",40,false],["zanahoria",30,false],["pechuga de pollo",30,false]]},
  {"nombre":"Filetes de lomo","rol":"principal","grupo":"carne","min":10,"etiquetas":["por-revisar"],"ingredientes":[["lomo de cerdo",130,false]]},
  {"nombre":"Salmón a la plancha","rol":"principal","grupo":"pescado","min":10,"etiquetas":["por-revisar"],"ingredientes":[["salmon",130,false]]},
  {"nombre":"Huevos fritos con patatas","rol":"principal","grupo":"huevo","min":20,"etiquetas":["por-revisar"],"ingredientes":[["huevos",2,false],["patata",150,false]]},
  {"nombre":"Piadinas","rol":"principal","grupo":"otro","min":15,"etiquetas":["por-revisar"],"ingredientes":[["piadinas",1,false],["jamon",40,false],["queso",30,false]]},
  {"nombre":"Tortilla de patatas","rol":"principal","grupo":"huevo","min":30,"etiquetas":["por-revisar"],"ingredientes":[["huevos",2,false],["patata",150,false],["cebolla",30,false]]},
  {"nombre":"Pollo a la plancha","rol":"principal","grupo":"carne","min":10,"etiquetas":["por-revisar"],"ingredientes":[["pechuga de pollo",130,false]]},
  {"nombre":"Onion bhaji","rol":"guarnicion","grupo":"verdura","min":25,"etiquetas":["por-revisar","ligero"],"ingredientes":[["cebolla",150,false],["harina",30,false]]},
  {"nombre":"Empanadillas","rol":"guarnicion","grupo":"otro","min":15,"etiquetas":["por-revisar","ligero"],"ingredientes":[["empanadillas",3,false]]},
  {"nombre":"Merluza","rol":"principal","grupo":"pescado","min":15,"etiquetas":["por-revisar"],"ingredientes":[["merluza",150,false]]},
  {"nombre":"Ensalada César","rol":"principal","grupo":"verdura","min":15,"etiquetas":["por-revisar"],"ingredientes":[["lechuga",100,false],["pechuga de pollo",80,false],["queso",15,false],["pan",0.5,false]]}
]
$json$::jsonb) loop
    if exists (select 1 from public.plato_compartido where nombre = p->>'nombre') then
      continue;
    end if;
    insert into public.plato_compartido (nombre, rol, grupo, tiempo_activo_min, tiempo_total_min, etiquetas, estado, revisado_en)
    values (p->>'nombre', p->>'rol', p->>'grupo', (p->>'min')::smallint, (p->>'min')::smallint,
            array(select jsonb_array_elements_text(p->'etiquetas')), 'publicado', now())
    returning id into v_id;
    insert into public.plato_compartido_ingrediente (plato_compartido_id, ingrediente_id, cantidad_por_racion, opcional)
    select v_id, i.id, (x->>1)::numeric, (x->>2)::boolean
      from jsonb_array_elements(p->'ingredientes') x
      join public.ingrediente i on i.nombre_normalizado = x->>0;
  end loop;
end
$semilla$;
