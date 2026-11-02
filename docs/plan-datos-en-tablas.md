# Plan: todo el dato principal en tablas, sin datos «a mano» en el código

**Estado:** propuesta para revisar (2026-11-02). No se ha tocado código. Es el cambio de arquitectura más grande de la app: afecta a todo lo que se ve. Las decisiones que faltan están en la sección 9.

## 1. Lo que se pide

1. **Todo el dato principal vive en tablas de Supabase** (personas, platos, compra, despensa, menú, tareas, fechas…), no en un documento ni en el navegador.
2. **No hay datos «hardcodeados»:** todo dato visible en la app viene de la base de datos o de una **sugerencia de la IA** (que la persona acepta).

## 2. Dónde está cada dato hoy

| Qué                                                                          | Dónde vive hoy                                                              | Observación                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Todo el estado del hogar (24 campos)                                         | **Un documento JSON** en `hogar_estado` (si hay cuenta) o en `localStorage` | Es lo único que la app lee y escribe                                                  |
| Personas, cumples, apuntes, tareas, casa, comidas, compra, despensa, cargas… | Dentro de ese documento                                                     | Las tablas `persona`, `plato`, `despensa_item`… **existen pero no se usan** (0 filas) |
| Catálogo de **51 ingredientes** y **54 platos**                              | Código (`src/aplicacion/datos-diego.ts`, `datos-demo.ts`)                   | Datos «de fábrica» en el repositorio                                                  |
| Menú del cole de noviembre 2026                                              | Código (`menu-cole-ejemplo`)                                                | Dato real de la familia en el repositorio                                             |
| Personas (Diego, Ana, Alba, Emma), cumpleaños, 22 tareas, 6 cargas           | Código (`datos-diego.ts`)                                                   | **Datos personales de la familia en el repositorio**                                  |
| Plantillas de la casa y de los gatos, frecuencias                            | Código (`dominio/casa.ts`)                                                  | Datos de referencia                                                                   |
| Ideas de regalo por edad y gustos                                            | Código (`dominio/ideas-regalo.ts`)                                          | Reglas fijas, no IA                                                                   |
| Clasificación de artículos por sección del súper, alias, emojis              | Código (`dominio/habituales.ts`, `texto.ts`)                                | Datos de referencia                                                                   |
| Datos de ejemplo del «modo prueba»                                           | Código (`datos-demo.ts`)                                                    | Datos inventados                                                                      |

## 3. Qué es «dato» y qué no

Para no discutirlo cada vez, propongo esta frontera (a confirmar en la sección 9):

- **Dato → tabla:** todo lo que una persona **ve y puede cambiar** (personas, platos, ingredientes, recetas, despensa, compra, menús, tareas, fechas, cumples, ideas, plantillas, categorías del súper).
- **Código, no dato:** las **reglas** (cómo se equilibra una semana, cómo se calcula la compra, cuándo toca una tarea), el **diseño** y los **textos de la interfaz** (botones, avisos, ayudas). Son comportamiento, no contenido.
- **Dato de fábrica (catálogos):** ingredientes, platos base, plantillas de casa y de gatos, categorías. Viven en **tablas globales** (no personales), sembradas por una migración revisable. Cada hogar los **copia y los edita**; el original no cambia.
- **Datos personales de la familia** (nombres, cumpleaños, el menú del cole de sus hijas): **fuera del repositorio**. Entran por la app o por una importación de una sola vez.

## 4. El modelo de datos de destino

Ya existen (migraciones aplicadas, sin uso): `hogar`, `miembro`, `invitacion`, `persona`, `ingrediente`, `plato`, `plato_ingrediente`, `plato_compartido*`, `despensa_item`, `despensa_operacion`, `despensa_movimiento`, `lista_compra_articulo`, `comida_planificada` (con `momento`), `carga`, `carga_turno`, `dia_hogar`, `patron_asistencia`, `excepcion_asistencia`, `valoracion_plato`, `centro`, `menu_cole_dia`, `hogar_calendario`.

