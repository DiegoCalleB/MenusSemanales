# Producto: de una familia a todo el cole

## Los dos problemas que resuelve

1. **Falta de tiempo**, tanto para cocinar como para planificar. Todo el diseño parte de ahí.
2. **La carga mental recae casi siempre en una sola persona** (con frecuencia, la madre). La app existe para que **repartir sea fácil y visible**, no para que una persona más gestione la lista de otra.

Estos dos problemas mandan sobre cualquier otra decisión de producto. Si una función no ahorra tiempo o no ayuda a repartir, no entra.

## Visión

Una app que le quita a una familia la carga mental de la semana: **qué cenamos, qué hay que comprar, qué toca hacer en casa y qué pasa en el cole**. Empieza en una casa y está pensada para que la use cada familia de la clase.

## La idea que hace que funcione: el cole es compartido

El menú del comedor es **el mismo para todas las familias del colegio**. Si cada familia lo teclea, la app es un trabajo; si lo carga una sola vez y lo ven todas, es una ventaja.

> Una familia sube el menú del mes → las otras 30 abren la app y **ya tienen la semana adaptada** a lo que comen sus hijos en el cole.

Es el efecto red del producto, y el motivo de que cada familia nueva lo haga mejor, no más pesado. Lo mismo sirve para el calendario escolar (festivos, excursiones, material que traer).

### Experiencia de alta (objetivo: menos de 2 minutos)

1. Una familia recibe un enlace o código en el grupo de WhatsApp de la clase.
2. Crea su hogar y añade a las personas (con alias).
3. Elige su cole con el código: **el menú del mes ya está cargado**.
4. Pulsa "generar semana" y ve opciones de cena que complementan lo que comen en el cole.

## Modelo de datos: qué es de cada hogar y qué se comparte

| Dato                                                         | Ámbito                   | Quién escribe                    | Quién lee                    |
| ------------------------------------------------------------ | ------------------------ | -------------------------------- | ---------------------------- |
| Personas, asistencia, despensa, compra, tareas, valoraciones | **Hogar** (privado)      | Miembros del hogar               | Miembros del hogar           |
| Catálogo de platos del hogar                                 | Hogar                    | Miembros                         | Miembros                     |
| Biblioteca de platos candidatos                              | **Global**, solo lectura | Curación del proyecto            | Todos los hogares            |
| Menú del comedor, calendario escolar                         | **Centro** (compartido)  | Hogares vinculados, con revisión | Hogares vinculados al centro |

Esto es una **excepción deliberada** al aislamiento por hogar. Se controla así:

- El vínculo hogar ↔ centro se hace **a nivel de hogar, nunca de niño**. No se comparte quién es cada niño ni a qué clase va.
- **Versionado y autoría:** cada cambio al menú queda registrado (quién, cuándo, valor anterior) y se puede revertir.
- **Rol de curador** por centro (las primeras familias) para validar cambios; el resto propone.
- **Aviso de error** de un toque ("esto no es lo que sirvió el cole").
- Los tests de RLS demuestran que un hogar vinculado al centro **sigue sin ver nada privado de otro hogar**.

## El tiempo como restricción de primer orden

| Principio                                      | Cómo se traduce                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planificar la semana en **menos de 2 minutos** | "Generar semana" propone 3 opciones por comida; la familia solo elige. Es una métrica de éxito                                                                                        |
| Cocinar poco entre semana                      | Cada plato tiene `tiempo_activo_min` (manos en la cocina) y `tiempo_total_min`. Por defecto, entre semana se proponen platos de **≤ 30 min activos**; los fines de semana, sin límite |
| El tiempo de cada día es distinto              | "Hoy llego tarde" en un toque: ese día solo se proponen platos de ≤ 15 min                                                                                                            |
| Los días de apuro                              | Botón **"cena de emergencia"**: qué se puede hacer en ≤ 15 min con lo que hay en la despensa                                                                                          |
| Cocinar una vez, comer dos                     | Sobras planificadas y tuppers (D-013)                                                                                                                                                 |
| Comprar sin pensar                             | La lista se genera sola, ordenada por sección del súper, y se marca en un toque                                                                                                       |

## Repartir la carga mental

La carga mental no es solo **hacer** (cocinar, comprar), sino **acordarse y organizar** (qué toca, qué falta, quién lo hace). Es la parte invisible, y por eso la app la hace visible. Inspirado en el método _Fair Play_ (Eve Rodsky): quien se encarga de algo lo **concibe, planifica y ejecuta**, de principio a fin.

| Función                   | Descripción                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Responsable por carga** | Cada cena, la compra semanal, cada tarea de casa y cada gestión del cole tiene una persona responsable |
| **Avisos al responsable** | Los recordatorios llegan a quien se encarga, no a la persona que "siempre lo recuerda"                 |
| **Reparto inicial**       | Al empezar, la pareja decide junta quién se encarga de qué, con una pantalla clara                     |
| **Rotación equitativa**   | La app propone turnos y tiene en cuenta cuánto esfuerzo supone cada carga                              |
| **Panel de reparto**      | Muestra el reparto de la semana **incluyendo planificar y comprar**, no solo cocinar                   |
| **Neutral**               | No asume quién es quién ni la composición del hogar: personas adultas, sin suposiciones de género      |