| Campo del estado actual                      | Tabla de destino                                                     | ¿Existe?                           |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| `personas`                                   | `persona`                                                            | Sí                                 |
| `ingredientes`, `platos`                     | `ingrediente` (global), `plato` + `plato_ingrediente` (por hogar)    | Sí                                 |
| `despensa`, `operaciones`                    | `despensa_item`, `despensa_operacion`, `despensa_movimiento`         | Sí                                 |
| `manuales`, `compras` (lista)                | `lista_compra_articulo`                                              | Sí (revisar `compras` realizadas)  |
| `comidas` (cenas) y `almuerzos`              | `comida_planificada` (`momento`), más texto libre para «Por decidir» | **Parcial** (falta el texto libre) |
| `cargas`, `turnos`, `ocurrencias` (reparto)  | `carga`, `carga_turno`                                               | Sí                                 |
| `llegoTarde`, `saltados`                     | `dia_hogar`                                                          | Sí (falta «saltado»)               |
| `valoraciones`                               | `valoracion_plato`                                                   | Sí                                 |
| `colegio`                                    | `menu_cole_dia` (por centro)                                         | Sí                                 |
| `cumples` + ideas + estado del regalo        | `cumple`, `cumple_idea`                                              | **Falta**                          |
| `agenda` (apuntes)                           | `apunte`                                                             | **Falta**                          |
| `eventos` (fechas señaladas)                 | `fecha_senalada`                                                     | **Falta**                          |
| `casa` (recurrente)                          | `tarea_casa`                                                         | **Falta**                          |
| `tareas` (por persona)                       | `tarea_persona` + `tarea_persona_hecha`                              | **Falta**                          |
| `excluirIngredientes`, `horizonte`           | `hogar_ajuste`                                                       | **Falta**                          |
| Plantillas de casa y gatos                   | `plantilla_casa` (global)                                            | **Falta**                          |
| Ideas de regalo, categorías del súper, alias | `catalogo_*` (global)                                                | **Falta**                          |

Todo con **RLS** por hogar y **privilegios mínimos** (D-064), tests de SQL con mutaciones y los avisos de Supabase revisados tras cada migración.

## 5. La IA: qué sugiere y cómo

«Sugerencias de la IA» pide una decisión de producto (sección 9). Mi propuesta de principio:

- **La IA propone, la persona acepta, y lo aceptado se guarda como dato** (con `origen = 'ia'` para saberlo). Nunca se pinta algo «inventado» sin que esté en una tabla o sin que sea una propuesta visible y descartable.
- **Dónde tiene sentido:** ideas de regalo por persona (hoy reglas fijas), propuestas de platos y de menú, clasificación de artículos de la compra, lectura del menú del cole desde un PDF o foto, borradores de tareas de la casa. **Dónde no:** cálculos (compra, equilibrio, cuándo toca), que siguen siendo código determinista («la IA propone, el motor decide», D-041).
- **Privacidad:** el proveedor de IA recibe lo que se le pregunta. **Los regalos de Ana y de las niñas no se envían nunca** (ni sus ideas ni su estado), ni salen en una respuesta a quien no debe verlas.
- **Servidor:** la clave del proveedor vive solo en Railway, con límite de uso y tope de gasto; solo miembros del hogar con sesión.
- **Sin IA disponible** (sin clave, sin cuota o sin conexión), la app sigue funcionando: solo desaparecen las sugerencias.

## 6. Arquitectura de código

- **El dominio puro no cambia** (menú, compra, equilibrio, cumples, casa…): son funciones que reciben datos y devuelven resultados.
- **Nuevo: repositorios por agregado** (`infraestructura/supabase/repos/*`): leen y escriben las tablas y entregan a la app el mismo modelo que hoy usa. La capa `aplicacion` define el contrato (una interfaz); `infraestructura` lo implementa.
- **Actualizaciones en directo** por tabla (Realtime), sustituyendo a la sincronización del documento.
- **Cambios optimistas** como hoy: el cambio se ve al instante y se confirma en segundo plano; si falla, se deshace y se avisa.
- **Se retira:** el documento `hogar_estado` y su control de versiones (tras migrar), el almacén local como fuente de verdad y los datos de ejemplo del código.

## 7. Decisiones de fondo y lo que implican

1. **Sin «modo prueba».** Si no hay datos en el código, no hay datos de ejemplo: **la app exige cuenta y hogar** para mostrar algo. Un hogar nuevo empieza **vacío** (con un asistente para añadir personas, importar el catálogo base y las plantillas). Los tests E2E dejan de usar datos de ejemplo del código.
2. **Sin conexión.** Con los datos en tablas, la app **necesita conexión** para cargar. Mínimo viable: caché de lectura en el móvil y avisos claros sin conexión. **Escribir sin conexión** (cola local de cambios) es un trabajo grande que propongo dejar para después. En una cocina o un súper sin cobertura, esto se nota.
3. **Datos de Diego y Ana hoy:** viven en el navegador de cada móvil. Antes de nada hay que **salvarlos** (ver fase 0) y luego **importarlos una sola vez** a las tablas desde la propia app (sin pasar por el repositorio).
4. **Tests.** Los tests unitarios y de dominio siguen igual. Los de extremo a extremo necesitan un **entorno con base de datos** (Postgres local con migraciones y un hogar de prueba creado por el propio test), no un estado en memoria cargado de datos de código.