Cuidado con el tono: el panel es **informativo y compartido**, nunca una puntuación ni un reproche, y se activa por acuerdo. Su objetivo es abrir la conversación, no ganarla.

## Catálogo compartido de platos

Una biblioteca común de platos a la que **cada familia aporta sus recetas y de la que todas se benefician**. Prioridad: **rápidos y sencillos**, aunque cabe de todo.

| Aspecto      | Decisión                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Etiquetas    | `rápido` (≤ 20 min) y `sencillo` (pocos ingredientes y pasos). El generador las prioriza                                                |
| Aportar      | Una familia publica un plato desde su catálogo; entra como **borrador** y se revisa antes de ser visible para todos                     |
| Usar         | "Adoptar" copia el plato al catálogo del hogar: se puede adaptar sin afectar a los demás                                                |
| Calidad      | Valoración agregada y anónima (solo visible con un mínimo de valoraciones); botón de reportar                                           |
| Autoría      | Con alias opcional. Nunca se expone el hogar                                                                                            |
| Derechos     | Solo recetas escritas por la propia familia, sin copiar de webs ni fotos; la familia concede a la plataforma licencia para compartirlas |
| Ingredientes | Catálogo común de ingredientes normalizados para poder **sumar la compra** de platos de familias distintas                              |
| Alérgenos    | Se declaran en cada plato; filtros duros por hogar y persona (D-016)                                                                    |

Se construye tras el centro compartido; ver D-031.

## "Organizar la vida": módulos y prioridad

Cada módulo sigue el mismo patrón (datos por hogar, más una parte compartida por centro cuando tiene sentido), así que añadirlos es barato una vez resuelta la base.

| #   | Módulo                                                        | Valor    | Esfuerzo | Fase                  |
| --- | ------------------------------------------------------------- | -------- | -------- | --------------------- |
| 1   | Menú semanal con opciones, adaptado al cole                   | Muy alto | Alto     | **MVP**               |
| 2   | Lista de la compra automática + manual (sustituye a Keep)     | Muy alto | Medio    | **MVP**               |
| 3   | Despensa y nevera, con mínimos                                | Alto     | Medio    | **MVP**               |
| 4   | Menú del cole compartido por centro                           | Muy alto | Bajo     | **MVP** (diferencial) |
| 5   | Tareas del hogar recurrentes (sábanas, filtros…)              | Alto     | Bajo     | 2                     |
| 6   | Calendario escolar compartido y material a traer              | Alto     | Medio    | 2                     |
| 7   | Recordatorios push                                            | Alto     | Medio    | 2                     |
| 8   | Leer el menú del cole desde una foto o PDF (IA, con revisión) | Alto     | Medio    | 3                     |
| 9   | Cumpleaños, regalos, tupper y merienda                        | Medio    | Bajo     | 3                     |

Regla: **no se añade un módulo hasta que el anterior se usa de verdad** en casa.

## Calidad que se exige (porque lo usarán otros)

- **Accesibilidad** WCAG 2.2 AA: contraste, tamaños táctiles, navegación por teclado, lectores de pantalla.
- **Rendimiento:** carga rápida en móvil con datos limitados; presupuesto de tamaño de JavaScript.
- **Sin conexión** para la lista de la compra (en el súper no siempre hay cobertura).
- **Español** en toda la interfaz y mensajes de error comprensibles.
- **Observabilidad:** errores en producción con Sentry, sin datos personales en los registros.
- **Soporte:** una página de ayuda, un canal de contacto y copias de seguridad probadas.

## Privacidad y responsabilidad (decisión importante)

En cuanto otras familias usan la app, **quien la publica es responsable del tratamiento** de sus datos según el RGPD, y se trata de datos de menores. Esto no es un detalle técnico:

| Obligación                 | Cómo se cubre                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Minimización               | De los niños, solo alias, tipo y factor de ración. Sin apellidos, fotos, fecha de nacimiento ni clase |
| Información                | Política de privacidad y condiciones de uso claras, en español                                        |
| Base legal                 | Ejecución del servicio que el usuario adulto solicita; consentimiento donde corresponda               |
| Derechos                   | Exportar y borrar todos los datos del hogar desde la app                                              |
| Encargados del tratamiento | Supabase y Railway, con sus acuerdos de tratamiento de datos (DPA)                                    |
| Brechas                    | Procedimiento y plazo de 72 h de aviso a la AEPD                                                      |
| Datos en la UE             | Supabase eu-west-1 y Railway EU West                                                                  |

**Esto no sustituye al asesoramiento legal.** Antes de abrir la app a todo el colegio recomiendo una consulta breve (por ejemplo, con el AMPA) y avisar al centro: el menú del comedor suele ser información pública, pero conviene su visto bueno.

## Hoja de ruta de lanzamiento

1. **Tu familia** (ahora): producto mínimo funcionando y desplegado.
2. **Piloto de 3-5 familias** de la clase, con consentimiento y feedback semanal.
3. **Apertura al curso o al colegio** por código de centro, tras la revisión legal y con soporte básico.
4. **Más centros**, si el modelo funciona.

## Qué cuenta como éxito

- Una familia nueva llega a su **primera semana planificada en menos de 5 minutos**.
- **Al menos el 70 % de las familias del piloto** siguen usándola a las 4 semanas.
- Cero incidentes de acceso entre hogares (verificado por los tests de RLS y revisiones).