## 8. Fases

| Fase                              | Qué se hace                                                                                                                                                               | Qué se ve                                                    | Riesgo                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| **0. Salvar lo que hay**          | Corregir las variables de Railway, entrar con la cuenta, crear el hogar y dejar que la sincronización actual guarde el documento. Exportar un **respaldo** de cada móvil. | Nada nuevo, pero los datos dejan de depender de un navegador | Bajo                              |
| **1. Esquema**                    | Migraciones para las tablas que faltan (cumples, apuntes, fechas, casa, tareas, ajustes, catálogos) con RLS, tests de SQL y revisión de avisos.                           | Nada                                                         | Medio (seguridad)                 |
| **2. Catálogos de fábrica**       | Sembrar ingredientes, platos base, plantillas y categorías en tablas globales; sacarlos del código.                                                                       | Nada: se cargan de la base de datos                          | Medio                             |
| **3. Personas y hogar**           | Repositorios de `persona`, ajustes y asistente de hogar nuevo. La app deja de arrancar con datos del código.                                                              | Pantalla de bienvenida y personas desde la base de datos     | Alto (cambia el arranque)         |
| **4. Un agregado a la vez**       | Fechas (cumples, apuntes, fechas), Casa y tareas, Compra y despensa, Menú y comidas, Reparto, Cole. Cada uno con su repositorio, Realtime y tests.                        | Igual que hoy, con datos de tablas                           | Alto (el grueso del trabajo)      |
| **5. Importar lo de los móviles** | Función en la app: «subir lo guardado en este móvil» a las tablas, con vista previa.                                                                                      | Los datos de Diego y Ana en Supabase                         | Alto (se puede perder o duplicar) |
| **6. IA**                         | Sugerencias aceptables (regalos, platos, clasificación, menú del cole) con las salvaguardas de la sección 5.                                                              | Botones «Sugerir»                                            | Medio                             |
| **7. Retirada**                   | Quitar `hogar_estado`, el almacén local como fuente, los datos de ejemplo y el código muerto; reescribir el calendario suscrito para leer las tablas.                     | Nada                                                         | Medio                             |

**Estimación honesta:** son **varias sesiones de trabajo**, no una. Cada fase se entrega con todos los tests en verde y se puede parar después de cualquiera. El orden permite que la app **siga funcionando entera** durante la migración (se migra un agregado y los demás siguen igual hasta su turno).

## 9. Decisiones que necesito de Diego (y de Ana)

1. **Modo sin conexión:** ¿aceptas que la app **necesite conexión** y que escribir sin conexión quede para después?
2. **Sin «modo prueba»:** ¿aceptas que sin cuenta y hogar **no haya nada que ver** (ni datos de ejemplo)?
3. **Qué entra como «dato de fábrica»:** ¿los 54 platos y los 51 ingredientes actuales pasan a **tablas globales** sembradas por migración (revisables), o prefieres que **los genere la IA** al crear el hogar?
4. **Datos personales:** ¿nombres, cumpleaños y menú del cole **salen del repositorio** y se importan una sola vez desde los móviles?
5. **IA:** ¿qué proveedor y con qué tope de gasto? ¿Qué es imprescindible que sugiera primero? ¿Confirmas que **los regalos nunca se envían** a la IA?
6. **Cuándo:** mi recomendación es **no empezar antes del cumple de Ana** (sábado 7 de noviembre) salvo la **fase 0**, que es lo único que le protege los datos a la familia ahora mismo. ¿Te parece bien?
7. **Orden de los agregados** en la fase 4 (propongo: fechas y casa primero, porque son lo más nuevo y lo que más usa Ana).

## 10. Lo que no se hace (a propósito)

- No se cambian las **reglas** del dominio (equilibrio, compra, cuándo toca).
- No se añaden funciones nuevas durante la migración (el chatbot espera a la fase 6).
- No se mezclan datos entre hogares: cada tabla se aísla con RLS y se prueba.
- No se suben al repositorio datos personales de la familia.

## 11. Criterios para dar por buena cada fase

- Tests unitarios, de SQL (con mutaciones) y E2E en verde; avisos de Supabase revisados.
- Sin pérdida de datos: cada importación se prueba con un **respaldo** y se puede repetir sin duplicar.
- Sin datos de ejemplo ni personales en el repositorio al terminar la fase 7.
- Revisión en el iPhone de Ana (aún no se ha probado nunca en un iPhone real).
- Cada decisión registrada en `docs/decisiones.md`.
