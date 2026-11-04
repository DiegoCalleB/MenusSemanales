# Registro de decisiones técnicas

Formato ligero inspirado en ADR: cada decisión tiene contexto, decisión, alternativas y consecuencias.
Estado: `propuesta` (pendiente de validar), `aceptada` o `sustituida`.

---

## D-001 · Multi-hogar desde el primer día

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la app nace para una familia (2 adultos, 2 niñas), pero el objetivo es poder ofrecerla a cualquier hogar si funciona bien.
- **Decisión:** toda tabla de datos lleva `hogar_id` y se protege con Row Level Security (RLS) por pertenencia al hogar. El aislamiento entre hogares se demuestra con tests automáticos.
- **Alternativas:** app monousuario y migrar después (descartada: migrar seguridad a posteriori es caro y arriesgado).
- **Consecuencias:** algo más de complejidad inicial en esquema y tests; a cambio, abrir la app a otras familias no requiere rediseño.

## D-002 · Personas del hogar ≠ usuarios con cuenta

- **Estado:** aceptada (2026-11-01)
- **Contexto:** las niñas comen y cuentan para raciones y equilibrio nutricional, pero no tienen cuenta.
- **Decisión:** separar `persona` (comensal, con tipo adulto/niño y factor de ración) de `miembro` (usuario autenticado con acceso al hogar).
- **Consecuencias:** la lista de la compra y el generador trabajan con personas; la seguridad trabaja con miembros.

## D-003 · Asistencia: patrón semanal + excepciones

- **Estado:** aceptada (2026-11-01)
- **Contexto:** las niñas comen en el cole de lunes a viernes; Diego come en la oficina martes y miércoles; Ana suele comer fuera de martes a viernes, pero varía. No suelen llevar tupper, aunque podría pasar.
- **Decisión:** cada persona tiene un patrón semanal por comida (comida/cena) y se puede sobrescribir un día concreto con un toque. Campo opcional "para llevar" para tupper, que propone ración extra en la cena anterior.
- **Patrón inicial:** L comida Diego+Ana · M/X comida nadie · J/V comida Diego (Ana a veces) · S/D todos · cenas, siempre los 4.
- **Consecuencias:** cantidades de compra correctas sin pseudo-platos (la app anterior usaba un plato "EN EL TRABAJO PAPA Y MAMÁ").

## D-004 · El generador propone opciones, la familia elige

- **Estado:** aceptada (2026-11-01)
- **Decisión:** por cada comida se proponen 3 opciones ordenadas con su motivo. Estados: `propuesta → elegida → cocinada`. Al elegir una, solo se recalculan las comidas aún no elegidas, manteniendo las restricciones duras (sin repetir plato, sin mismo grupo consecutivo).
- **Consecuencias:** la lista de la compra se calcula solo con comidas elegidas.

## D-005 · Motor determinista + capa de IA que propone (no decide)

- **Estado:** propuesta
- **Decisión:** el núcleo (generador, compra, despensa, tareas) son funciones puras en TypeScript, deterministas y testeadas. La IA (fase 4: leer el menú del cole desde foto/PDF, peticiones en lenguaje natural) produce propuestas que el motor valida y la familia confirma.
- **Motivo:** fiabilidad, coste cero en el uso diario, testabilidad y explicabilidad.

## D-006 · Antigüedad de platos con saturación

- **Estado:** propuesta
- **Contexto:** los datos de la app anterior tienen fechas de hace 600–1150 días.
- **Decisión:** la puntuación por antigüedad satura a ~4 semanas; las fechas importadas se tratan como "hace mucho".

## D-007 · Fritos y procesados con máximo semanal

- **Estado:** propuesta
- **Decisión:** etiquetas `frito` / `procesado` con tope semanal configurable (inicial: 2 cenas), sin eliminar platos del catálogo.

## D-008 · Infraestructura Supabase

- **Estado:** aceptada (2026-11-01) — proyecto creado: ref `inzyvqffesgjhvdrgdgg`
- **Decisión:**
  - Proyecto `menus-semanales` en **eu-west-1 (Irlanda)**: datos en la UE (RGPD), baja latencia desde España. ~~Vercel en región `dub1`~~ → sustituido por Railway EU West (D-024).
  - Entornos: local (CLI/Docker o Postgres efímero en CI) + producción. Branching de Supabase cuando se pase a Pro.
  - El repositorio es la fuente de verdad del esquema (`supabase/migrations`); nunca cambios manuales en el panel.
  - Claves nuevas _publishable/secret_; la secreta solo en servidor, CI y scripts.
  - Advisors de seguridad y rendimiento tras cada migración.
  - SMTP propio (Resend) antes de dar acceso real, porque el SMTP integrado es solo para pruebas.
- **Detalle:** ver [infraestructura.md](infraestructura.md).

## D-009 · Gestor de paquetes y runtime

- **Estado:** propuesta
- **Decisión:** pnpm y Node 22 LTS (disponibles en el entorno de desarrollo y en CI).

## D-010 · Postgres 17 en todos los entornos

- **Estado:** aceptada (2026-11-01)
- **Contexto:** el proyecto de producción usa Postgres 17.
- **Decisión:** `supabase/config.toml` con `major_version = 17` y CI con un contenedor `postgres:17`. Así local, CI y producción ejecutan las migraciones y los tests de RLS sobre la misma versión mayor.

## D-011 · Aviso de advisor aceptado: conexiones de Auth en valor absoluto

- **Estado:** aceptada (2026-11-01)
- **Contexto:** con el proyecto vacío, el advisor de rendimiento da un aviso de nivel INFO (`auth_db_connections_absolute`): Auth usa 10 conexiones fijas en lugar de un porcentaje.
- **Decisión:** no cambiarlo por ahora. Solo importa si se amplía la instancia; se revisará al pasar a Pro o al cambiar de tamaño. El advisor de seguridad sale sin avisos.

## D-012 · Factor de ración por persona

- **Estado:** aceptada (2026-11-01)
- **Contexto:** las niñas comen "como medio adulto, a veces": la cantidad varía.
- **Decisión:** cada persona tiene un `factor_racion` (adulto 1, niñas 0,5 al inicio), editable desde la app. La compra multiplica la cantidad por persona del seed por la suma de factores de los comensales y **redondea hacia arriba a unidades de compra**, para que no falte comida.
- **Futuro:** tras cocinar, una pregunta opcional "¿sobró o faltó?" permitirá sugerir ajustes del factor.

## D-013 · Comidas de adultos entre semana: sobras planificadas y "fondo de nevera"

- **Estado:** aceptada (2026-11-01)
- **Contexto:** los días que Diego come en casa suele comer "rápido y mal de lo que encuentra", porque no suele haber comida preparada.
- **Decisión:**
  1. **Sobras planificadas:** la cena de la víspera se propone con ración extra y la comida queda marcada como "sobras de…". Es una excepción explícita a la regla de no repetir plato.
  2. **Fondo de nevera:** lista de básicos rápidos y sanos con stock mínimo; si bajan del mínimo, entran solos en la lista de la compra.
  3. **Modo rápido:** sin sobras, las opciones de esa comida se limitan a platos de ≤ 15 min hechos con stock disponible.
- **Consecuencias:** los platos necesitan `tiempo_preparacion_min`; el generador distingue comidas "rápidas" de las normales.

## D-014 · Objetivos nutricionales por persona

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la comida del cole solo la comen las niñas; la comida de mediodía de los adultos varía por persona.
- **Decisión:** los objetivos semanales por grupo alimenticio se evalúan **por persona**. Cada comida suma a quienes la comen (cole → niñas; comida de Diego → Diego; cenas compartidas → todos). El generador optimiza la suma ponderada de déficits, y ante empate prioriza a las niñas.
- **Alternativa descartada:** objetivos por familia, porque el pescado del cole "compensaría" que un adulto no lo comiera.

## D-015 · Composición de una comida: principal + guarnición opcional

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la familia cena normalmente un plato, a veces con guarnición. El catálogo actual solo tiene 3 guarniciones (zanahorias, fuet, chorizo), dos de ellas embutido.
- **Decisión:** cada opción es `principal` + `guarnición?`. El generador sugiere guarnición solo si completa el equilibrio (por ejemplo, verdura cuando el principal no la lleva). La guarnición se puede quitar, cambiar o añadir a mano, y sus ingredientes entran en la compra.
- **Pendiente:** proponer guarniciones vegetales sencillas para que la familia valide cuáles añadir al catálogo.

## D-016 · El sistema propone platos nuevos, no solo rota el catálogo

- **Estado:** aceptada (2026-11-01)
- **Contexto:** los 58 platos de la familia sirven para entender su estilo, no para limitar el menú. Rotar solo 58 platos acaba aburriendo.
- **Decisión:**
  1. Perfil de gusto del hogar a partir del catálogo y las valoraciones (👍/😐/👎).
  2. Cada comida mezcla lo conocido con un "descubrimiento" marcado como tal (aprox. 2 de 3 opciones conocidas, 1 nueva).
  3. Fuentes de platos nuevos: biblioteca de candidatos curada a mano y común a todos los hogares (fase 1-2, sin IA); propuestas con IA a partir del perfil de gusto y del stock (fase 4).
  4. Todo plato nuevo entra como **borrador**: no cuenta para el menú ni la compra hasta que un miembro lo revisa y lo acepta. Ingredientes y cantidades se validan con zod y contra el catálogo de ingredientes.
  5. Filtros duros por hogar y persona: alergias e ingredientes o sabores excluidos.
- **Esquema:** `plato.origen` (semilla, propio, biblioteca, ia), `plato.estado` (borrador, activo, descartado), tabla de valoraciones.
- **Multi-hogar:** la biblioteca de candidatos es global y de solo lectura; cada hogar copia a su catálogo lo que acepta.
- **Riesgo:** una IA puede inventar cantidades o combinaciones poco apetecibles; por eso la revisión humana es obligatoria y el motor de menús nunca usa borradores.

## D-017 · Patrón de aislamiento multi-hogar en la base de datos

- **Estado:** aceptada (2026-11-01) — aplicada en producción (migración `20261101131702`)
- **Decisión:**
  - RLS activada y forzada en todas las tablas; `anon` sin ningún privilegio.
  - Pertenencia comprobada con funciones `privado.es_miembro` / `privado.es_admin` (`SECURITY DEFINER`, `search_path` vacío) en un esquema no expuesto por la API REST, invocadas como `(select …)` para que Postgres las evalúe una vez por consulta.
  - **FK compuestas con `hogar_id`** (`persona(id, hogar_id)`): la base de datos impide enlazar filas de hogares distintos aunque una política estuviera mal escrita (defensa en profundidad).
  - El alta de hogares, invitaciones y canje de códigos solo se hace por funciones RPC; no hay INSERT directo en `hogar`, `miembro` ni `invitacion`.
  - Los códigos de invitación se devuelven en claro una sola vez; en base de datos solo queda su hash SHA-256. Caducan a los 7 días y son de un solo uso.
- **Verificación:** 43 comprobaciones en `supabase/tests/rls_aislamiento.test.sql`. Se comprobó con _mutaciones_ (política abierta, `WITH CHECK (true)`, FK sin `hogar_id`) que los tests fallan cuando deben, y una prueba de humo en producción dentro de una transacción deshecha.

## D-018 · Avisos de los advisors de Supabase aceptados

- **Estado:** aceptada (2026-11-01)
- **`authenticated_security_definer_function_executable` (WARN, 3 funciones):** `crear_hogar`, `crear_invitacion` y `unirse_a_hogar` son `SECURITY DEFINER` y ejecutables por `authenticated`. Es intencionado: son la única vía de alta y de canje de códigos (no se puede hacer con `SECURITY INVOKER` sin abrir la tabla de invitaciones). Cada función exige sesión, valida permisos y fija `search_path`; `anon` no puede ejecutarlas.
- **`unused_index` (INFO, 11 índices):** esperable en una base sin uso. Se revisará con tráfico real antes de eliminar nada.
- **`auth_db_connections_absolute` (INFO):** ver D-011.

## D-019 · Tests de base de datos y versiones de migración

- **Estado:** aceptada (2026-11-01)
- **Tests:** SQL plano con `psql` (`supabase/tests/*.test.sql`) sobre un Postgres efímero con un esquema `auth` imitado (`00_shim_auth.sql`), ejecutado con `scripts/db-test.sh`. Funciona igual en local y en CI sin Docker. El código de salida de `psql` decide el resultado: una excepción en un test hace fallar el script.
- **Limitación conocida:** en este entorno solo hay Postgres 16 (producción usa 17); la CI usará `postgres:17`. El shim no replica todo Supabase (por ejemplo, los privilegios por defecto del rol `postgres`), por eso las funciones `SECURITY DEFINER` se verificaron además en producción.
- **Versiones:** las migraciones se aplicaron con la herramienta MCP, que asigna su propia marca de tiempo; los archivos del repositorio se renombraron a esas versiones para que `supabase db push` y el historial remoto coincidan.

## D-020 · Stack del proyecto base y versiones

- **Estado:** aceptada (2026-11-01)
- **Decisión:** Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 estricto (`noUncheckedIndexedAccess`), Tailwind 4, ESLint 9 + Prettier, Vitest 5, zod 4, `@supabase/ssr`.
- **Motivos de las versiones:**
  - **TypeScript 5.9 y no 7:** TypeScript 7 (reescrito en Go) ya existe, pero la plantilla oficial de Next 16 fija `^5`; se sigue al ecosistema para evitar incompatibilidades con Next y typescript-eslint.
  - **ESLint 9:** lo fija `eslint-config-next`; se actualizará cuando lo soporte.
  - **Sin `vite-tsconfig-paths`:** para un único alias (`@/*`) basta `resolve.alias` en Vitest, una dependencia menos.
- **Tipos de rutas:** `pnpm typecheck` ejecuta `next typegen` antes de `tsc`, porque Next 16 genera tipos globales (`LayoutProps`, `PageProps`).
- **Variables de entorno:** validadas con zod en el primer uso, con mensajes en español. Un test impide colocar una clave `sb_secret_` donde va la publishable.
- **`AGENTS.md`:** lo genera Next 16 para agentes de IA (avisa de que la API ha cambiado y remite a la documentación local de `node_modules/next/dist/docs`). Se versiona, como recomienda Next.

## D-021 · Integración continua

- **Estado:** aceptada (2026-11-01)
- **Decisión:** GitHub Actions con dos trabajos en paralelo:
  1. **Calidad:** `pnpm install --frozen-lockfile`, lint, formato, tipos, tests con cobertura y build.
  2. **Base de datos:** contenedor `postgres:17` (la versión de producción), migraciones y tests de RLS con `scripts/db-test.sh`.
- Permisos mínimos (`contents: read`), cancelación de ejecuciones obsoletas por rama y ningún secreto necesario: la CI no toca producción.
- **Despliegue de migraciones:** fuera de la CI por ahora (se aplican con revisión explícita y advisors después).

## D-022 · Arquitectura en capas con regla de dependencias verificada

- **Estado:** aceptada (2026-11-01)
- **Decisión:** cuatro capas (`dominio`, `aplicacion`, `infraestructura`, `app`) con la regla de dependencias de la arquitectura limpia, aplicada con `no-restricted-imports` de ESLint (alias y rutas relativas). El dominio es puro; la aplicación habla con la base de datos solo mediante puertos. Detalle en [arquitectura.md](arquitectura.md).
- **Verificación:** se comprobó rompiendo la regla a propósito (imports de `next/headers`, `node:fs`, Supabase e infraestructura desde dominio y aplicación, también con ruta relativa): el lint falla en todos los casos.
- **Cobertura:** umbral del 90 % de líneas, funciones y sentencias (85 % de ramas) en `src/dominio`, exigido en CI. Se comprobó que un archivo de dominio sin tests hace fallar la ejecución.
- **Alternativas:** estructura plana en `src/lib` (descartada: nada impide que la lógica de negocio acabe acoplada a Supabase o a la UI) y arquitectura hexagonal completa con inyección de dependencias por contenedor (descartada: excesiva para el tamaño del proyecto; basta con pasar los puertos como parámetros).
- **Sustituye:** la estructura `src/lib/{dominio,menu,compra,despensa,supabase}` de D-020.

## D-023 · Flujo de trabajo con Git

- **Estado:** propuesta (pendiente de la confirmación del autor)
- **Decisión:** `main` protegida; ramas cortas por funcionalidad; PR con la CI obligatoria y la plantilla de definición de hecho; fusión por _squash_; commits convencionales en español; Dependabot para dependencias y Actions.
- **Contexto:** hasta ahora todo el trabajo va en la rama de la sesión de desarrollo (`ccr-58aa3ca2-d5jk36`), porque el repositorio estaba vacío y no existía `main`.

## D-024 · Despliegue en Railway con imagen Docker

- **Estado:** aceptada (2026-11-01) — **sustituye** a Vercel en D-008 y D-020
- **Decisión:** la app se despliega en Railway (región EU West) a partir de un `Dockerfile` propio y `railway.json` (configuración como código: salud en `/api/salud`, reinicio ante fallos). Next genera el servidor autónomo (`output: "standalone"`).
- **Por qué Dockerfile y no el constructor automático de Railway:** la imagen es reproducible (base fijada por digest), se controla quién ejecuta el proceso (usuario sin privilegios, código de solo lectura) y la CI construye y prueba exactamente la misma imagen.
- **Consecuencia:** las variables `NEXT_PUBLIC_*` deben existir en build (`ARG`), porque Next las incrusta al compilar. No son secretas.

## D-025 · CSP estricta con nonce y renderizado dinámico

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la plantilla activaba `cacheComponents` (prerenderizado parcial). La documentación de Next 16 indica que es incompatible con una CSP con nonce. Las alternativas eran `'unsafe-inline'` (anula la protección contra XSS) o SRI (experimental).
- **Decisión:** CSP con nonce por petición generada en `src/proxy.ts`, `'strict-dynamic'`, sin `unsafe-inline`; se desactiva `cacheComponents` y el layout fuerza el renderizado dinámico (`connection()`).
- **Coste aceptado:** sin páginas estáticas. Es irrelevante aquí: app privada con datos por usuario y 2-4 usuarios.
- **Verificación:** E2E en Chromium. Los scripts de Next llevan el nonce y no hay violaciones; un `<script>` sin nonce en el HTML y los manejadores `onerror` inyectados (en el HTML y en el DOM) quedan bloqueados. Se comprobó que, al eliminar la CSP, los tests fallan.

## D-026 · Cadena de suministro

- **Estado:** aceptada (2026-11-01)
- **Decisión:** lockfile congelado; `minimumReleaseAge` de 24 h en pnpm; Actions fijadas por SHA, token de solo lectura y `persist-credentials: false`; gitleaks sobre todo el historial; `pnpm audit --prod --audit-level=high`; Dependabot para npm, Actions y Docker.
- **Evidencia de que funciona:** al añadir Playwright, pnpm se negó a instalar `unrs-resolver` 1.13.0 (dependencia transitiva de ESLint publicada hace 18 h). Se fijó la versión madura anterior (1.12.2) con un `override` temporal en lugar de hacer una excepción a la regla.
- **Avisos aceptados:** 2 vulnerabilidades moderadas en `minimatch` vía ESLint 9 (solo desarrollo, no llega a la imagen). Se resolverán al actualizar a ESLint 10.

## D-027 · Seguridad desde el diseño

- **Estado:** aceptada (2026-11-01)
- **Decisión:** principios de mínimo privilegio, defensa en profundidad, seguro por defecto, minimización de datos y verificabilidad. Modelo de amenazas STRIDE y controles por capa en [seguridad.md](seguridad.md). Cada control tiene un test automático y los de seguridad se validan con mutaciones.
- **Autorización:** en la capa de acceso a datos y en cada Server Action, nunca solo en el proxy (recomendación de la guía de seguridad de datos de Next 16).

## D-028 · Producto para todas las familias del cole: el menú del comedor es compartido

- **Estado:** propuesta (pendiente de la confirmación del autor)
- **Contexto:** el objetivo pasa de "una familia" a "todas las familias del colegio". El menú del comedor es idéntico para todas.
- **Decisión:** introducir el concepto de **centro** (colegio). El menú del comedor y, más adelante, el calendario escolar se guardan una sola vez por centro y los ven los hogares vinculados. El resto de datos sigue siendo privado por hogar.
- **Salvaguardas:** vínculo a nivel de hogar (nunca de niño); versionado y autoría de cada cambio; rol de curador por centro; aviso de error; tests de RLS que demuestran que compartir el centro no abre datos privados de otros hogares.
- **Alta:** por código de centro compartido en el grupo de la clase; sin registro abierto.
- **Alternativas:** cada hogar teclea su menú (descartada: friccion alta y sin efecto red); menú público sin cuenta (descartada: sin control de calidad ni de abusos).
- Detalle en [producto.md](producto.md).

## D-029 · Responsabilidad sobre datos de otras familias (RGPD)

- **Estado:** propuesta (requiere decisión del autor)
- **Contexto:** al abrir la app a otras familias, el autor pasa a ser responsable del tratamiento de datos de terceros, incluidos menores.
- **Decisión propuesta:** minimización estricta (solo alias, tipo y factor de ración de los niños); política de privacidad y condiciones antes del piloto; exportación y borrado de datos desde la app; piloto con 3-5 familias con consentimiento; consulta legal breve y aviso al centro antes de abrirlo a todo el colegio.
- **Fuera de alcance del código:** asesoramiento jurídico. Se señala como riesgo en la memoria.

## D-030 · Orden de módulos de "organizar la vida"

- **Estado:** propuesta
- **Decisión:** MVP = menú con opciones + compra + despensa + menú del cole compartido. Después tareas del hogar, calendario escolar y recordatorios; luego IA para leer el menú desde foto y módulos menores. Regla: no se añade un módulo hasta que el anterior se usa de verdad en casa.

## D-031 · Catálogo comunitario de platos rápidos y sencillos

- **Estado:** requisito aceptado (el autor lo pide); diseño propuesto
- **Contexto:** se quiere un catálogo que las familias enriquezcan entre todas con sus recetas. Prioridad: rápido y sencillo, aunque puede haber de todo.
- **Decisión de diseño:** biblioteca **global** (`plato_compartido`, con sus ingredientes) separada del catálogo **privado** de cada hogar. Publicar crea un borrador que se revisa antes de ser visible; adoptar copia el plato al hogar. Valoración agregada y anónima; reportes; versiones inmutables una vez publicadas. Ingredientes normalizados y comunes, para poder sumar la compra de platos de familias distintas.
- **Riesgos:** (1) moderación, que al principio recae en el autor; (2) derechos de autor, de ahí "solo recetas propias, sin copiar ni fotos"; (3) duplicados de ingredientes ("tomate"/"tomates"), que se atajan con normalización y sugerencias; (4) contenido inapropiado, con reportes y revisión previa a publicar.
- **Dependencia:** el modelo de ingredientes y cantidades debe casar con `seed-platos.json`, que aún no está en el repositorio. Los 58 platos de la familia serán la semilla de la biblioteca.

## D-032 · Reparto de la carga mental como objetivo de producto

- **Estado:** requisito aceptado; diseño propuesto
- **Contexto:** en muchas familias la carga mental (acordarse, planificar, organizar) recae en una sola persona, con frecuencia la madre. La app debe facilitar un reparto equitativo y visible.
- **Decisión de diseño:** cada carga (cena, compra, tarea, gestión del cole) tiene responsable, y concebir, planificar y ejecutar se reparten como una unidad (inspirado en Fair Play). Los avisos van al responsable. Panel de reparto semanal que cuenta también planificar y comprar. Rotación con ponderación del esfuerzo. Lenguaje neutral y sin suponer la composición del hogar.
- **Salvaguardas de tono:** el panel es informativo y compartido, activado por acuerdo; nunca puntúa ni reprocha.
- **Alternativa descartada:** una lista de tareas con "completada" por persona (mide quién ejecuta, no quién carga con acordarse).

## D-033 · El tiempo, restricción de primer orden del generador

- **Estado:** aceptada (2026-11-01)
- **Contexto:** el problema central de la familia es la falta de tiempo para cocinar y para planificar.
- **Decisión:** `tiempo_activo_min` y `tiempo_total_min` en cada plato; tiempo disponible por día (por defecto entre semana ≤ 30 min activos; "hoy llego tarde" ≤ 15 min); botón de "cena de emergencia" con lo que hay en la despensa. Objetivo medible: planificar la semana en menos de 2 minutos.
- **Consecuencia:** el generador trata el tiempo como restricción dura por día, antes que el resto de preferencias blandas.

## D-034 · Centro compartido: diseño implementado y riesgos aceptados

- **Estado:** aceptada (2026-11-01) — aplicada en producción (migración `20261101135511`)
- **Implementado:** `centro`, `centro_hogar`, `centro_codigo`, `menu_cole_dia` e `menu_cole_dia_historial`, más tres funciones (`crear_centro`, `crear_codigo_centro`, `unirse_a_centro`). 93 comprobaciones de RLS en total.
- **Privacidad:** el vínculo es del hogar. **Un hogar solo ve su propio vínculo**: no puede saber qué otras familias usan el centro. Compartir centro no da acceso a ningún dato privado (probado). El historial, que contiene el autor de cada cambio, solo lo ven los curadores y no se puede modificar.
- **Códigos:** 12 caracteres hexadecimales aleatorios (48 bits), solo se guarda el hash, caducan (1-90 días), límite de usos (1-500), revocables; el error es el mismo para código inexistente, caducado, revocado o agotado. Unirse es idempotente.
- **Anti-abuso:** máximo 3 centros creados por usuario; solo el administrador del hogar vincula el hogar.
- **Verificación:** mutaciones que rompen la seguridad (menú legible por cualquiera, vínculos visibles, borrado abierto, código agotado válido, alta por no administrador, historial editable): los 6 se detectan.
- **Riesgos aceptados (a revisar antes del piloto):**
  1. _Fuerza bruta de códigos:_ 48 bits y límites de Supabase lo hacen inviable, pero no hay limitación propia de intentos por usuario.
  2. _Centro sin curador:_ si el único curador sale, nadie puede crear códigos. Falta la promoción de curadores.
  3. _Centros duplicados:_ dos familias pueden crear el mismo colegio por separado; no hay búsqueda ni fusión todavía.
  4. _Edición abierta:_ cualquier hogar vinculado edita el menú; se mitiga con el historial inmutable, pero falta la interfaz de revertir.

## D-035 · Derecho de supresión de datos

- **Estado:** aceptada (2026-11-01)
- **Problema detectado:** `hogar.creado_por` tenía `ON DELETE RESTRICT`, lo que impedía borrar la cuenta de quien creó un hogar, incompatible con el derecho de supresión del RGPD. Detectado al diseñar el producto para otras familias.
- **Corrección:** `ON DELETE SET NULL`; el hogar permanece, sin autoría, y se elimina la pertenencia de la persona. Probado.
- **Pendiente:** limpieza periódica de hogares sin miembros (`pg_cron`) y exportación de datos desde la app.

## D-036 · Catálogo de platos: diseño implementado

- **Estado:** aceptada (2026-11-01) — aplicada en producción (migraciones `20261101143913` y `20261101143940`)
- **Implementado:** `ingrediente` (global, normalizado), `plato` y `plato_ingrediente` (privados por hogar), `plato_compartido` (+ ingredientes y autoría) y `administrador_plataforma`. Cinco funciones: `crear_ingrediente`, `enviar_plato_a_catalogo`, `adoptar_plato_compartido`, `bandeja_revision` y `revisar_plato_compartido`. 162 comprobaciones de RLS en total.
- **Decisiones de diseño:**
  1. _Una unidad por ingrediente_ (g, ml o ud): simplifica sumar la compra entre platos y familias. El importador del seed convertirá las unidades.
  2. _Ingredientes normalizados_ (minúsculas, sin tildes, conservando la ñ) con unicidad: «Tomate» y «tomaté» son el mismo. Los nuevos nacen sin verificar y publicar un plato los verifica.
  3. _La autoría vive en una tabla aparte_ que solo ven el hogar autor y el administrador: ninguna otra familia puede saber quién envió un plato.
  4. _`origen` y `plato_compartido_id` no se pueden fijar a mano_ (privilegios por columna): solo la adopción y el importador los asignan, así nadie falsea que un plato venga de la biblioteca.
  5. _Revisión de un toque:_ la bandeja calcula avisos automáticos (sin pasos, tiempo alto, enlace en el texto, ingrediente nuevo, posible duplicado, sin ingredientes). Ver [moderacion.md](moderacion.md).
  6. _Adoptar copia el plato_ al hogar: se puede adaptar sin afectar a los demás, y sobrevive si el original se retira.
  7. _Aportar es voluntario y pasa por revisión_; el plato adoptado no se puede reenviar (evita bucles).
- **Anti-abuso:** máximo 5 pendientes por hogar y 50 ingredientes nuevos por usuario y día; un plato no se envía dos veces.
- **Verificación:** 9 mutaciones que rompen la seguridad (pendientes visibles, autoría visible, revisión sin ser administrador, origen falseable, adopción de no publicados, verificación abierta, bandeja abierta, sin límite de ingredientes, doble envío): las 9 se detectan. Prueba de humo en producción con UTF-8 real.
- **Bug del entorno de pruebas detectado:** la normalización de tildes fallaba en local porque el Postgres de pruebas no era UTF-8 (producción y CI sí). El script fija ahora `UTF8`, de modo que local y CI coinciden.
- **Aviso resuelto:** `administrador_plataforma` tenía RLS sin políticas (aviso INFO). Se añadió una política explícita que deniega todo.
- **Pendiente:** valoraciones agregadas, reportes y notificación al autor; importación del seed (necesita ver su formato).

## D-037 · Caducidad exacta en las operaciones de despensa

- **Estado:** aceptada (2026-11-01) — aplicada en producción (migración `20261101150059`)
- **Defecto encontrado por una prueba de propiedades:** una fila de despensa vacía conservaba su caducidad antigua, así que al comprar de nuevo el stock recién comprado heredaba una fecha vencida y figuraba como caducado (la app habría seguido pidiéndolo sin parar). Borrar la fecha sin más habría permitido que «deshacer» resucitara comida caducada como si fuera fresca.
- **Reglas:** (1) una fila que llega a 0 pierde su caducidad; (2) cada movimiento guarda la caducidad que tenía la fila antes y deshacer la restaura, de modo que **deshacer es exacto también en las fechas**; (3) no se mezcla stock nuevo con stock caducado: añadir a una fila con stock caducado se rechaza y hay que tirarlo antes (excepto al deshacer). El dominio y la base de datos aplican las mismas reglas.
- **Verificación:** propiedades del dominio (miles de despensas generadas), 8 comprobaciones SQL, 4 mutaciones detectadas y prueba de humo en producción.

## D-038 · Capa de aplicación: estado del hogar como reductor puro

- **Estado:** aceptada (2026-11-01)
- **Decisión:** `src/aplicacion/estado.ts` es un reductor puro (acción → estado nuevo) que usa las funciones del dominio. La interfaz lo consume con `useReducer`; un adaptador de Supabase persistirá las mismas operaciones cuando haya acceso con cuenta, sin tocar las vistas. Hasta entonces la interfaz funciona con **datos de demostración** (una familia de cuatro), que no se guardan.
- **Por qué:** permite construir y probar toda la interfaz (y su responsive) antes de tener login, y mantiene la lógica de negocio fuera de los componentes.
- **Límite honesto:** las pantallas **no están conectadas a la base de datos todavía**; la base de datos, el dominio y la interfaz están probados por separado y falta el adaptador que los une (fase 3, con el acceso por cuenta).

## D-039 · Responsive verificado, no supuesto

- **Estado:** aceptada (2026-11-01)
- **Decisión:** diseño mobile-first con un único punto de corte (768 px) y reglas medibles (sin desbordamiento, objetivos táctiles ≥ 44 px, texto ≥ 16 px, zonas seguras, reflujo a 320 px). Se verifican con 102 pruebas E2E en Chromium sobre 10 tamaños de pantalla (320 a 1920 px, vertical y horizontal), con tema claro y oscuro y revisión de accesibilidad con axe (WCAG 2.2 AA). Detalle en [diseno.md](diseno.md).

## D-040 · zod en modo `jitless` por la CSP estricta

- **Estado:** aceptada (2026-11-01)
- **Contexto:** al llevar el dominio al navegador, el test de seguridad de la CSP falló: zod 4 comprueba al arrancar si se permite `eval`, y con nuestra CSP (sin `unsafe-eval`, D-025) esa comprobación se registra como violación aunque zod la capture.
- **Decisión:** `z.config({ jitless: true })` al inicio del dominio. Los datos son pequeños y no hay pérdida apreciable de velocidad. **No se relaja la CSP.**

## D-041 · La IA propone, el motor decide

- **Estado:** aceptada (2026-11-01). El TFM no exige IA en el producto; se usa donde aporta valor real.
- **Decisión:** el planificador es un **motor determinista** (`src/dominio/menu.ts`) que aplica las reglas duras (alergias y exclusiones, tiempo máximo del día, grupo del menú del cole, no repetir, no repetir grupo con días vecinos) y puntúa con reglas blandas explicables (valoración, antigüedad, caducidades, despensa, rapidez, variedad). Sin azar: mismos datos, mismo resultado. Si las reglas no dejan opciones, el día queda vacío en vez de relajarlas en silencio.
- **La IA, solo donde aporta:** (1) borradores de platos nuevos «del estilo de la casa» (D-016, máx. 1 de cada 3 opciones); (2) leer el menú del cole desde foto o PDF, con revisión humana; (3) lenguaje natural («hoy llego tarde», «sin horno») convertido en filtros estructurados; (4) explicaciones de cada opción redactadas a partir de los motivos que da el motor. **Nunca** para cantidades, compra, despensa ni reparto.
- **Controles:** salida estructurada validada con zod; todo borrador pasa por el motor igual que un plato del catálogo y no entra al menú sin aprobación; alergias filtradas en código, no en el prompt; la IA no recibe datos personales; cuota por hogar y caché; el planificador funciona sin IA; casos de evaluación fijos (cumplimiento de reglas duras = 100 %).
- **Orden de construcción:** motor (hecho en esta decisión, 10 pruebas incl. propiedades) → valoraciones y perfil de gusto → lectura del menú del cole → descubrimientos y lenguaje natural → evaluación.

## D-042 · El recomendador de cenas del cole es una regla dura del motor

- **Estado:** aceptada (2026-11-01)
- **Contexto:** el colegio facilita el menú mensual (`docs/contexto/menu-cole-noviembre-2026.pdf`) y un «Recomendador de cenas» (`docs/contexto/recomendador-cenas-cole.pdf`) que dice qué cenar según lo comido: tras verdura, pasta/arroz; tras pasta/arroz, verdura; tras legumbres, verdura o pasta/arroz; tras huevo, carne o pescado; tras pescado, huevo o carne; tras carne, huevo o pescado; postre: fruta o lácteo.
- **Decisión:** sustituye a la regla simple «no repetir grupo». `recomendadosParaCenar` (en `src/dominio/menu.ts`) convierte primero y segundo del cole en los grupos permitidos para la cena; un plato vale si lo recomienda alguno de los dos. Sin datos del cole no se restringe. La tabla está en código tal cual el documento, para revisarla fácilmente.
- **Datos:** el menú de noviembre del cole se carga como datos de demostración (estructura primero/segundo por día). Leerlo automáticamente desde el PDF o la foto es el primer uso de IA previsto (D-041), con revisión humana antes de guardar. El documento mezcla un menú por centro, así que encaja con el centro compartido: lo introduce un curador y lo ven todas las familias del cole.
- **Pendiente:** el postre recomendado (fruta o lácteo) aún no se muestra.

## D-043 · Modo prueba sin cuenta, con el puerto de persistencia preparado para cuentas

- **Estado:** aceptada (2026-11-01)
- **Decisión:** de momento no hay login. La app arranca en **modo prueba**: datos de ejemplo guardados solo en el dispositivo (`localStorage`, con versión y validación de forma, sin lanzar nunca errores), un banner visible y un botón «Restablecer ejemplo». Así la familia puede probar de verdad (los cambios sobreviven a recargar) sin exponer nada en el servidor.
- **Preparado para cuentas:** la interfaz depende del puerto `AlmacenHogar` (`src/aplicacion/almacen.ts`: cargar, guardar, borrar). Hoy lo cumple `crearAlmacenLocal`; el acceso por cuenta añadirá un adaptador de Supabase (login por código de email, crear/unirse a un hogar, RLS ya lista) que se inyecta en `ProveedorHogar` sin tocar vistas ni reductor. El esquema de base de datos y las políticas de seguridad ya existen y están probadas.
- **Seguridad:** en modo prueba no se envía ni se guarda ningún dato en el servidor. No debe usarse con datos reales sensibles; el banner lo deja claro. El almacén descarta lo guardado con otra versión o con forma incorrecta en lugar de confiar en ello.

## D-044 · Lectura del menú del cole y planificación a 15 días

- **Estado:** aceptada (2026-11-01)
- **Lector determinista primero** (`src/dominio/menu-cole.ts`): se pega el texto del PDF mensual y el lector detecta mes y año, separa primero, segundo, guarnición y postre, une las líneas que el PDF parte, descarta el pan y clasifica cada plato por su nombre (la palabra que aparece antes manda: «Macarrones a la boloñesa de lentejas» es pasta). Lo que no entiende se marca para que una persona lo revise; **nada se guarda sin revisión**. Probado con el menú real de noviembre de 2026 (19 días con menú, los festivos vacíos se omiten, todo clasificado).
- **Por qué no IA todavía:** con texto copiado del PDF el lector da resultados exactos, gratis, sin enviar datos a terceros y sin necesitar claves. La IA (D-041) entrará para fotos y PDF escaneados, devolviendo la **misma forma** (`menuColeLeidoSchema`) y pasando por la misma revisión; el resto del sistema no cambia.
- **Planificación adelantada:** el menú puede abarcar lo que queda de semana o 15 días. Un plato elegido no se vuelve a ofrecer hasta pasados 7 días (en vez de excluirse de toda la ventana), así una quincena no agota el catálogo. La lista de la compra suma las necesidades de todas las cenas elegidas, así que se puede comprar de una vez para 15 días.
- **Límite conocido:** al comprar para 15 días no se considera aún que lo muy perecedero (pescado fresco, verdura de hoja) no aguanta tanto; hay que combinarlo con la caducidad y el congelador. Queda como mejora.
- **Seguridad:** el texto pegado solo se procesa en el navegador, con un máximo de 30 000 caracteres y sin interpretarse como HTML.

## D-045 · Aspecto cálido y amable

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la primera interfaz resultaba apagada y seria; el producto debe gustar a cualquier persona de la familia y ser atractivo a primera vista (Diego: «le tiene que entrar por los ojos a mi mujer y a cualquier mujer»).
- **Decisión:** paleta luminosa (crema, frambuesa, pastel), formas redondeadas, tipografía Nunito, emojis decorativos por grupo de plato y portada personalizada con la cena de hoy. El contraste AA y todas las pruebas de responsive y accesibilidad se mantienen. Detalle en [diseno.md](diseno.md).
- **Pendiente:** validar con Ana y con otras familias del cole; ilustraciones propias y animaciones sutiles en una fase posterior.

## D-046 · Valoraciones por persona que alimentan al motor

- **Estado:** aceptada (2026-11-01)
- **Decisión:** cada persona del hogar valora de 1 a 5 las cenas ya hechas (pulsar de nuevo la misma nota la quita). La **media** se guarda en el plato y es la que usa el motor (`valoracion` en `src/dominio/menu.ts`: sube lo bien valorado y baja lo mal valorado). Las opciones muestran la media con una estrella; los botones son de 44 px y funcionan con teclado y lector de pantalla.
- **Por qué por persona:** las niñas y los adultos no comen igual de a gusto lo mismo; así se ve quién no ha puesto nota y se puede ponderar por persona en el futuro (perfil de gusto, D-041).
- **Base de datos:** la tabla `valoracion_plato` (en la migración `menu_planificado`) ya guarda una nota por persona y plato, con aislamiento entre hogares.

## D-047 · Cena de emergencia

- **Estado:** aceptada (2026-11-01)
- **Decisión:** `cenaDeEmergencia` (`src/dominio/emergencia.ts`) propone platos de ≤ 15 minutos que se pueden cocinar **ya** con la despensa (cantidades por las raciones reales, sin contar lo caducado) o a los que falten como mucho 2 ingredientes. Orden: completos primero, menos faltantes, encaja con el recomendador del cole, gasta lo que caduca, mejor valorados, más rápidos. Es determinista y no usa IA (D-041).
- **Flujo:** «Cocinar ahora» elige la cena de hoy y descuenta la despensa en una operación que se puede deshacer; si falta algo, «Elegir para hoy y apuntar lo que falta» la elige y la compra automática añade lo que falte. Accesos desde la portada («Hoy llego tarde») y desde el menú.
- **Por qué:** ataca el problema central (falta de tiempo) en el momento crítico: evitar comer «rápido y mal de lo que hay en la nevera».
- **Límite:** el catálogo de demostración es pequeño; con el catálogo comunitario de platos rápidos (D-016, moderación) habrá muchas más opciones.

## D-048 · Migración `menu_planificado` aplicada en producción

- **Estado:** aplicada (2026-11-01), versión `20261101200000`.
- **Cómo:** se ejecutó a mano en el editor SQL de Supabase porque la herramienta de migraciones pedía una confirmación interactiva que caducaba. Como el editor SQL no registra el historial, la versión se anotó a mano en `supabase_migrations.schema_migrations` para que el repositorio y producción coincidan.
- **Verificación:** las tres tablas (`comida_planificada`, `dia_hogar`, `valoracion_plato`) tienen RLS activada y forzada, una política cada una y `anon` sin acceso; la restricción de grupos tiene el vocabulario nuevo. Advisors de seguridad: solo los 15 avisos aceptados (D-018); de rendimiento: solo avisos informativos de índices aún sin uso (las tablas no tienen datos) y el de conexiones de Auth (D-011).

## D-049 · Tema claro siempre (el oscuro solo si se elige)

- **Estado:** aceptada (2026-11-01)
- **Contexto:** la app seguía el modo oscuro del móvil y, en el teléfono de la familia, se veía muy oscura (captura de Diego), lo contrario de lo buscado en D-045.
- **Decisión:** el tema es **claro por defecto** aunque el sistema esté en oscuro. Hay un botón «Tema oscuro/claro» (cabecera en móvil, barra lateral en escritorio) y la elección se recuerda en el dispositivo. Los tests de accesibilidad prueban los dos temas.

## D-050 · Catálogo de platos de la familia

- **Estado:** aceptada (2026-11-01)
- **Decisión:** `/menu/platos` permite añadir, editar, buscar por nombre o grupo, dejar de proponer y borrar los platos de la familia, con sus ingredientes por ración y los pasos. La validación vive en el dominio (`src/dominio/catalogo.ts`, mismas reglas que la tabla `plato` y `plato_ingrediente`): nombre 2–120, minutos 1–240, al menos un ingrediente obligatorio, sin repetidos, cantidades positivas, nombres únicos ignorando tildes y mayúsculas. Los **avisos de calidad** (sin pasos, más de 45 minutos, enlaces en los pasos) son los mismos que verá quien modere el catálogo comunitario (D-019). Se pueden crear ingredientes nuevos (nombre normalizado, una sola unidad, sección del súper).
- **Integridad:** editar un plato actualiza las cenas ya elegidas y la compra; borrar uno que está elegido en el menú se rechaza (se puede «dejar de proponer»); «no proponer» lo saca del motor del menú y de la cena de emergencia sin perderlo.
- **Pendiente:** enviar un plato al catálogo comunitario y adoptar los de otras familias (moderación ya diseñada en D-019); importar el seed de platos de la familia.

## D-051 · Personas del hogar de demostración

- Las niñas de la familia son **Alba (9 años) y Emma (5 años)**; los datos de demostración usan sus nombres. Factor de ración 0,5 a ambas de momento (D-012); la edad permitirá ajustarlo y adaptar las propuestas (p. ej. texturas, raciones) más adelante.

## D-052 · Vista de calendario

- **Estado:** aceptada (2026-11-01)
- **Referencias:** las apps de menús familiares más conocidas (Mealime, Plan to Eat, Paprika, Cozi, Yummly) comparten un patrón: el **mes o la semana como cuadrícula**, con la comida de cada día visible sin abrir nada, un **detalle al tocar un día** y planificar hacia delante. Tomamos eso y añadimos lo que nos diferencia: lo que comen las niñas en el cole (🎒) con la cena que lo complementa, quién cocina cada día y las opciones ya filtradas por tiempo.
- **Decisión:** `/calendario` («Agenda» en la barra) muestra el mes con el emoji del tipo de plato de la cena elegida y 🎒 si hay menú del cole; al tocar un día: menú del cole del día, qué conviene cenar, quién cocina, «ese día llego tarde», la cena elegida y las opciones para elegirla o cambiarla. Se puede planificar hasta **60 días por delante** y recorrer los meses.
- **Responsive:** con 7 columnas no caben 44 px de zona táctil por debajo de 400 px de ancho; en pantallas más estrechas el mes se muestra como **lista de días** (cada día es una fila de 56 px). La cuadrícula completa aparece desde 400 px.
- **Pendiente:** vista de semana con arrastrar y soltar, y copiar una semana a otra (muy usado en otras apps).

## D-053 · Modo Diego: la familia real como modo de prueba

- **Estado:** aceptada (2026-11-01)
- **Decisión:** el modo de prueba usa los datos reales de la familia (`src/aplicacion/datos-diego.ts`): Diego, Ana, Alba (9) y Emma (5); los ~55 platos de la app anterior de Diego (capturas en `docs/contexto/`); el menú real del cole de noviembre y su recomendador de cenas; y el cumpleaños de Ana (sábado 7 de noviembre). «Hoy» es la fecha real del dispositivo. Los tests E2E construyen con `NEXT_PUBLIC_DATOS=ejemplo` (datos fijos de D-038).
- **Honestidad sobre los datos:** de los platos solo es real el **nombre**. Los ingredientes, cantidades y tiempos son una **estimación mía** y cada plato lleva la marca «Por revisar» hasta que se edite. No hay despensa (no la conocemos), así que la primera compra lista todo. No se cargaron anotaciones de la app antigua («falta», «en el trabajo papá y mamá»), ni guarniciones sueltas (fuet, chorizo, zanahorias).
- **Planificación de la semana:** «Proponer los días sin cena» rellena de lunes a viernes los días sin cena, sin evento y no saltados, eligiendo la mejor opción de cada día de uno en uno (cada elección condiciona las siguientes). Los fines de semana y los días con evento (el cumpleaños) se deciden a mano. «No cenamos en casa este día» saca un día de la planificación. Un sábado o domingo, «la semana» es la siguiente.
- **Desempate:** con notas iguales, el orden alfabético de los identificadores sesgaba las propuestas; ahora desempata un valor determinista por plato y día (mismos datos, mismo resultado).
- **Cumpleaños:** el calendario y la portada muestran 🎂 y la cuenta atrás; el día del cumpleaños la cena de la familia la cocina Diego (Ana, día libre de cocina).

## D-054 · Explicaciones y equilibrio semanal cole + cena, con fuentes

- **Estado:** aceptada (2026-11-01)
- **Decisión:** cada cena propuesta lleva una **explicación** (`src/dominio/explicacion.ts`): una frase visible («Hoy las niñas han comido verdura y carne en el cole; para compensar, Salmón a la plancha (pescado)») y, desplegable, todas las razones: qué aconseja el recomendador del cole, el equilibrio de la semana, las calorías del cole (se leen del PDF), el tiempo, lo que caduca, lo que os gusta y la novedad. Cada frase sale de un dato; no hay texto inventado.
- **Equilibrio semanal:** la comida del cole y la cena se cuentan **juntas** (`src/dominio/equilibrio.ts`). El motor sube lo que falta en la semana (+1,5) y baja lo que ya ha llegado al máximo (−2,5). Rangos orientativos: legumbres 2–3, pescado 2–4, huevo 2–4, carne 2–4, apoyados en la AESAN y la AEP.
- **Fuentes y honestidad:** [fuentes.md](fuentes.md) documenta de dónde sale cada regla y lo que no se ha podido comprobar (no se pudo abrir la página de la AEP desde la sesión; sus cifras vienen de un resumen de búsqueda y hay que contrastarlas). Las fuentes no coinciden exactamente, así que se usan rangos prudentes. Es orientación, no consejo médico.
- **Cuaderno externo (NotebookLM):** no hay conexión posible desde la sesión; el procedimiento para incorporar su contenido (exportar texto → reglas con fuente y prueba) está en `fuentes.md`.
- **Resultado en el modo Diego:** la propuesta de martes a viernes pasó a ser carne (tras legumbre y huevo en el cole), pescado, huevo y carne, y deja la semana en 2 de legumbres, 2 de pescado y 2 de huevo entre cole y cenas.

## D-055 · Regla de oro de la cena y postre (segunda fuente)

- **Estado:** aceptada (2026-11-01)
- **Contexto:** Diego aportó una segunda fuente (infografía «Tripita en apuros») y la versión web del recomendador del cole.
- **Decisión:** además del grupo de cada plato, la explicación indica **qué le falta para ser una cena completa** según la regla de oro (proteína, hidrato, verdura o fruta, grasa saludable), deducido de sus ingredientes (`src/dominio/componentes.ts`), y recuerda el **postre** (fruta o lácteo). Es una sugerencia para completar el plato, nunca una razón para rechazarlo. Las dos fuentes están en [fuentes.md](fuentes.md) con su límite: la infografía es divulgativa, no oficial.
- **Pendiente:** que la lista de la compra ofrezca añadir esos complementos (patata, ensalada, aguacate, AOVE) con un toque.

## D-056 · Regalo en un enlace

- **Estado:** aceptada (2026-11-01)
- **Decisión:** `/regalo` permite escribir un mensaje y copiar un enlace; quien lo abre ve una pantalla de felicitación y accede a la app. El mensaje viaja en el **fragmento** de la URL (tras `#`), que el navegador nunca envía al servidor: no se guarda ni queda en registros. Se valida con zod (nombres ≤ 40, mensaje ≤ 600, sin caracteres de control, base64url ≤ 4000), se muestra siempre como **texto** (React lo escapa; hay prueba E2E con HTML inyectado) y un enlace roto cae en la pantalla de preparar. El mensaje por defecto es un **borrador** que Diego debe cambiar por sus palabras.
- **Límite:** el regalo no lleva datos de la app; los datos siguen siendo por dispositivo hasta que haya acceso con cuenta (pendiente) y publicación en Railway.

## D-057 · El menú del cole, siempre a la vista

- **Estado:** aceptada (2026-11-01)
- **Petición de Diego:** ver rápidamente, cada día, lo que han comido en el cole para contrastarlo con la cena.
- **Decisión:** una pieza común (`src/componentes/cole.tsx`) con dos vistas: **«En el cole»** (primero y segundo con su emoji de grupo, guarnición, postre, kilocalorías y «Para cenar conviene: …») y **«Cole y cena, de un vistazo»** (cada día con el cole y la cena elegida, uno debajo de otro). Aparecen en la **portada** («Hoy en el cole», o el próximo día con menú si hoy no hay), en el **menú** (resumen de la semana arriba y la tarjeta en cada día) y en el **detalle del calendario**.
- **Datos:** la guarnición se guarda ahora también con el menú del cole (antes solo se usaba al revisar).

## D-058 · Simplificar: menos pantalla, menos scroll

- **Estado:** aceptada (2026-11-01)
- **Petición de Diego:** simplificar mucho y no tener que hacer tanto scroll.
- **Decisión:** (1) **Portada de una sola pantalla**: saludo, cena de hoy, menú del cole de hoy y dos botones; se quitan las tarjetas de módulos (la barra de navegación ya lleva a cada sección). (2) **Menú en acordeón**: cada día es una fila de una línea (día, cena elegida o «Elegir cena», emojis del cole) y solo se abre un día a la vez, por defecto el primero sin cena; dentro, el cole, las opciones (una línea cada una) y los botones. Al elegir se ocultan las demás opciones y al cancelar vuelven. Se elimina el resumen largo «Cole y cena» (cada fila ya lo muestra). (3) **«Por qué» y «¿Qué tal estuvo?» plegados** hasta que se piden. (4) **Cabeceras sin párrafos explicativos**, títulos más pequeños, banner de modo de una sola línea y botones del menú más cortos.
- **Medida:** la portada cabe sin desplazarse en un móvil de 390 × 844; las filas de día abiertas siguen siendo la parte larga, a propósito, porque ahí se decide.
- **Segunda pasada (reparto, compra, despensa):** el reparto pasa de ~2400 a ~1500 px de alto (los turnos de la semana van plegados y cada cosa de la casa es una fila con su selector de responsable en vez de una tarjeta), y los huecos entre secciones de compra y despensa se reducen. Pendiente: buscador y secciones plegables en la despensa cuando tenga muchos productos.

## D-059 · Varios platos pequeños en una misma cena

- **Estado:** aceptada (2026-11-02)
- **Petición de Diego:** poder elegir varias cosas cuando son «muy poca cosa» (una sopa, una ensalada, unas gulas), no solo una.
- **Decisión:** una cena puede tener hasta **3 platos**. Al elegir uno, las demás opciones se ocultan (D-058) y aparece «＋ Añadir otro plato», que ofrece **complementos**: los platos marcados como **pequeños** (`ligero`) suben, los grandes bajan, no se repite lo ya elegido y solo se ofrece lo que cabe en el tiempo que queda del día (30, 15 o 60 min menos lo ya elegido). «Quitar» quita un plato; cambiar con «Elegir» sustituye toda la cena. Como cena **principal** el motor penaliza los platos pequeños (una sopa sola no es una cena), y las reglas del cole y el equilibrio semanal se calculan con el plato principal; la compra suma todos los platos.
- **Datos:** en el modo Diego están marcados como pequeños: champiñones, gulas, judías verdes, guisantes con jamón, puré, tosta, salmorejo, sopa, ensalada de tomate y aguacate, ensaladilla, croquetas, empanadillas, onion bhaji y patatas Ana. Se puede marcar o desmarcar en «Mis platos».
- **Base de datos (pendiente):** `comida_planificada` tiene `unique (hogar_id, fecha, momento)`, que impide varios platos por cena. Al conectar la app a Supabase hará falta una migración que cambie la unicidad a `(hogar_id, fecha, momento, plato_id)` y añada `ligero` a `plato`.

## D-060 · Enviar el plan: WhatsApp, Keep y Google Calendar

- **Estado:** aceptada (2026-11-02)
- **Petición de Diego:** poder enviar el plan a Ana de forma sencilla y vistosa (por si no le apetece entrar a la app), o a Google Keep o Google Calendar.
- **Decisión:** pantalla `/compartir` («📤 Enviar», desde el menú y la compra) con dos tarjetas: **el menú** (días con lo del cole en emojis, cenas y fechas señaladas) y **la lista de la compra** (por secciones del súper, con casillas ☐). Cada una se puede **enviar por WhatsApp** (enlace `wa.me` con el texto; quien lo pulsa elige a quién), **compartir** con el menú del móvil (Keep aparece ahí como destino), **copiar** o verse antes. El menú también se descarga como **archivo de calendario `.ics`** (una cena por día, de todo el día, con lo del cole en la descripción) que Google Calendar importa.
- **Por qué así:** no hay integración con las APIs de Google (exigiría cuenta, permisos y claves y no es necesaria para esto) ni se envía nada a ningún servidor: todo se genera en el dispositivo, con formato de WhatsApp (negrita y cursiva). Los textos se recortan a 3800 caracteres y el `.ics` sigue el RFC 5545 (escapado, líneas plegadas a 75 bytes sin partir emojis).
- **Pendiente:** una imagen vistosa del menú (tarjeta) para enviar en vez de texto, elegir la hora de la cena en el calendario y un botón «avisar a Ana cada semana» cuando haya cuentas.

## D-061 · Apuntar a la compra en un toque: voz, varias cosas a la vez y «lo de siempre»

- **Estado:** aceptada (2026-11-02)
- **Qué enseña la lista histórica de la familia** (pegada por Diego, años de listas): no es una lista de ingredientes de recetas. Es la **lista de la casa**: leche, pan, huevos, yogures, kéfir, fruta, pañales, cervezas, papel higiénico, comida de los gatos, detergente… repartida por **tiendas** (Mercadona, Primor, Ahorramás, Farmacia, Bazar, IKEA, Decathlon…) y con cosas que no son de comer (un cepillo, una lámpara, un recogedor). Casi todo se repite semana tras semana, y se apunta de pie en la cocina, rápido.
- **Decisión:** (1) **Escribir o dictar varias cosas de una vez** («leche, pañales y pan» → tres artículos): se parte por comas, «y», punto y coma y saltos de línea, sin repetir lo que ya está pendiente. (2) **Voz:** botón 🎤 con el reconocimiento del navegador (español) donde existe; donde no (Brave, por ejemplo) se indica usar el micrófono del teclado, que sirve igual porque el campo acepta varias cosas. (3) **Sugerencias** mientras se escribe y **«⚡ Lo de siempre»**: 70 artículos habituales sacados de la lista histórica, que se apuntan con un toque y desaparecen al estar en la lista. (4) **Sección del súper deducida del nombre** (`clasificarArticulo`: leche → lácteos, pañales → higiene y bebé, latas de gatos → mascotas…), validada con 36 casos reales de la lista; lo apuntado a mano ya sale agrupado como lo automático. (5) **Botón flotante «＋»** en todas las pantallas para apuntar sin ir a «Compra». (6) El mensaje de WhatsApp/Keep agrupa también lo apuntado a mano por sección.
- **No hecho aún:** agrupar por **tienda** (Mercadona, Primor…) además de por sección, aprender qué compráis con más frecuencia para ordenar «lo de siempre», y un modo «estoy en el súper» con letra grande.
- **Base de datos (pendiente):** las categorías `higiene` y `mascotas` no existen en el `check` de `lista_compra_articulo.seccion`; hará falta una migración al conectar la app a Supabase.
- **Nota:** el texto pegado incluía restos de la interfaz de Google Docs («Edit with the Docs app… NO, THANKS USE THE APP»); no era contenido de la lista y se ha ignorado.

## D-062 · Día de zafarrancho: tareas de cada persona

- **Estado:** aceptada (2026-11-02)
- **Origen:** Ana escribió a mano una lista con lo que tiene que hacer cada miembro de la familia (foto en `docs/contexto/lista-tareas-ana.jpg`): rutinas de las niñas (dientes, vestirse, hacer la cama, recoger la habitación y las manualidades), deberes y un examen de Alba, y tareas de Diego y de Ana (limpiar cristales, bajar las sillas, ropa, cocina, Halloween…). Encaja con el propósito de la app: **hacer visible el reparto de lo que cada uno lleva** (D-032), también las tareas de los adultos.
- **Decisión:** pantalla `/tareas`, llamada **«Día de zafarrancho» 🧹** (idea de Diego): una lista por persona con casillas grandes, el progreso de la persona y el de la **familia entera**, y añadir tareas igual que en la compra (varias de una vez, «deberes, recoger la mesa»). Hay dos tipos: **cada día** (se marcan hoy y mañana vuelven a estar pendientes) y **una vez** (se hacen y desaparecen al día siguiente). Sin puntos, premios ni comparaciones entre personas: solo ver lo pendiente y celebrar al terminar.
- **Datos (modo Diego):** se cargan las tareas de la foto. Las rutinas de las niñas van como «cada día»; lo demás, como puntuales. «Chill out», «Transportín» y «Cutxa ska» se copiaron tal cual sin saber a qué se refieren.
- **Pendiente:** repartir las tareas de la casa (limpiar cristales, bajar sillas) entre quienes cabe de forma justa con la rotación del reparto, un modo «niña» con letra grande y pegatinas, y enviar la lista de una persona por WhatsApp.
- **Base de datos (pendiente):** hará falta una tabla `tarea` y `tarea_hecha` (por hogar y persona) al conectar la app a Supabase.

## D-063 · Cuenta y sincronización del hogar

- **Estado:** aceptada (2026-11-02). Detalle y configuración en [sincronizacion.md](sincronizacion.md).
- **Decisión:** el plan del hogar se guarda en la nube como **un documento versionado** (`hogar_estado`) en vez de pasar ya a tablas relacionales: es lo más corto que da sincronización real entre móviles y reutiliza el reductor probado. Escritura solo con `guardar_estado_hogar` (control de versión: si otro guardó antes, error 40001) y lectura por RLS a los miembros del hogar. Los dispositivos se enteran por Realtime. Los conflictos se resuelven **reaplicando las acciones propias sobre el estado nuevo** (`Sincronizador`, `src/aplicacion/sincronizacion.ts`), no con «el último gana».
- **Acceso:** correo con código de 6 cifras (OTP) o sesión anónima («sin correo»); el hogar se crea y se comparte con el código de invitación que ya existía (`crear_hogar`, `crear_invitacion`, `unirse_a_hogar`, que guardan solo el hash).
- **Verificación:** 9 pruebas del sincronizador con una nube simulada (incluido el caso de dos dispositivos a la vez y el de sin red), 20 comprobaciones SQL con 2 mutaciones detectadas (versión y pertenencia) y la build en los dos modos. **No** se ha probado con Supabase Auth real ni con correo real: el primer uso real es la prueba.
- **Por qué no tablas todavía:** las tablas relacionales (platos, despensa, tareas…) siguen diseñadas y con RLS, pero migrar cada pantalla a consultas llevaría semanas; el documento permite usar la app compartida ya y migrar por partes después sin cambiar las pantallas.
- **Pendiente:** CAPTCHA y límites para sesiones anónimas, vincular un correo a una sesión anónima, persistir la cola de cambios sin conexión entre recargas y conectar los permisos por rol (administrador/miembro).

## D-064 · Hallazgo: en producción `authenticated` tenía todos los privilegios (corregido)

- **Estado:** corregido y aplicado en producción (2026-11-02), migración `20261102100100`.
- **Qué pasaba:** Supabase concede por defecto `ALL` a `anon`, `authenticated` y `service_role` sobre cada tabla que se crea en `public`. Nuestras migraciones revocaban solo a `anon` y `public` y concedían después lo mínimo a `authenticated`, pero **no le quitaban lo heredado**. En producción, `authenticated` tenía INSERT, UPDATE, DELETE y TRUNCATE en las 26 tablas, así que las restricciones «por columna» **no valían** (por ejemplo, un miembro podía fijar `plato.origen` a mano o cambiar `despensa_item.cantidad` sin pasar por una operación con registro). **El aislamiento entre hogares no estaba afectado:** lo garantizan las políticas RLS, que sí estaban activas y forzadas. No había datos ni usuarios en producción cuando se detectó.
- **Por qué no lo vieron las pruebas:** el Postgres de pruebas no tenía esos privilegios por defecto, así que todo parecía correcto. Es una **lección de diseño de las pruebas**: el entorno de test debe reproducir los valores por defecto de la plataforma.
- **Cómo se detectó:** al comprobar los privilegios de la tabla nueva `hogar_estado` tras aplicar la migración (`authenticated` figuraba con INSERT aunque solo se le concedió SELECT).
- **Corrección:** (1) `00_shim_auth.sql` reproduce ya los privilegios por defecto de Supabase; con eso, el test de «origen» falló en local y quedó demostrado el fallo. (2) La migración `privilegios_minimos` revoca todo a `anon` y `authenticated` en tablas y secuencias y vuelve a conceder solo lo necesario, y evita que lo nuevo herede privilegios por defecto. (3) Nueva suite `privilegios.test.sql`: ningún privilegio para `anon`, nada de TRUNCATE/TRIGGER/REFERENCES para `authenticated`, tablas de solo lectura de verdad y las restricciones por columna. Con una mutación (quitando la revocación) la suite detecta el fallo.
- **Verificado en producción tras aplicar:** `anon` 0 privilegios; `authenticated` 0 privilegios peligrosos; `hogar_estado` solo SELECT; no puede cambiar `cantidad` ni fijar `origen` ni insertar hogares; las funciones de la API siguen ejecutables solo por `authenticated`. Advisors: solo los 16 avisos aceptados (D-018; 15 + `guardar_estado_hogar`).
- **Regla desde ahora:** toda migración que cree una tabla debe revocar a `anon` **y a `authenticated`** y conceder explícitamente; la suite de privilegios lo comprueba para todas las tablas.

## D-065 · Migraciones `hogar_estado` y `privilegios_minimos` aplicadas en producción

- **Estado:** aplicadas (2026-11-02), versiones `20261102100000` y `20261102100100`. La primera la ejecutó Diego en el editor SQL; la segunda se aplicó con `execute_sql` (una transacción) al ser una corrección de seguridad de mi propio trabajo. Las versiones se anotaron a mano en `supabase_migrations.schema_migrations`.

## D-066 · Repasar qué queda poco, contador de la compra y «¿Quién eres?»

- **Estado:** aceptada (2026-11-02)
- **Petición de Diego:** que la despensa ayude a acordarse de comprar cuando queda poco de algo.
- **Decisión:** la familia no lleva el stock al gramo, así que en vez de exigir cantidades, la despensa tiene **«🔎 Revisar qué queda poco»**: los ~70 artículos de siempre agrupados por sección; se toca lo que queda poco y **se apunta a la compra**, y al tocarlo otra vez se quita. Además, la pestaña **Compra** muestra un **contador** con lo pendiente (calculado + apuntado a mano) para acordarse con solo ver la barra. Quien sí lleve cantidades sigue teniendo el stock mínimo automático.
- **«¿Quién eres?»**: cada móvil recuerda quién lo usa («Soy Ana»), solo en ese móvil. Sirve para saludar por el nombre, abrir sus tareas por defecto, enseñar «Tus tareas de hoy» y, importante, **no enseñar el botón «Preparar un regalo» a nadie que no sea Diego** (para no destripar la sorpresa).
- **Pendiente:** avisos push («queda poco de leche») cuando haya cuentas, y que «queda poco» recuerde cuántas veces se repite para ordenar «lo de siempre».

## D-067 · Ver todo el catálogo al elegir, ordenado por lo que más conviene

- **Estado:** aceptada (2026-11-02)
- **Petición de Diego:** al elegir la cena, poder ver **todas** las opciones de la base de datos de platos, ordenadas por compatibilidad con la comida del cole si procede y, si no, por lo que más convenga para mantener la dieta equilibrada, mirando lo ya comido en los días previos y lo ya planificado para los siguientes.
- **Decisión:** «📚 Ver todos los platos» (en el menú y en el calendario, al elegir y al añadir un complemento) abre el **catálogo completo ordenado** (`ordenarCatalogo`, `catalogoOrdenado`). Primero los que **encajan** (sin problemas de cole, tiempo, vecinos ni repetición), ordenados por puntuación: equilibrio de la semana, gusto, caducidad, despensa, tiempo; después los que tienen problemas, **cada uno con el motivo en una frase**: «En el cole: verdura y carne. Tras eso se aconseja pasta, arroz, huevo, pescado, no carne», «El día anterior ya hay huevo», «Ya lo tenéis elegido esa misma semana», «Son 45 min y ese día hay 30»; al final, los que llevan un ingrediente excluido. Cada plato muestra además cómo va su grupo en la semana: «Os falta pescado (0 de 2–4)» o «Ya van 4 de carne esta semana». Hay buscador y paginación. **Se puede elegir cualquiera**: la app avisa de lo que se sacrifica, no lo impide.
- **Qué mira:** la semana completa (de lunes a domingo) con el cole y las cenas ya elegidas **antes y después** de ese día, y los dos días vecinos. No mira todavía el equilibrio entre semanas distintas.
- **Comidas:** solo se planifican cenas. La comida de lunes a viernes es la del cole (ya contada en el equilibrio); las comidas de fin de semana en casa no están modeladas todavía.
- **Pendiente:** modelar la comida de fin de semana y que el equilibrio mire los 7 días anteriores aunque caigan en la semana pasada.

## D-068 · Cumpleaños de todos y avisos con un mes de margen

- **Estado:** aceptada (2026-11-02)
- **Petición de Diego:** meter las fechas de cumpleaños de todos y que **un mes antes** avise a todos o a los interesados para ir pensando regalos, con propuestas.
- **Decisión:** pantalla `/cumples` («🎂 Cumples y regalos»): alta de uno en uno o **pegando varios** («Alba 12/3/2017», «Abuela Rosa 20 de enero»), con relación (familia, amigo, cole), gustos y año de nacimiento (para saber la edad). Por cada cumpleaños: **estado del regalo** (sin pensar, con idea, comprado, entregado; se reinicia cada año), **ideas propias** y **propuestas** según la edad y los gustos (`ideasDeRegalo`: categorías, no productos inventados).
- **Avisos:** a **30 días** «Empezad a pensar el regalo», a **14** «Hay que comprar», a **7** «Esta semana», y el propio día. Salen en la **portada** («🎁 Próximos cumples») y dejan de salir cuando el regalo está comprado. Además, el **archivo de calendario (.ics)** incluye cada cumpleaños y sus dos avisos como **eventos anuales con alarma a las 9:00**, de modo que el móvil avisa solo, sin abrir la app y cada año.
- **Sorpresa:** a quien cumple (la persona del hogar con ese nombre) **no se le enseñan** las ideas, el estado del regalo ni el aviso («🙈 Es sorpresa»). Las niñas no tienen móvil, así que la protección es para el uso compartido de los dispositivos de los padres; ver el plan para el secreto fuerte.
- **Datos:** solo se conoce el cumpleaños de Ana (7 de noviembre); el resto lo añade la familia. La app marca los miembros del hogar sin fecha.
- **Límites:** los avisos dentro de la app solo se ven al abrirla; el aviso sin abrir depende del calendario del móvil. Las notificaciones push quedan para más adelante. Las ideas son genéricas: una IA podrá personalizarlas con lo que se sepa de cada persona (D-041).

## D-069 · iPhone: lo que cambia

- **Estado:** aceptada (2026-11-02). Ana usa iPhone.
- **Instalar en la pantalla de inicio** («Compartir → Añadir a pantalla de inicio»): la app se abre a pantalla completa y, además, **Safari borra los datos de las páginas web que no se usan en 7 días** pero no los de las apps instaladas. La portada enseña una ayuda para hacerlo, solo en iPhone/iPad y mientras no esté instalada. Se añadieron los iconos (`apple-icon.png`, `icon.png`, 192 y 512) y se actualizaron los colores del manifiesto.
- **La app instalada tiene almacenamiento aparte de Safari:** una sesión iniciada en Safari **no** pasa a la app del icono. Hay que entrar y unirse al hogar **dentro de la app instalada**.
- **Avisos:** las notificaciones push en iOS solo existen para apps instaladas (iOS 16.4 o posterior) y con permiso. Por eso la vía fiable son las alarmas del **calendario** (el archivo `.ics` se abre en Calendario con «Añadir todos»).
- **Voz:** el botón 🎤 de la app puede no funcionar en Safari; el dictado del teclado de iOS funciona igual porque el campo acepta varias cosas separadas por comas o «y».
- **Sin verificar:** solo se ha probado con Chromium; **no se ha probado en un iPhone real ni con WebKit**. Es la primera cosa que hay que revisar en un dispositivo.

## D-070 — La app felicita el día del cumpleaños

- **Qué:** el día del cumpleaños, la portada abre con una tarjeta de fiesta. A quien cumple (según «¿Quién eres?») le dice «¡Feliz cumpleaños, X! Hoy cumples N»; a los demás les avisa «Hoy cumple X, no os olvidéis de felicitarle» y ofrece un botón que abre WhatsApp con la felicitación escrita.
- **Por qué:** quitar otra cosa que recordar (carga mental). Los avisos de regalo ya existían; faltaba el momento de felicitar.
- **Cómo:** `felicitacionesDeHoy` es una función pura del dominio, con tests. La animación (CSS) se detiene con `prefers-reduced-motion`.
- **Límites:** la felicitación solo se ve si alguien abre la app ese día; no hay notificación push (en iPhone solo funciona con la app instalada). El aviso sin abrir la app sigue siendo el evento anual del calendario. No hay prueba E2E del día exacto porque los datos de ejemplo no tienen cumpleaños en su «hoy».

## D-071 — Perfiles al estilo Netflix

- **Qué:** al abrir la app en un móvil sin perfil elegido sale «¿Quién eres?» con una ficha grande por persona (adultos y niñas). Al elegir, se entra en ese perfil. Un botón con la inicial (cabecera en móvil, barra lateral en escritorio) permite **cambiar de perfil**. Sustituye al aviso suelto «¿Quién eres?» de la portada.
- **Por qué:** es lo que ya hacía `useYo` (saludar, enseñar tus tareas, esconder sorpresas), pero ahora es lo primero que se ve y es más fácil para quien comparte un móvil o tablet con las niñas.
- **Cómo:** `PuertaDePerfil` envuelve la app y no enseña nada más hasta elegir; espera a haber leído lo guardado para no ofrecer personas de ejemplo ni parpadear. El perfil se guarda **solo en ese dispositivo** (no se sincroniza).
- **Límites:** **no es seguridad**: no hay PIN, así que cualquiera con el móvil desbloqueado puede entrar en el perfil de otro y ver, por ejemplo, el regalo. Un PIN por perfil o un perfil infantil con menos pantallas quedan pendientes y dependen de lo que decida Diego. Si el hogar sincronizado trae personas con otros identificadores, volverá a pedir perfil.

## D-072 — Al elegir un plato, las demás opciones siguen a la vista

- **Qué:** tras elegir un plato, la lista para añadir más se queda abierta (platos pequeños primero) y se va marcando uno tras otro hasta llenar la cena (3 platos) o pulsar «Listo». Antes, al elegir se ocultaba el resto.
- **Por qué:** Diego pidió poder seleccionar varios platos más rápido, sin volver a abrir la lista cada vez. Sustituye al «ocultar tras elegir» anterior, que dejaba la pantalla limpia pero obligaba a más toques.
- **Límite:** la lista tras el primer plato ofrece complementos, no otra vez los principales.

## D-073 — Cuenta atrás de cumpleaños y eventos

- **Qué:** una fila de píldoras en la portada («🎂 Ana (41) · en 5 días», «🥾 Excursión · mañana») con lo próximo en los siguientes 30 días: máximo 3, de lo más cercano a lo más lejano. Ocupa una línea. Sustituye a la píldora del único evento próximo que había en el saludo.
- **Fuente:** los cumpleaños y las fechas señaladas de la app (`eventos`). El propio día del cumple no sale: lo cubre la tarjeta de felicitación (D-070).
- **Cómo:** `cuentaAtras` es una función pura del dominio, con tests.
- **Pendiente (decisión de Diego):** sincronizar con el Google Calendar «Familia». Ver el mensaje de la sesión: opciones de solo lectura por enlace secreto iCal frente a OAuth completo.

## D-074 — Google Calendar «Familia» por enlace secreto (solo lectura)

- **Estado:** aceptada (2026-11-02); sin probar contra un calendario real de Google.
- **Qué:** la app lee el calendario de Google «Familia» con su «Dirección secreta en formato iCal» y enseña esos eventos en la **cuenta atrás** de la portada (📅) y en el **calendario**. Los cumpleaños de Google que ya tenemos en la app no se repiten.
- **Cómo:** la ruta `/api/calendario-familia` (servidor) descarga el `.ics` con la variable `GOOGLE_CALENDAR_ICAL_URL`, lo guarda 15 minutos en memoria y devuelve solo los próximos 60 días (título, día y hora). El lector (`dominio/ics.ts`) entiende eventos de día completo y con hora (pasados a hora de Madrid), repeticiones diaria/semanal/mensual/anual con `INTERVAL`, `UNTIL`, `COUNT`, excepciones, cambios de un día y cancelados.
- **Seguridad:** el enlace da acceso a **todo** el calendario, por eso (1) vive solo como variable en Railway, nunca en el repo ni en el navegador; (2) la ruta solo responde si el navegador manda su sesión y **Supabase confirma que es miembro de un hogar** (se consulta `miembro` con su propio token, así decide la RLS); (3) solo se aceptan URLs `https://calendar.google.com` (no hay petición a sitios arbitrarios); (4) los errores no cuentan detalles; (5) `Cache-Control: no-store`.
- **Límites:** solo lectura: lo que se escribe en la app no va a Google (para eso sigue el `.ics` de exportar). Requiere haber **entrado con la cuenta** (modo con nube); en modo prueba local no hay calendario de Google. Hasta 15 minutos de retraso. Si se pulsa «Restablecer enlace» en Google, el enlace viejo deja de valer. Repeticiones raras (`BYSETPOS`, «último viernes del mes»…) no se interpretan; tampoco zonas horarias que no sean UTC o la hora local indicada.

**Límite conocido de D-074 (decidido por Diego, 2026-11-02):** la integración vale solo para esta instalación. Hay **un único calendario por despliegue** (variable `GOOGLE_CALENDAR_ICAL_URL`), solo se aceptan enlaces de `calendar.google.com` (no iCloud ni Outlook) y se configura en Railway, no desde la app. Es suficiente para una app privada de una familia. **Antes de abrirla a otras familias** hay que: pantalla en «Cuenta» para pegar el enlace, guardarlo por hogar en Supabase (tabla solo accesible desde el servidor), aceptar otros proveedores iCal con protección contra peticiones a direcciones internas (SSRF), poder borrarlo del todo y revisarlo en la revisión de RGPD.

## D-075 — Apuntar en la agenda como en una nota (y traer la nota de Keep)

- **Petición:** Ana apunta las próximas fechas en Google Keep («17 Marzo Excursiones Alba concierto», «1 Junio 8:00 Midas»). Keep **no se puede conectar** (su API solo existe para cuentas de empresa de Workspace y no hay enlace secreto), así que la app admite **la misma forma de escribir**, y la nota de Keep se pega entera.
- **Qué:** en «Calendario» hay una sección «✍️ Apuntar»: un cuadro de texto, un apunte por línea (o separados por «;»). Entiende «17 Marzo …», «17-19 Abril …» (varios días), «1 Junio 8:00 …» (con hora), «7 de noviembre de 2027 …», «12/3 …»; tolera erratas en el mes («Septimembre»), ignora las casillas «[X]» / «[ ]» y las viñetas. **Lo que no lleva fecha pasa a tareas puntuales de la persona del perfil** (D-071). Lo que parece fecha pero no vale (31 Abril, hora 25:00) no se pierde en silencio: el aviso lo enumera.
- **Sin año:** se apunta la **próxima vez que cae** desde hoy, igual que los cumples. Por eso, al **pegar varias líneas** (más de 3) la app pide confirmar y lo explica; pegar una nota vieja con fechas ya pasadas las mandaría al año que viene.
- **Dónde se ve:** la cuenta atrás de la portada (junto a cumples y Google Calendar), el calendario (en su día) y la lista «Apuntado» (con «Quitar»). No se repite lo ya apuntado (misma fecha y título).
- **Datos:** nueva lista `agenda` en el estado. No se sube la versión del almacén (habría borrado lo guardado): lo anterior se carga con `agenda: []`, y lo recibido de la nube sin ella también. Se sincroniza con el resto del estado.
- **Límites:** los `[X]` de Keep se ignoran (no sabemos si significan «hecho» o «ya en el calendario»); un evento de varios días sale en la cuenta atrás desde su primer día; no hay edición de un apunte (se quita y se vuelve a apuntar); no hay avisos fuera de la app (para eso sigue el `.ics`, que aún no incluye los apuntes). Un «número + palabra» que no sea mes («17 Inscripción taller») se toma como tarea sin fecha.

## D-076 — Módulo «Próximas fechas»: copiar a Keep y llevar al calendario

- **Qué:** página `/fechas` (botón «📌 Fechas» en la portada y enlace desde Calendario) con: apuntar como en una nota (D-075, movido aquí), la lista «Lo que viene» (apuntes, cumples, fechas señaladas y Google Calendar, a 6 meses) y, por cada fecha, **«＋ Google»** (abre Google Calendar con el evento ya relleno, solo falta guardar) y **«＋ .ics»** (para el Calendario del iPhone de Ana).
- **Keep:** «📋 Copiar para Keep» deja los apuntes como líneas «17-19 Abril Familias de Puente», «1 Junio 08:00 Midas». Pegadas en una lista de Keep, cada línea es un elemento; y copiadas de Keep y pegadas aquí, se vuelven a apuntar igual (hay un test de ida y vuelta). El año solo aparece cuando la fecha no es la próxima vez que cae ese día.
- **Calendario:** «📅 Todo al calendario (.ics)» descarga lo próximo, y el `.ics` general de «Enviar» incluye ahora los apuntes (con hora de 1 hora, varios días y aviso).
- **Dónde se guarda:** la página dice si lo apuntado está **solo en este móvil** o **en la nube**. Con la cuenta conectada, la agenda va en el estado del hogar que se guarda en Supabase (`hogar_estado`, con RLS y versión), igual que cumples, tareas y menú. **No hay tablas propias por tipo de dato** (una `agenda`, una `cumples`…): es un documento por hogar (D-063). Pasarlo a tablas relacionales sigue pendiente; hasta entonces no se pueden hacer consultas SQL por fecha.
- **Límites:** «＋ Google» abre la web/app de Google Calendar del dispositivo, donde hay que estar con la cuenta correcta; el `.ics` de un evento suelto depende de que el navegador deje abrirlo (en iPhone, Safari). Los avisos salen del calendario del móvil, no de la app.

## D-077 — Una configuración de la nube mala no tumba la app

- **Qué pasó:** en Railway la app mostró «This page couldn't load» en todos los navegadores. Reproducido en local: si `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no empieza por `sb_publishable_` (p. ej. la clave antigua `eyJ…`) o la URL no es válida, `crearClienteNavegador()` lanzaba una excepción al arrancar y se caía **toda** la app, incluso sus partes que no usan la nube.
- **Arreglo:** esa creación va en `try/catch`: ante una configuración inválida, la app sigue en **modo local** y deja el motivo en la consola. Además hay pantallas de error propias (`error.tsx`, `global-error.tsx`) que enseñan el mensaje en vez del aviso genérico, y un estado de la nube antiguo (sin agenda) se completa antes de usarlo (`normalizar`).
- **Pendiente de confirmar:** que esta fuera la causa del fallo real de Railway; no se han visto los registros del despliegue.
- **Límite:** en modo local no hay sincronización ni Google Calendar hasta corregir las variables.

## D-078 — Casa: lo recurrente (sábanas, toallas y compañía)

- **Estado:** aceptada (2026-11-02). Primer módulo del plan de carga mental (`docs/plan-carga-mental.md`, sección B).
- **Problema:** «Diego nunca se acuerda» de cambiar sábanas y toallas, así que Ana acaba concibiendo y recordando todo. La tarea no es difícil; lo difícil es acordarse.
- **Qué:** página `/casa` y tarjeta «🏠 Hoy toca en casa» en la portada. Cada tarea tiene **frecuencia** (cada 3 días, semana, 2 semanas, mes, 3 meses, 6 meses, año), **responsable** (una persona o «los dos») y **última vez hecha**. La app calcula cuándo toca; al pulsar **«✓ Hecha»** se reprograma sola contando desde ese día; **«Mañana»** la aparta un día; «Ya la hice» la marca hecha antes de que toque. Se agrupan en «Hoy toca», «Esta semana» y «Más adelante».
- **Plantilla:** un botón añade 12 tareas orientativas (sábanas de mamá y papá cada 14 días, de las niñas cada 7, toallas, toallas de manos y trapos cada 3, nevera, filtros de campana y aspirador, cepillos de dientes, botiquín, caldera, coche, dentista), **escalonadas** para que no caigan todas el mismo día. Nada se añade solo: lo pulsa quien quiera.
- **Reparto:** «Repartir entre los dos» asigna las que no tienen responsable **alternando entre los adultos**, empezando por quien menos lleva. Es una propuesta sencilla que se corrige a mano; **no** es el motor de reparto completo (`proponerRotacion`) ni cuenta la carga mental. **Quién lleva qué se decide entre Diego y Ana**: la app no asigna nada sin que se pulse.
- **Sin señalar:** en la portada solo salen las tareas del perfil abierto y las de «los dos»; las de otra persona no se enseñan ahí. Atrasada se dice «toca desde hace 3 días», sin tono de reproche.
- **Datos:** nueva lista `casa` en el estado (se sincroniza con el resto). No se sube la versión del almacén: `normalizar` completa `agenda` y `casa` en lo guardado antes, en lo recibido de la nube y al rebasar.
- **Límites:** **no hay aviso fuera de la app** (ni notificación ni evento en el calendario): se ve al abrirla. Las recurrencias no entran en el `.ics` porque «cada N días desde la última vez» se reprograma al hacerla y una repetición fija del calendario se descuadraría. No hay recurrencias por fecha del calendario («abril y octubre» para el cambio de ropa) ni por temporada. No se avisa a otro cuando la tarea se hace.
- **Siguiente:** avisos fuera de la app (calendario suscrito o notificaciones), recurrencias por fecha, y usar el motor de reparto real.

## D-079 — Los gatos y la comida del mediodía

- **Estado:** aceptada (2026-11-02). Petición de Diego: la casa tiene 2 gatos (areneros, arena, comida…) y algunos días hay que pensar también la comida, no solo la cena, y verlo en el calendario.
- **Gatos:** una **plantilla aparte** en «Casa» («🐱 Añadir lo de los gatos»; no se mezcla con la de la casa y se añade solo si se pulsa): limpiar los areneros (cada día), lavar comederos y bebederos (cada 3 días), cambiar toda la arena (cada 14), cepillar (cada 7), comprar arena (cada 30), comprar comida (cada 14), desparasitar (cada 90) y revisión y vacunas del veterinario (cada año). Las dos de comprar llevan un botón **«🛒 A la lista»** que apunta «Arena para gatos» / «Comida de los gatos» en la lista de la compra. Las frecuencias son orientativas y se editan quitando y volviendo a añadir; **no sé los nombres de los gatos ni si alguno tiene necesidades especiales** (pienso concreto, medicación).
- **Comidas:** en la pantalla **Calendario**, el panel de cada día tiene «☀️ Comida»: se apunta un **texto libre** («Paella en casa de los abuelos»), **«❓ Por decidir»** (para marcar que ese día falta pensarla) o **un plato del catálogo**, que además mete sus ingredientes en la lista de la compra. El día lleva ☀️ en el calendario, la portada enseña «Comida: …» el propio día y el archivo `.ics` las incluye como eventos de todo el día.
- **Cómo:** lista nueva `almuerzos` en el estado (se sincroniza con el resto; `normalizar` la completa en lo guardado antes). Un día solo admite apuntes desde hoy y hasta dentro de 60 días, como las cenas.
- **Límites:** el motor del menú **no propone ni equilibra** las comidas: es una elección manual (la semana equilibrada y las reglas del cole siguen siendo solo de la cena). No se pueden apuntar días pasados. La raciones se cuentan como en la cena (todos los activos). Los avisos de «hoy toca» de los gatos solo se ven al abrir la app (ver D-078).

## D-080 — Plan para reorganizar y simplificar la app (propuesta, sin decidir)

- **Estado:** propuesta (2026-11-02). Diego pidió «llamar a Marie Kondo» y una visión distinta para móvil y para escritorio. Se ha escrito primero el plan, sin tocar código: `docs/plan-reorganizacion.md`.
- **Idea:** 4 pilares (Hoy, Comer, Casa, Fechas) y «Más», con pestañas dentro de cada uno; portada de máximo 5 bloques con una acción principal; escritorio con composiciones propias, no una versión estirada del móvil. Cuatro fases, la primera sin cambiar datos ni URL.
- **Pendiente de Diego y Ana:** si se fusiona Reparto y Tareas en Casa, cuánto se hace antes del 7 de noviembre (recomendado: solo la fase 1), qué se tira, el botón «＋ Apuntar» único y para qué se usará el escritorio.

## D-081 — Reorganización, fase 1: cuatro pilares, pestañas y portada corta

- **Estado:** hecha (2026-11-02), solo la fase 1 del plan (`docs/plan-reorganizacion.md`), como pidió Diego antes del cumple de Ana. Sin cambios de datos ni de URL.
- **Navegación:** la barra inferior (móvil) y la lateral (escritorio) pasan de 5 pantallas sueltas a **5 entradas: Hoy, Comer, Casa, Fechas y Más**. Dentro de cada pilar hay una **fila de pestañas** (Comer: Cena, Cole, Compra, Despensa, Platos, Llego tarde; Casa: Recurrente, Por persona, Reparto; Fechas: Próximas, Calendario, Cumples; Más: Cuenta, Enviar). Las 15 pantallas quedan a **dos toques** (hay un E2E que recorre las 14 de los pilares).
- **Portada:** se quitan los accesos que ya son pilares (Zafarrancho, Casa, Fechas, Cumples). Queda la cena y la comida de hoy con «Ver el menú» y «Hoy llego tarde», lo que toca en casa, un enlace a lo que falta por comprar, el cole, los avisos de regalo y la felicitación. En Menú se quitan los botones Platos, Emergencia y Cole, que duplicaban las pestañas.
- **El contador de la compra** sale en «Comer» cuando se está en otro pilar y en la pestaña «Compra» cuando se está dentro, para que no salga dos veces.
- **Se desvía del plan:** en escritorio la barra lateral solo lleva los pilares (no los apartados desplegados) porque las pestañas de arriba ya los muestran; el enlace «Preparar un regalo» de Diego sigue en la portada hasta la fase 2; el botón «＋ Apuntar» único no se ha hecho (queda el «Añadir rápido» de la compra y la caja de «Próximas»).
- **Sin hacer (fases 2 a 4):** fusionar Casa/Tareas/Reparto y Fechas/Calendario/Cumples, vistas propias de escritorio, repaso final. **Sin probar en un iPhone real.**

## D-082 — Compartir por WhatsApp o como sea, desde cada pantalla

- **Estado:** aceptada (2026-11-02). Petición de Diego: es muy importante poder compartir menús de cenas y comidas, listas de la compra, etc., por WhatsApp o como sea.
- **Qué faltaba:** «Enviar» ya tenía WhatsApp, «Compartir…» y copiar, pero (1) el mensaje del menú **no incluía la comida del mediodía**, (2) no se podían compartir **las fechas** ni **lo que toca en casa**, y (3) tras la reorganización (D-081) «Enviar» quedó en «Más», lejos de donde se necesita.
- **Qué hay ahora:** tres formas de sacar un texto, con un mismo componente (`BotonesCompartir`): **Enviar por WhatsApp** (abre el chat con el mensaje escrito y eliges a quién), **Compartir…** (el menú de compartir del móvil: Keep, correo, Telegram, notas…; solo sale si el navegador lo ofrece) y **Copiar**. Salen **en cada pantalla**, donde se necesitan: Menú, Compra, Próximas fechas y Casa; y todas juntas en «Más → Enviar», que además tiene el archivo `.ics`.
- **Contenido de los mensajes:** el **menú** pone «☀️ Comida: …» y «🍴 Cena: …» cuando hay las dos; la **compra** va agrupada por sección del súper con casillas «☐»; las **fechas** salen con día, hora y «en N días» (45 días, máximo 25); **lo que toca en casa** va agrupado por quién lo lleva («Diego», «Ana», «Los dos») y a una semana vista, sin tono de reproche.
- **Límites:** WhatsApp abre el selector de contacto del móvil: **no se puede elegir de antemano un grupo** ni enviar solo, y el texto se recorta a ~3.800 caracteres en un mensaje largo. «Compartir…» no sale en todos los navegadores (por ejemplo, en escritorio suele faltar; ahí queda WhatsApp Web y Copiar). Lo compartido es un **texto en el momento de enviarlo**: no se actualiza solo. **No probado en un iPhone real** (en iOS, `navigator.share` y `wa.me` suelen funcionar, pero no lo he visto).
- **No incluye:** enviar a otro del hogar desde dentro de la app (por ejemplo, una notificación a Ana); el menú de un solo día; compartir lo apuntado por persona (Zafarrancho).

## D-083 — Avisos fuera de la app: calendario suscrito con alarmas

- **Estado:** hecha (2026-11-02); **sin probar en un móvil real ni con Google Calendar** (ver límites). Petición de Diego: «los avisos fuera de la app».
- **Por qué esta vía:** el calendario del móvil se **suscribe a un enlace** y avisa solo, con la app cerrada, sin instalar nada, también en el iPhone de Ana. Las notificaciones push (la otra opción) exigen la app instalada en la pantalla de inicio, claves, un servicio que las envíe y más piezas; quedan para más adelante.
- **Qué avisa** (calendario «Menús Semanales»): las **tareas de la casa** (cada una en el día que toca, o hoy si va atrasada, con alarma a las 9:00), las **citas apuntadas** (una hora antes si tienen hora), los **cumpleaños** (cada año, a las 9:00) y los **avisos para pensar y comprar el regalo** (30 y 14 días antes), además de las cenas, las comidas y las fechas señaladas. Cada persona usa **su** enlace (`?para=ana`): lleva sus tareas y las de «los dos».
- **El regalo no se destripa:** los avisos del regalo van solo a un adulto que **no cumple**; a Ana no le llega «Pensar el regalo de Ana». Si no se sabe quién pide el calendario, no van. **Arreglo de paso:** el archivo `.ics` de «Enviar» también incluía esos avisos para cualquiera; ahora usa la misma regla (perfil abierto).
- **Cómo:** (1) tabla `hogar_calendario` con un **token secreto por hogar** (64 hex, 244 bits) sin acceso directo para nadie (política de «nadie»); (2) `enlace_calendario(hogar, renovar)`: un miembro lo lee o lo **renueva** (el anterior deja de valer); (3) `estado_para_calendario(token)`, que ejecuta el rol `anon` y devuelve **un resumen mínimo**: personas (id, nombre, tipo), cenas (fecha y nombre), comidas, eventos, apuntes, tareas de casa y cumpleaños (quién y cuándo). **Nunca** ideas, gustos ni estado de regalos, compra, despensa, ingredientes ni cole. El servidor (`/api/calendario/<token>.ics`) valida ese resumen con zod y genera el `.ics`. Los eventos llevan **identificador estable** (el calendario actualiza en vez de duplicar al mover una tarea). Migración `20261102120000_calendario_suscrito.sql`, aplicada y registrada; 30 comprobaciones SQL nuevas, con una mutación comprobada (si el resumen filtrara ideas, el test falla).
- **Seguridad:** el enlace es una **credencial**: quien lo tenga ve el plan de la casa. La pantalla de activación («Más → Enviar») lo avisa y deja **renovarlo**. El token vive solo en la base de datos y en la URL; no en el repositorio. El servidor devuelve el **mismo 404** para token inexistente, mal formado o sin plan; no cuenta detalles si Supabase falla (502); `noindex`, `no-referrer`, límite de 60 peticiones por minuto y dirección (por instancia, mejor esfuerzo). `?para=` no es secreto y no da más acceso: **quien tenga el enlace puede pedirlo «como otro»** (por ejemplo, ver los avisos del regalo de Ana poniendo `para=diego`). Es un riesgo aceptado dentro de la familia.
- **Avisos de Supabase (aceptados):** una función ejecutable por `anon` con `SECURITY DEFINER` (`estado_para_calendario`, deliberada) y 18 funciones ejecutables por `authenticated` (16 anteriores + `enlace_calendario` + `estado_para_calendario`). La tabla sin políticas se resolvió con una política explícita de «nadie».
- **Límites, sin disimular:**
  - **No lo he probado en ningún móvil.** El entorno donde trabajo no llega a `supabase.co`; el servidor responde bien a tokens mal formados (404) y se comprobó la función como `anon` dentro de la base de datos (token inventado: null; `anon` no puede pedir enlaces ni leer la tabla), pero **la llamada HTTP real y la suscripción en un iPhone y en Google Calendar no están vistas.**
  - **El móvil decide cada cuánto lo pide.** El archivo sugiere cada hora, pero iOS y Google lo hacen cuando quieren (a veces horas). Una tarea marcada hecha en la app puede seguir apareciendo un rato.
  - **Las alarmas:** Apple Calendar las mantiene salvo que en Ajustes esté marcado «Eliminar alertas» en el calendario suscrito; **Google Calendar ignora las alarmas del archivo** y usa las suyas por defecto.
  - **El plan debe estar en la nube:** solo funciona con la cuenta conectada y el hogar guardado; una tarea que solo existe en un móvil sin sincronizar no sale.
  - Una tarea diaria («limpiar los areneros») es **un solo evento** que se mueve; no genera uno por día.
  - **No son notificaciones push** y no avisan «a otro»: cada móvil se suscribe a lo suyo.

## D-084 — La app dice cuándo la nube está mal configurada (y por qué Supabase estaba vacío)

- **Qué se encontró (2026-11-02):** las 14 tablas de Supabase tenían **0 filas y 0 usuarios** (ni anónimos ni con correo), y los registros del proyecto no mostraban **ninguna petición de la app** (solo comprobaciones internas de Supabase): la app desplegada **nunca ha hablado con Supabase**. Todo lo que se ha hecho en la app vive en el almacenamiento del navegador de cada móvil.
- **Causa probable (no confirmada, no veo Railway):** las variables de Supabase en Railway no tienen la forma esperada (p. ej. la clave antigua `eyJ…` en vez de `sb_publishable_…`). Con eso la app **se caía** (D-077) y, tras arreglarlo, **seguía enseñando «Entrar»** y, al pulsarlo, «la sincronización aún no está activada»: engañoso. El arreglo de D-077 evitó la caída pero **escondió el problema**.
- **Arreglo:** `diagnosticarEnvPublico` distingue «sin variables», «URL inválida» y «clave inválida» (sin devolver nunca los valores). La barra superior pasa a decir **«⚠️ Nube sin configurar bien»** y «Cuenta» explica qué variable corregir en Railway. Sin variables, dice que los datos están solo en el dispositivo y **se pierden si se borra el navegador**.
- **Aviso importante:** aunque la nube funcione, **solo se rellenan `hogar`, `miembro`, `invitacion`, `hogar_estado` (y `hogar_calendario`)**. `persona`, `plato`, `ingrediente`, `despensa_item`, `lista_compra_articulo`, `comida_planificada`… **no se usan**: la app guarda todo como un único documento por hogar (D-063), no en tablas relacionales. Llevarlo a tablas es una tarea pendiente aparte.

## D-085 — Todo el dato principal en tablas y sin datos «a mano» (propuesta, sin decidir)

- **Estado:** propuesta (2026-11-02). Diego pidió pasar todo el dato principal a tablas y que **todo dato visible venga de la base de datos o de una sugerencia de la IA**, sin datos hardcodeados. Se ha escrito primero el plan, sin tocar código: `docs/plan-datos-en-tablas.md`.
- **Punto de partida:** la app guarda todo en un documento por hogar (D-063) o en el navegador; las tablas relacionales existen y están vacías. Datos «de fábrica» en el código: 54 platos, 51 ingredientes, 22 tareas, 6 cargas, el menú del cole, las plantillas de casa y gatos, las ideas de regalo y los datos de ejemplo; además los datos personales de la familia están en el repositorio.
- **Implicaciones que hay que aceptar:** sin «modo prueba» (sin cuenta y hogar no hay nada que ver); la app **necesita conexión** (escribir sin conexión queda para después); los datos de Diego y Ana, hoy en el navegador, hay que **salvarlos primero** (fase 0) y luego importarlos una sola vez; los tests de extremo a extremo necesitan una base de datos.
- **Recomendación:** no empezar antes del cumple de Ana (7 de noviembre) salvo la **fase 0** (corregir Railway y que la sincronización actual guarde el documento en Supabase), que es lo único que protege los datos de la familia ahora.
- **Pendiente de Diego:** las 7 decisiones de la sección 9 del plan.

## D-086 — Fase 0: copias de seguridad y diagnóstico del acceso a la nube

- **Estado:** hecha (2026-11-02) la parte de código; **falta que Diego corrija Railway y Supabase** (guía en `docs/fase-0-nube.md`). Es la primera fase de D-085.
- **Riesgo que se encontró en el código:** al conectarse a un hogar que ya tiene datos, **el móvil adopta los de la nube y descarta los suyos** (y sus cambios pendientes) sin avisar. Con dos móviles con datos distintos, el segundo en llegar pierde lo suyo.
- **Qué hay ahora:** (1) **«Copia de seguridad»** en «Cuenta»: descarga lo del móvil a un archivo (`respaldo-menus-semanales-AAAA-MM-DD.json`) y lo restaura desde un archivo, con vista previa y confirmación; **restaurar está bloqueado con la cuenta conectada** porque sobrescribiría lo de la familia. (2) **Copia automática** justo antes de que la nube sustituya lo de un móvil, solo si es distinto (hasta 3), descargable desde la misma pantalla. (3) **«Estado del acceso»**: antes de entrar, lee los ajustes públicos de Supabase y dice si «Entrar sin correo», «Entrar con correo» y «Crear cuentas» están activados.
- **Límites:** las copias son **archivos del usuario** (contienen los datos de la familia: guardarlos con cuidado). El diagnóstico del acceso **no está comprobado contra el Supabase real** (el entorno donde trabajo no llega a `supabase.co`): si Supabase no devuelve esos campos, la pantalla dice «no se sabe». La copia automática se guarda en el propio navegador: si se borra el navegador, se pierde con lo demás, así que **la descarga manual es la que vale**. Esto **no sube nada** a la nube: lo hace «Crear hogar».

## D-087 — Datos en tablas, fases 1 y 2: esquema completo y catálogos de fábrica

- **Estado:** hecha (2026-11-02). Las dos fases son **aditivas**: la app que usa Ana **no cambia** y sigue leyendo y escribiendo el documento (D-063). Es la primera parte del plan D-085, adelantada porque Diego lo pidió («no me gusta que esté todo en un json»).
- **Fase 1, esquema** (`20261102140000_esquema_hogar_completo.sql`): tablas `cumple`, `cumple_regalo`, `cumple_idea`, `apunte`, `fecha_senalada`, `tarea_casa`, `tarea_persona`, `tarea_persona_hecha`, `almuerzo`, `hogar_ajuste`, `ingrediente_excluido`, la columna `dia_hogar.saltado` y cuatro catálogos globales (`catalogo_categoria_super`, `catalogo_regla_categoria`, `catalogo_plantilla_casa`, `catalogo_idea_regalo`). RLS forzada, nada para `anon`, catálogos de solo lectura, claves foráneas compuestas (una tarea no puede asignarse a una persona de otro hogar) e índices.
- **El secreto del regalo, ahora en la base de datos:** `cumple_regalo` y `cumple_idea` no se pueden leer ni escribir **por quien cumple** (la persona del hogar vinculada a su cuenta, `persona.user_id`). Hasta ahora era solo una regla de la pantalla. **Aún no protege nada** hasta que cada persona tenga su cuenta vinculada y los regalos se guarden en estas tablas.
- **Fase 2, catálogos** (`20261102150000_catalogos_de_fabrica.sql`, **generada a partir de las constantes del código**, sin reescribir a mano): 14 secciones del súper y 13 reglas de clasificación (las expresiones regulares de JavaScript pasadas a Postgres: `\b` → `\y`; un test comprueba que clasifican **igual** que el código), 20 plantillas (12 de casa y 8 de gatos), 40 ideas de regalo, 51 ingredientes y 54 platos con sus 130 ingredientes. Los platos son «publicados» en el catálogo compartido; cada hogar los adopta (`adoptar_plato_compartido`) y los edita sin tocar el original. **Sin datos personales de ninguna familia.** Idempotente.
- **Aplicadas** al proyecto de Supabase y registradas; avisos de seguridad revisados (sin avisos nuevos) y de rendimiento (dos índices añadidos). 55 comprobaciones SQL nuevas, con mutaciones comprobadas (quitar el secreto del regalo y dejar el `\b` de JavaScript hacen fallar los tests). `catalogo_platos.test.sql` parte ahora de un catálogo vacío dentro de su transacción.
- **Límites:** (1) **la app aún no lee estas tablas**: ver los datos de la familia en tablas exige las fases 3 a 5. (2) Los platos, ingredientes y sus cantidades son **estimados** (`por-revisar`), como ya eran en el código. (3) Los datos personales de la familia (nombres, cumples, menú del cole) **siguen en el código y en el documento**: salen en las fases 3 a 5. (4) Los tipos de TypeScript de las tablas nuevas (`database.types.ts`) **no se han regenerado**: se hará al escribir los repositorios. (5) El catálogo de «habituales» de la compra (la lista histórica de la familia) y el menú del cole no se han pasado: son datos de la familia.

## D-088 — Datos en tablas, fase 3 (primera parte): leer y escribir el hogar desde tablas, y un agujero del secreto cerrado

- **Estado:** **aplicadas y comprobadas en el proyecto de Supabase** (2026-11-02). Se aplicaron a mano desde el editor SQL, porque el servidor de Supabase pide confirmar las órdenes de borrado y `REVOKE` y la ventana de 60 segundos se agotó dos veces. Comprobado después: dos funciones `SECURITY INVOKER`, tres disparadores, `persona.user_id` no escribible por `authenticated` (ni `UPDATE` ni `INSERT`), `anon` sin acceso, avisos de seguridad sin nada nuevo y **una prueba real con la RLS de producción** (escribir y leer persona, tarea de casa, apunte y horizonte dentro de un bloque que se deshace solo; las tablas quedaron a 0). Diego pidió (2026-11-02) dejar de lado el cumpleaños de Ana y hacer la migración a tablas de verdad, sin atajos.
- **Diseño elegido** (condicionado por lo que se puede probar: aquí no hay API de Postgres ni se llega a `supabase.co`, así que la lógica pesada va **dentro de Postgres**, donde los tests de SQL la prueban de verdad, y en TypeScript queda una capa fina):
  - `leer_hogar_tablas(hogar)`: **una llamada**, un JSON en camelCase con personas, horizonte, días («llego tarde», «no cenamos»), cumpleaños (con regalo e ideas), apuntes, fechas señaladas, tareas de casa y tareas por persona.
  - `aplicar_cambios_tablas(hogar, cambios)`: aplica de una vez, **en una transacción** (todo o nada), altas, cambios y bajas. «Regalo» ausente o nulo = no tocar; «ideas» y «hechas» presentes = la lista completa.
  - Ambas son **`SECURITY INVOKER`**: mandan las políticas RLS de cada tabla. A quien cumple le llega `regalo: null` y sus intentos de escribir en su regalo fallan.
  - La app calculará las **diferencias** entre el estado anterior y el nuevo (por identificador) y mandará solo eso, en lugar de mapear cada una de las ~80 acciones a SQL. Es el siguiente paso.
- **Agujero encontrado y cerrado (D-088, 3 piezas):** el secreto del regalo de D-087 dependía de dos vínculos que **cualquier miembro podía cambiar**: `persona.user_id` (qué cuenta es qué persona) y `cumple.persona_id`. Quien cumple podía desvincularse y dejar de ser «quien cumple» para la base de datos, y entonces ver y editar su propio regalo. El test que escribí para esta capa lo encontró. Ahora: (1) `persona.user_id` **no se puede escribir directamente** (privilegios por columna; solo lo hará una función de confianza de vincular); (2) quien cumple **no puede reasignar ni borrar su cumpleaños**; (3) nadie puede **borrar la persona vinculada a su propia cuenta** (al borrarla, el vínculo se soltaría en cascada y la base de datos ya no podría saber que era quien cumplía). Un test falla si se quita cualquiera.
- **Límites:** (1) el secreto **sigue sin proteger nada en la práctica** hasta que cada persona tenga su cuenta vinculada (no existe aún la función de vincular ni la pantalla de personas) y los regalos se guarden en las tablas. (2) Un miembro que **no** es quien cumple sí puede cambiar a quién corresponde un cumpleaños ajeno (modelo de confianza familiar). (3) Un upsert con el identificador de una fila de **otro** hogar no la modifica ni falla: se ignora (con identificadores aleatorios es teórico). (4) Nada de esto lo usa todavía la app.
- **Pendiente de la fase 3:** aplicar las migraciones, pantalla de personas y asistente de hogar nuevo, identificadores UUID en las acciones, cálculo de diferencias, motor de sincronización por tablas con actualización en directo, y migración de lo que hay en el documento de Diego.

## D-089 — Identificadores UUID en las acciones que crean datos

- **Estado:** hecha (2026-11-02). No cambia nada de lo que ve la familia ni el formato guardado: los datos antiguos conservan sus ids (`c-3`, `a-5-0`…).
- **Problema:** los ids de lo que se crea salían de un contador (`siguienteId`) que vive dentro del documento. Con tablas, dos móviles que crean algo a la vez usarían el mismo número, y repetir una acción (reintento de red) duplicaría filas.
- **Qué se hace:** quien despacha una acción que crea datos le pone un `idBase` (UUID aleatorio, en `ProveedorHogar.despachar` mediante `conIdBase`). El reductor, que sigue siendo puro, deriva de él el id de cada fila con **UUID v5** (`src/dominio/identificadores.ts`, SHA-1 propio y verificado con los vectores de la RFC 9562): mismo `idBase` y misma clave dan siempre el mismo id. Cubre cumpleaños (también al importar en bloque), apuntes, tareas por persona, tareas de casa (también las plantillas) y comida del mediodía.
- **Sin `idBase`** (tests, datos antiguos) se usa el contador de siempre, así que nada existente se rompe.
- **Datos antiguos:** `idDeLegado(hogar, idAntiguo)` da un UUID estable para cada id antiguo, para la importación única a tablas (repetirla no duplica).
- **Límites:** las acciones de platos, ingredientes, compra, despensa y reparto aún usan el contador; se cambiarán cuando esos agregados pasen a tablas.
- **Siguiente:** cálculo de diferencias entre estados (`diferencias`) y su traducción a `aplicar_cambios_tablas`.

## D-090 — Puente entre el estado y las tablas: cálculo de diferencias y lectura

- **Estado:** hecho y probado con tests unitarios (`src/aplicacion/tablas.ts`, 16 tests). **Aún no lo usa nada:** la app sigue guardando el documento. Es la pieza pura que usará el motor de sincronización por tablas.
- **`diferencias(antes, después, hogar)`:** compara por identificador y devuelve solo lo que hay que escribir en `aplicar_cambios_tablas` (altas/cambios y bajas por agregado), o `null` si el cambio no toca estas tablas (compra, despensa…). Cubre personas, horizonte, días («llego tarde» y «no cenamos»), cumpleaños, apuntes, fechas señaladas, tareas de la casa y tareas por persona.
- **Secreto del regalo:** el regalo y las ideas de un cumple solo se mandan **si cambiaron**. Así, cambiar el nombre de un cumple no reescribe un regalo que quien cumple no puede ni ver ni escribir. Lo mismo con los días hechos de una tarea.
- **Ids antiguos:** `aUuid(hogar, id)` respeta los UUID y convierte los ids antiguos (`c-3`, `diego`) en un UUID estable por hogar, también en las referencias (responsable, persona de un cumple o tarea). Las ideas de un cumple, que en la app son solo texto, reciben un id derivado del cumple y del texto.
- **Lectura:** `leerTablas` valida con zod el JSON de `leer_hogar_tablas` y `aplicarLecturaDeTablas` lo vuelca en el estado sin tocar platos, despensa ni compra. A quien cumple el regalo le llega nulo: queda «sin pensar» y sin ideas.
- **Límites:** `interesados` de un cumple (no usado en la interfaz) no se guarda en tablas. La prueba de ida y vuelta es contra el formato, no contra Postgres: la comprobación real con la base de datos llegará con el motor de sincronización.
- **Siguiente:** pantalla de personas (hoy no se pueden añadir ni editar), vincular persona y cuenta, y el motor de sincronización por tablas con actualización en directo.

## D-091 — Vincular cada persona con su cuenta mediante código de invitación

- **Estado:** migración `20261102180000_vincular_personas.sql` escrita y probada en local (`vincular_personas.test.sql`, con mutación comprobada). **Aplicada y comprobada en Supabase** (2026-11-02, a mano desde el editor SQL: las 3 funciones, la columna, privilegios solo para `authenticated`, `mi_persona` con `SECURITY INVOKER`, registrada en el historial). Avisos de seguridad: 2 nuevos de la misma clase aceptada (`SECURITY DEFINER` para usuarios con sesión; ahora 20), nada más.
- **Decisión de Diego:** código de invitación para cada persona.
- **Cómo:** `crear_invitacion_persona(hogar, persona)` (solo administrador; un código vivo por persona; un solo uso; caduca a los 7 días); `unirse_a_hogar` vincula la cuenta a esa persona si el código era para una; `vincular_persona_propia` para que el administrador elija quién es él; `mi_persona(hogar)` dice cuál es la mía. Una cuenta, una persona por hogar.
- **Límite:** quien tenga el código (o un administrador) podría vincularse a otra persona antes que ella: es confianza dentro del hogar.
- **Siguiente:** pantalla de personas que use estas funciones e importación única del documento a tablas (con vista previa y copia de seguridad).

## D-092 — Pantalla «Familia»: personas y vínculo con la cuenta

- **Estado:** hecha (2026-11-02). `/personas`, en el pilar «Más» (pestaña «Familia»).
- **Qué permite:** añadir personas, cambiar nombre, adulto o niño y ración (pequeña a grande), y dejar de contar o volver a contar a alguien (se desactiva, no se borra: se esconde antes de borrarse). Siempre queda al menos una persona que cuenta. Las personas nuevas nacen con id UUID (D-089).
- **Vincular cuentas (con la nube conectada):** «Soy X» (el administrador elige quién es él) y «Código para X» (código de un solo uso que se envía por WhatsApp o se copia; quien lo canjea queda vinculado a esa persona, D-091). La pantalla indica quién tiene ya cuenta.
- **Cómo encaja con el documento:** el estado de la app sigue siendo el documento (aún no hay motor por tablas). Las personas **se llevan a la tabla `persona` al abrir la pantalla y al vincular** (con `aplicar_cambios_tablas`, idempotente, ids antiguos convertidos a UUID estable). Es el primer agregado en tablas; el vínculo del secreto del regalo ya tiene dónde apoyarse.
- **Límites:** (1) las personas se suben a la tabla solo desde esta pantalla, no en cada cambio: el motor de sincronización por tablas lo generalizará. (2) No se pueden borrar personas ni desvincular cuentas desde la app (a propósito: desvincular podría destapar un regalo). (3) La pantalla no se ha probado contra el Supabase real desde un navegador, solo las funciones SQL y los tests de pantalla con la nube desconectada.
- **Pruebas:** 3 tests de reductor nuevos, E2E de 10 tamaños con accesibilidad y un flujo de añadir/desactivar (409 E2E en total en verde).

## D-093 — Plato nuevo al vuelo: añadirlo (o no) a los platos del hogar

- **Estado:** hecho (2026-11-02). Petición de Diego: al poner en una comida o cena un plato que no está en los platos del hogar, poder elegir si se añade o no.
- **Comida del mediodía** (texto libre): si el texto coincide con un plato de la casa (sin tildes ni mayúsculas) se apunta ese plato, para que entre en la compra (antes quedaba como texto). Si no coincide, pregunta: «Añadir a mis platos y apuntarlo», «Solo apuntarlo esta vez» (para planes como «en casa de los abuelos») o cancelar.
- **Cena** («Ver todos los platos»): si lo buscado no existe, ofrece crearlo y elegirlo/añadirlo a la cena. Una cena no admite texto libre (necesita un plato para calcular la compra), así que ahí la alternativa a añadir es no crearlo.
- **Qué se guarda:** acción `plato/rapido` (nombre, tipo de plato, id UUID derivado de `idBase`, D-089). Nace **sin ingredientes y sin proponerse solo** (`noProponer`), con 20 minutos de trabajo como valor provisional; se puede elegir a mano. En «Platos» sale marcado «Faltan los ingredientes: sin ellos no entra en la compra»; al guardarle ingredientes desde el editor pasa a proponerse.
- **Límites:** un plato así no aporta nada a la lista de la compra hasta completar sus ingredientes (a propósito: no se inventan). Los 20 minutos son un valor por defecto, no un dato real.
- **Pruebas:** 3 tests de reductor, 1 E2E nuevo con accesibilidad y 2 E2E existentes adaptados (410 E2E en verde).

## D-094 — Llevar los datos del documento a tablas (importación única)

- **Estado:** hecha (2026-11-02), en «Cuenta» (solo con la nube conectada). **No probada contra el Supabase real desde la app**: sí las funciones SQL (D-088) y la parte pura (tests).
- **Qué hace:** «Ver qué se llevará» enseña, por tipo, cuántas filas tiene la app y cuántas hay ya en tablas. «Llevar a tablas ahora» (1) guarda una copia en este móvil —si no puede, no sigue—, (2) sube las personas, (3) manda todo lo demás en una sola operación (todo o nada) y (4) vuelve a leer las tablas para comprobar que hay al menos lo enviado.
- **Qué lleva:** personas, cumpleaños con su regalo e ideas, apuntes, fechas señaladas, tareas de casa y por persona, días de «llego tarde» y «no cenamos», horizonte. **No lleva aún** platos, ingredientes, despensa, compra, comidas planificadas, reparto, menú del cole, valoraciones ni comidas del mediodía (esos agregados vienen después).
- **Seguridad de la operación:** no borra nada, ni en el documento ni en las tablas; usa los mismos ids estables (D-089/D-090), así que repetirla no duplica. Si quien importa es una persona con cumpleaños, su regalo y sus ideas se dejan fuera (no puede escribirlos: secreto, D-087) y se conservan los que haya.
- **Límite importante:** el documento sigue siendo la fuente que usa la app. Las tablas son, por ahora, la copia ordenada: lo que se cambie después en la app **no** llega a las tablas hasta que exista el motor de sincronización por tablas (siguiente paso). Hay que repetir la importación o esperar a ese motor.

## D-095 — Motor de sincronización por tablas (primeros agregados)

- **Estado:** código hecho y probado con una base de datos simulada (7 tests del motor + las de mezcla, 497 unitarios y 410 E2E en verde, mutación comprobada en la mezcla). **No probado aún contra el Supabase real desde la app**: hace falta aplicar la migración `20261102190000_tablas_en_directo.sql` (Realtime) y llevar los datos a tablas desde «Cuenta».
- **Qué es:** personas, cumpleaños con regalo e ideas, apuntes, fechas señaladas, tareas de casa y por persona, días de «llego tarde»/«no cenamos» y horizonte pasan a **mandar desde tablas**. Todo lo demás sigue en el documento (D-063) hasta migrar su agregado.
- **Cómo funciona** (`src/aplicacion/sincronizacion-tablas.ts`): sin cola de acciones. Guarda `base` (lo que sabe que hay en tablas); cada cambio local se compara por identificador con esa base y se envía **solo la diferencia** a `aplicar_cambios_tablas` (D-088/D-090). Si falla la red, la siguiente vez se recalcula: no se pierde nada. Los cambios de otros móviles llegan por Realtime (o al volver a la app), se **mezclan fila a fila** con los propios aún sin enviar y se reenvían los pendientes.
- **Cuándo se enciende:** al conectar, si las tablas ya tienen personas. Con las tablas vacías sigue mandando el documento (sin sorpresas para quien no ha importado). Tras «Llevar a tablas ahora» se enciende en el momento.
- **Convivencia con el documento:** lo que llega del documento no pisa los campos de tablas (`conservarCamposDeTablas`). Todos los ids de persona (y quien los nombra: reparto, turnos, valoraciones, cumples, casa, tareas) se pasan a UUID de forma estable en cada móvil (`migrarIdsDePersonas`). El documento sigue guardando una copia de esos campos.
- **Secreto del regalo:** quien cumple años recibe el regalo vacío y, como no cambia, nunca lo reenvía (si edita el nombre de su cumple, no se manda `regalo`).
- **Al adoptar las tablas** se guarda una copia automática en el móvil si los datos difieren.
- **Migración Realtime** (`20261102190000`): añade las 11 tablas a la publicación y `replica identity full` para que lleguen también los borrados.
- **Límites:** (1) sin la migración de Realtime no hay avisos en directo; sí se actualiza al volver a la app y en cada cambio propio. (2) Si dos móviles editan **la misma fila** a la vez, gana el último en enviar (por fila, no por campo). (3) El indicador de estado de la cuenta sigue siendo el del documento; los fallos del motor por tablas hoy no se enseñan en pantalla. (4) Faltan por migrar platos, ingredientes, despensa, compra, comidas, reparto, cole, valoraciones y comidas del mediodía.

## D-096 — Nota en cada cena y alta rápida de platos

- **Estado:** hecho (2026-11-02).
- **Nota de la cena** (petición de Diego: «pollo a la plancha… o igual lomo, depende»): un campo en cada día del menú y del calendario; se guarda al salir del campo o con Intro (máximo 140 letras) y sale en el mensaje del menú que se comparte (`📝 …`). Estado nuevo `notasMenu` (fecha → texto), completado al cargar datos antiguos.
- **Alta rápida:** campo siempre a la vista bajo cada día sin cena (y al «Añadir otro plato»): al escribir salen los platos del hogar que coinciden para elegir con un toque; si no existe, aparece «Crear «X» y elegirlo» con su tipo de plato. Sin abrir «Ver todos» ni pulsar buscar (que sigue disponible). El plato se crea como en D-093 (sin ingredientes, se completan en «Platos»).
- **Límite:** las notas viven por ahora en el documento (`hogar_estado`), no en una tabla propia; irán a tabla con el resto de la planificación de comidas.

## D-097 — Lista de la compra compacta y editable, con vistas (primera tanda, sin IA)

- **Estado:** hecha (2026-11-02). Petición de Diego: «la lista de la compra más útil de la historia»; filas pequeñas «más parecido a Keep», editar cantidades y texto, vistas distintas. La IA queda para la segunda tanda (falta decidir proveedor y tope de gasto).
- **Filas de una línea** (casilla, nombre, cantidad; 44 px de alto, no tarjetas), una sola tarjeta con títulos de sección finos. Cabecera compactada (título con «n de N», barra fina, selector de vista en una fila; «Enviar/Copiar» pasan al final). Con el cuerpo cabe el doble de artículos en un móvil.
- **Editar en el sitio:** tocar el nombre abre la edición. Lo apuntado a mano: nombre y cantidad (texto libre: «2», «1 kg») y borrar. Lo calculado por el menú: cantidad con − / + (por pasos de 50 g/ml o 1 ud), «Restablecer» (muestra lo que calculó la app) y «No hace falta» (baja a «No hace falta (n)», con «Volver a poner»). El nombre de lo calculado no se edita (viene del plato). Al comprar se compra la cantidad editada. Estado nuevo `ajustesCompra`.
- **Apuntar con cantidad:** «huevos 12», «2 yogures», «500 g de pasta», «arroz 1 kg» separan nombre y cantidad (`separarCantidad`). Las cantidades salen también en el mensaje que se comparte.
- **Vistas** (se recuerda la última en el móvil): *Secciones* (en el orden del súper, una sola lista para lo calculado y lo manual), *Lista* (plana), *Por comida* (agrupada por el motivo: «Cena del jueves», «Stock mínimo», «Apuntado a mano») y *Tienda* (letra grande, solo marcar, sin editar ni añadir).
- **Límites:** (1) el orden de las secciones es el genérico del código, **no el recorrido real del Mercadona**: falta que Diego lo confirme. (2) Sin deslizar para borrar ni «deshacer» al borrar un apunte. (3) Las vistas «Por persona» y «Por tienda» y todo lo de IA (dictado inteligente, sugerencias, foto de ticket) quedan para la segunda tanda. (4) Las cantidades editadas y los apuntes siguen en el documento hasta migrar la compra a tablas.
- **Pruebas:** 8 tests unitarios nuevos y un E2E (filas compactas, edición, vistas, «no hace falta», accesibilidad); 412 E2E en verde.

## D-098 — IA en la lista de la compra: «Ordenar con IA» (primera función de IA)

- **Estado:** *(el proveedor pasó de Claude a Gemini en D-100; lo demás sigue igual)* código hecho y probado con simulaciones (3+6+4 tests nuevos, 520 unitarios y 412 E2E en verde, SQL con mutación comprobada). **No probada contra la API real de Claude ni contra el Supabase real**: aquí no hay clave de la IA y la función SQL aún no está aplicada. Hace falta `ANTHROPIC_API_KEY` en Railway y aplicar `20261102200000_uso_ia.sql`.
- **Decisiones que tomé yo por falta de respuesta (todas se cambian sin tocar código ni migraciones, salvo el tope):** (1) **proveedor:** Claude (Anthropic), con el SDK oficial. (2) **modelo:** `claude-opus-5-5` por defecto, cambiable con la variable `IA_MODELO` (p. ej. `claude-haiku-5-5`, muchísimo más barato, bastaría para esta tarea). Esfuerzo `low` y salida estructurada. (3) **tope de gasto:** 40 consultas al día por hogar, guardado en la base de datos (`ia_ajuste.limite_diario`, solo editable con SQL; ningún miembro puede subírselo). A unos 0,01 € por consulta con Opus 5.5 sería como máximo ~0,40 €/día; con Haiku, céntimos al mes.
- **Qué hace:** en la lista, «✨ Ordenar con IA» (solo con la nube conectada): se escribe o dicta a la carrera («lo de la paella, pañales talla 4, 2 yogures…») y la IA lo convierte en artículos con cantidad y sección del súper. **La persona revisa y elige qué añade** (casillas, todo marcado); la IA nunca toca la lista sola. Acción `manual/importar`.
- **Privacidad:** al servidor de IA solo van el texto escrito y los nombres de lo que ya está en la lista (para no repetirlos). **Nunca** personas, cumpleaños, regalos, ideas ni datos del hogar. El servidor no guarda ni registra el texto, y los errores del proveedor no se devuelven al navegador. La pantalla avisa de que el texto se envía a una IA. El texto del usuario se trata como datos (no como instrucciones) y la respuesta se valida con un esquema estricto antes de enseñarse.
- **Seguridad del endpoint** (`POST /api/ia/lista`): exige sesión y hogar; cuenta el uso en la base de datos antes de llamar (`usar_ia`, atómica: dos llamadas a la vez no se pasan del tope); 429 con mensaje claro al llegar al tope; 503 si no hay clave; cuerpo máximo 20 KB y texto máximo 1.500 letras.
- **Límites:** (1) sin comprobar contra la IA real: puede haber que ajustar las instrucciones al ver resultados reales. (2) Las consultas fallidas del proveedor también cuentan para el tope (prudencia de gasto). (3) La interfaz de la propuesta no se ha probado en navegador (solo existe con la nube conectada). (4) Falta: sugerencias («hace 12 días que no compráis leche»), foto del ticket, «por persona/tienda» y dictado propio. (5) El tope es por hogar y día (hora de Madrid), no por persona.

## D-099 — El mensaje del menú cuenta el cole y por qué se propone cada cena

- **Estado:** hecho (2026-11-02). Petición de Diego: al compartir el menú, añadir lo que comen cada día en el cole, el motivo de la cena propuesta y la nota («o lomo, que tenemos ya hecho en la nevera»).
- **Cómo queda cada día:** `🎒 Cole: <primero> + <segundo>` (con las palabras del menú del cole), `🍴 <cena>`, `💡 Como en el cole <comen/comieron/comerán> legumbres y pescado, propongo de cena <platos>` y `📝 <nota>`. El tiempo verbal depende de si el día ya pasó, es hoy o es futuro.
- **Sin inventar:** el motivo sale solo de los datos (el grupo del primero y segundo plato del cole) y solo aparece si hay cena elegida; los grupos «otro» no se mencionan. Sin texto del menú del cole, el día lleva los emojis de siempre junto al nombre.
- **Límite:** la frase es la misma para todas las cenas del día; no distingue qué plato concreto compensa qué. Un mensaje largo se recorta a 3.800 caracteres (límite de WhatsApp en enlaces).

## D-100 — La IA pasa a Google Gemini Flash

- **Estado:** hecho (2026-11-03) por decisión de Diego («mejor Google Gemini Flash»), sustituyendo a Claude (D-098). Quitado el SDK de Anthropic; la llamada es una petición REST a `generateContent` desde el servidor (`src/infraestructura/ia/lista.ts`).
- **Configuración:** `GEMINI_API_KEY` (solo servidor, Railway) y, opcional, `IA_MODELO` (por defecto `gemini-flash-latest`, el alias de Google para el Flash más reciente). La clave viaja en la cabecera `x-goog-api-key`, nunca en la URL. El resto no cambia: instrucciones y texto separados, temperatura baja, respuesta en JSON con esquema de categorías, validada otra vez con zod, depurada, tope diario por hogar en la base de datos y revisión humana antes de añadir.
- **Sin verificar (importante):** desde esta sesión no se puede consultar la documentación de Google (`ai.google.dev` bloqueado) ni hay clave, así que **la forma exacta de la petición, el nombre del alias y el esquema se han escrito de memoria y no se han probado contra la API real**. El código es defensivo: cualquier respuesta rara se convierte en «no he encontrado nada» y cualquier error HTTP, en un aviso genérico, sin romper la lista. Si falla, el mensaje de error de Google (que el servidor no devuelve al navegador) estará en los registros de Railway solo como código `ia-http-NNN`.
- **Privacidad (a comprobar por Diego):** según lo que sé, en el nivel **gratuito** de la API de Gemini Google puede usar lo enviado para mejorar sus productos; en el de pago, no. Conviene una clave con **facturación activada** y revisar los términos vigentes de Google. El aviso en pantalla dice ahora «Gemini, de Google».
- **Coste:** Flash es del orden de céntimos al mes con el tope de 40 consultas al día por hogar; lo confirmará la factura real.

## D-101 — El menú en tablas, bien estructurado (platos, cenas, notas, comidas, valoraciones)

- **Estado:** código y SQL hechos y probados en local (tests SQL con 24 comprobaciones nuevas, 547 unitarios y 412 E2E en verde, mutaciones comprobadas). **Migración `20261103100000_menu_en_tablas.sql` aplicada y comprobada en Supabase (2026-11-03, a mano en 3 bloques): 3 funciones `SECURITY INVOKER`, columnas y tablas nuevas, RLS forzada, `anon` sin acceso, 8 tablas en Realtime con identidad completa, registrada en el historial; avisos de seguridad sin cambios (las funciones nuevas no son `SECURITY DEFINER`). Pendiente: probar la importación con datos reales.** Petición de Diego: «guardarlo de una manera mucho mejor estructurada».
- **Estructura (todas las tablas tocadas estaban vacías):** `plato` → `plato_ingrediente` → `ingrediente` (catálogo compartido por nombre); `valoracion_plato` (persona, 1-5); **`comida_planificada` es la cena de un día y `comida_plato` sus platos en orden** (antes la tabla solo admitía un plato por día, y la app permite varios); **`nota_comida`** (la nota de cada cena, 140 letras); `almuerzo` (texto libre o plato); `ingrediente_excluido`. Cada tabla con RLS forzada, claves compuestas que impiden mezclar hogares y borrado en cascada.
- **Decisiones de modelado:** «ligero» se guarda como `rol = 'guarnicion'` (no como etiqueta); `por_revisar` y `ultima_vez` son columnas nuevas de `plato` (la valoración media se calcula, no se guarda); el tiempo activo admite hasta 480 min como la app; el id del plato lo decide quien lo crea (D-089).
- **Funciones SQL** (invoker, RLS aplica): `leer_menu_tablas`, `aplicar_cambios_menu` (todo o nada; «ingredientes» presente = lista completa) y `resolver_ingredientes` (de nombre a catálogo: reutiliza los que existen y crea los que faltan, con el límite diario ya existente).
- **Motor generalizado** (`SincronizadorTablas` + `Adaptador`): el mismo motor sirve para el hogar (D-095) y para el menú; cada agregado es un adaptador (leer, diferencias, mezcla). El del menú resuelve los ingredientes nuevos contra el catálogo **antes de enviar** y reescribe sus ids en el estado. Lo que llega del documento no pisa el menú (`conservarCamposDeMenu`) y la despensa/compra del documento pasan a usar los mismos ids de catálogo.
- **Importación** (Más → Cuenta): ahora también lleva el menú: empareja los ingredientes con el catálogo, lleva platos, cenas, notas, comidas del mediodía, valoraciones y exclusiones, y enciende el motor. Si la migración del menú aún no está aplicada, lleva lo del hogar y avisa de que falta.
- **Fallo encontrado por mis tests:** las bajas de cenas y notas se mandaban con la clave `fecha` y la función SQL espera `fecha|momento`; corregido.
- **Límites:** (1) **el menú del cole NO se migra aún**: pertenece a un centro escolar compartido (`menu_cole_dia` por `centro`), que necesita su propio flujo (crear/unirse al centro). (2) **Despensa, compra y reparto** siguen en el documento. (3) Los ingredientes con el mismo nombre se unen en uno (el catálogo es único por nombre). (4) Si dos móviles editan el mismo plato a la vez, gana el último en enviar. (5) Sin probar contra el Supabase real. (6) Hay que aplicar también la migración de Realtime del menú, incluida en la misma.

## D-102 — Todo va a Supabase; sin internet se guarda en el móvil y se envía al volver; si no se guarda, la app avisa siempre

- **Estado:** hecho (2026-11-03) y probado con simulaciones (cierre y reapertura de la app con y sin conexión, dos móviles a la vez; mutaciones comprobadas); 558 unitarios y 412 E2E en verde. **No probado en un móvil real con la nube.** Regla de Diego: «todo debe ir a Supabase, a no ser que el móvil esté sin internet y se pueda guardar temporalmente en local y en cuanto tenga internet se envíe correctamente»; y «si no se guarda en Supabase, algún cambio tiene que darme siempre errores».
- **Lo que había mal:** (1) el texto fijo de la barra lateral decía siempre «Modo prueba: datos de ejemplo guardados solo en este dispositivo» aunque estuviera conectado; (2) con la nube configurada pero sin sesión, o con un fallo, la app guardaba solo en el móvil **sin avisar**; (3) los cambios sin enviar vivían solo en memoria: si se cerraba la app sin conexión, **se perdían** al abrirla (se adoptaba lo de la nube); (4) si la app se abría sin internet, quedaba «cargando» para siempre y no apuntaba nada.
- **Avisos (siempre):** con la nube configurada, mientras algo impida guardar —sin sesión, sin hogar, sin internet, error— hay una **franja roja permanente arriba** (con botón a Cuenta) y **cada cambio muestra un aviso de error** («⚠️ Cambio NO guardado en la nube…»). La barra lateral dice la verdad: «☁️ Guardado en la nube (hogar)», «⚠️ Sin guardar en la nube» o «Solo en este dispositivo» (instalación sin nube). El estado de guardado es el peor entre el documento y los motores por tablas. Sin internet se detecta al instante (`navigator.onLine`), sin esperar a que falle un guardado. Si la nube está conectada pero parte aún va por el documento, la franja fina lo dice («falta pasarlo a tablas»).
- **Cola sin conexión (sobrevive a cerrar la app):** el documento guarda en el móvil sus cambios pendientes (por hogar) y al reabrir los **reaplica sobre lo que haya en la nube** y los envía; los motores por tablas guardan en el móvil la última lectura conocida y, al reabrir, calculan qué cambió este móvil desde entonces, lo **mezclan con los cambios de otros móviles** y lo envían. Si la app se abre sin internet, usa el último hogar conocido, apunta todo y reintenta solo al volver la conexión (`online`). «Restablecer ejemplo» borra también esas colas (para no reenviar nada).
- **Límites:** (1) sin sesión (nunca entró) no hay a dónde enviar: la franja avisa y los cambios quedan solo en el móvil, como mandaba el aviso. (2) Si dos móviles cambian **la misma fila** sin conexión, gana el último en enviar. (3) Si el navegador borra los datos del sitio mientras hay cambios sin enviar, se pierden (no hay forma de evitarlo desde la app). (4) Un fallo de espacio al guardar la cola en el móvil se ignora en silencio; la franja sigue avisando de que no está en la nube. (5) La franja y los avisos solo existen con la nube configurada: los tests E2E (sin Supabase) no los ejercitan; lo hacen los unitarios.

## D-103 — Los datos pasan a tablas solos, y comprobado con los datos reales de Diego

- **Estado:** hecho (2026-11-03). Petición de Diego: «empezar a guardar las cosas bien y poner cada cosa en su sitio». 560 unitarios y 412 E2E en verde. **Aún sin probar contra el Supabase real**; sí contra una base de datos local con las mismas migraciones.
- **Prueba con los datos reales de Diego** (`datos-diego.ts`: 54 platos, 4 personas, 4 cumpleaños, 22 tareas, en una base de datos local con TODAS las migraciones): se importaron y se leyeron de vuelta con las mismas funciones que usa la app, y **el estado reconstruido es idéntico** (platos con ingredientes, personas, cenas, cumpleaños). Resultado en tablas: 4 personas · 4 cumpleaños · 22 tareas por persona · 54 platos (14 ligeros como «guarnición», los 54 «por revisar», sin ninguno sin ingredientes) · 130 líneas de ingredientes · 51 ingredientes distintos, **todos emparejados con el catálogo existente, sin crear ninguno nuevo**. Las 0 cenas y 0 tareas de casa son lo que contiene ese estado de ejemplo, no un fallo.
- **Importación automática:** al conectar, si las tablas del hogar o del menú siguen vacías y el estado (el adoptado del documento de la nube) tiene personas, la app **pasa los datos a tablas sola**, una vez: con copia previa en el móvil, sin borrar nada, repetible y sin pisar si otro móvil ya lo hizo (con las tablas ya llenas, adopta). El botón de «Cuenta» sigue ahí para repetirlo a mano y enseñar el detalle de un error. Si la importación automática falla, queda en la consola y la franja sigue diciendo «falta pasarlo a tablas».
- **Límite:** si otro móvil con un estado más viejo conecta primero con las tablas vacías, sus datos serían los que se importen; por eso se usa siempre el estado adoptado de la nube, no el del móvil.

## D-104 — El menú del cole en tablas (colegio compartido) y solo se importa lo que falta

- **Estado:** código y SQL hechos y probados en local (13 comprobaciones SQL, 6 unitarios del cole; el menú real de 19 días se escribe y se lee idéntico; 566 unitarios y 412 E2E en verde). **Migración `20261103200000_cole_en_tablas.sql` aplicada y comprobada en Supabase (2026-11-03): 2 funciones `SECURITY INVOKER`, columnas nuevas, `anon` sin acceso, avisos de seguridad sin cambios. El menú del cole se importará en la siguiente apertura de la app.**
- **Estructura:** el menú del cole es del colegio, no de la familia: `centro` (el colegio) → `menu_cole_dia` (un día por fila, con historial automático de cambios), compartido por las familias de la clase. La migración añade a `menu_cole_dia` la guarnición y las kcal y dos funciones (`leer_cole_tablas`, `aplicar_cambios_cole`); la primera vez crea el colegio del hogar («Colegio») y vincula al hogar como curador. Se puede renombrar después.
- **Motor:** un tercer adaptador del mismo motor que el hogar y el menú. Sin actualización en directo (la tabla no lleva el hogar y el menú cambia poco); se refresca al volver a la app.
- **Importación solo de lo que falta (cambio importante de D-103):** el importador recibe qué agregados faltan por llevar a tablas y escribe solo esos; **nunca pisa con el documento lo que ya manda desde tablas**. Antes, si solo faltaba uno, reimportaba todo desde el documento (posible dato viejo).
- **Límites:** (1) un día del cole sin ningún texto ni tipo de plato no se guarda; si solo trae el tipo, se guarda su nombre y al leer se reconoce. (2) Borrar días del menú lo permiten solo los curadores del colegio (reglas ya existentes). (3) Compartir el colegio con otras familias (códigos) existe en la base de datos pero no tiene pantalla todavía.

- **Comprobado con datos reales (2026-11-03 13:43, importación automática de D-103 en el móvil de Diego):** 4 personas, 4 cumpleaños, 8 tareas de casa, 22 tareas por persona, 54 platos (14 ligeros como «guarnición»), 130 líneas de ingredientes con 51 ingredientes distintos del catálogo (ninguno creado), y las cenas elegidas como **3 días con 4 platos en orden** (el 3 de noviembre: Filetes de ternera + Gulas). Es decir, **la importación automática funcionó a la primera con datos reales** y la estructura es la prevista.

## D-105 — Subir el PDF o una foto del menú del cole (la IA solo transcribe)

- **Estado:** código hecho y probado con simulaciones (4+3+4 tests nuevos; 577 unitarios y 412 E2E en verde). **Sin probar contra Gemini real** (no hay clave en esta sesión; mismo aviso que D-100: la forma de la petición con archivo adjunto —`inlineData`— está escrita de memoria).
- **Qué hace:** en Comer → Cole, con la nube conectada, «📄 Subir PDF o foto del menú» (PDF, PNG, JPG o WEBP, hasta 8 MB). El archivo va al servidor (`POST /api/ia/cole`), que se lo manda a Gemini para que lo **transcriba** al mismo formato de texto que ya entiende el lector del cole. El texto aparece en el cuadro de abajo para **revisarlo**; después, «Leer menú» y la revisión de grupos de siempre. La IA no interpreta ni clasifica nada: solo copia el texto.
- **Seguridad y privacidad:** mismas reglas que D-098 (sesión, hogar y tope diario en la base de datos, contado antes de llamar; clave solo en el servidor); comprobación de tipo y tamaño antes de gastar nada; el archivo no se guarda y los errores del proveedor no llegan al navegador. El contenido del documento se trata como datos, no como instrucciones. La pantalla avisa de que se envía a una IA.
- **Refactor:** la comprobación de acceso a la IA (clave, sesión, hogar, tope) pasa a `infraestructura/ia/acceso.ts`, compartida por la lista de la compra y el cole.
- **Límites:** (1) la transcripción puede equivocarse: por eso se revisa antes de leer. (2) Un PDF muy grande o de muchas páginas puede tardar y cortarse a los 55 s. (3) No incluye el calendario escolar (festivos y vacaciones): es la siguiente pieza. (4) Necesita `GEMINI_API_KEY` en Railway.

## D-106 — Los fallos de la IA dicen qué ha fallado

**Contexto.** Al subir el PDF del cole apareció «No se ha podido leer el archivo» sin más pistas: tanto un error de Google (clave, modelo, formato) como del contador de uso salían igual, y desde el móvil no hay forma de ver los registros.

**Decisión.** Las rutas `/api/ia/*` devuelven además un `motivo` corto y seguro (`ia-http-404`, `ia-tiempo`, `ia-red`, `uso-<código>`) que la pantalla muestra entre paréntesis y que se registra en el servidor. Nunca viaja el contenido del archivo ni el cuerpo de la respuesta del proveedor. La transcripción ignora ahora las traducciones al inglés que trae el menú real del cole.

## D-107 — La IA reintenta cuando Google está saturado

**Contexto.** La primera subida real devolvió `ia-http-503`: Google respondió «modelo saturado», un fallo pasajero habitual en los modelos Flash más nuevos.

**Decisión.** Un módulo común (`infraestructura/ia/gemini.ts`) llama a Gemini con reintentos: ante 429/500/502/503/504 repite una vez tras 1,2 s con el modelo principal y después prueba con `gemini-2.5-flash` , todo dentro de un plazo total (25 s la lista, 55 s el PDF). Los errores que no son pasajeros (clave, formato) no se reintentan. Lo usan la lista y el menú del cole.

**Añadido (`ia-tiempo`).** La transcripción del PDF superó el plazo de 55 s: los modelos Flash recientes «piensan» por defecto antes de responder. Se pide `thinkingLevel: low` en la transcripción; si el modelo rechaza el ajuste (400) se repite sin él. Sin verificar contra Google real.

**Plazo por intento.** Cada intento al modelo tiene 30 s en la transcripción del PDF; si no contesta, se pasa al modelo de respaldo (más rápido) en vez de gastar los 55 s en uno solo.

**El botón de subir el PDF se ve siempre.** Solo aparecía con la cuenta ya conectada: en el móvil, mientras la cuenta cargaba (o sin sesión) desaparecía sin explicación. Ahora está siempre y, si no hay cuenta lista, dice por qué.

## D-108 — «Lo de hoy»: quién ha hecho qué cada día

**Contexto.** Querían poder apuntar quién se ha encargado de cada comida, cena y compra, y también de los gatos, el lavavajillas… («hoy Diego ha hecho la compra, la cena y la comida, y se ha encargado de los gatos y del lavavajillas»). El reparto ya planifica cargas y turnos, pero no apunta lo que se ha hecho de verdad.

**Decisión.** Un diario en tablas, no en el documento: `registro_hogar` (hogar, fecha, qué, persona; FK compuesta a `persona`, RLS por hogar, restricción única por día + cosa + persona sin mayúsculas ni espacios). Una fila por cosa hecha; se añade y se quita, no se edita. El id es un UUID v5 de fecha + cosa + persona, así que tocar dos veces no duplica y dos móviles que apuntan lo mismo no chocan. Motor propio (`SincronizadorTablas` + `adaptadorRegistro`), RPC `leer_registro_tablas` (últimos 60 días) y `aplicar_cambios_registro`, en directo por Realtime. Nace en tablas: no hay nada que importar. Si no se puede guardar, sale el error de siempre; sin conexión se encola y se envía al volver.

**Pantalla.** En Hoy, la tarjeta «Lo de hoy»: comida, cena y compra siempre; un toque en la persona la apunta y otro la quita; «＋ Otra cosa» añade lo que sea (gatos, lavavajillas) y desde entonces sale como sugerencia, las más frecuentes primero.

**Pendiente.** Que «Marcar hecha» de Casa apunte quién la hizo; que el panel de reparto cuente también lo apuntado; el resumen semanal. Hasta aplicar la migración `20261103210000_registro_hogar`, el motor no arranca y el registro no se guarda en tablas.

## Casa en filas compactas

Las tareas de Casa ocupaban una tarjeta cada una. Ahora son filas de una línea (✓ para marcar hecha, título, cuándo toca, la inicial de a quién le toca); al tocar la fila se despliega lo demás (a quién le toca, mañana, a la lista, quitar).

## D-109 — El calendario suscrito lee de las tablas

**Contexto.** Pidieron «un enlace .ics para poner en Google Calendar y que todo se sincronice». El enlace ya existía (D-083, Más → Enviar → «Avisos en el calendario del móvil»), pero `estado_para_calendario` seguía leyendo el documento `hogar_estado`, que ya no recibe personas, cenas, comidas, agenda, fechas, casa ni cumpleaños (viven en tablas). Comprobado con datos reales: el documento tenía «Filetes de ternera» el 3 de noviembre y las tablas «Pollo empanado + Sopa».

**Decisión.** Migración `20261103220000_calendario_desde_tablas`: si el hogar tiene sus personas en tablas, el resumen sale de ellas (una entrada por plato de cada cena, en orden); si no, sigue saliendo del documento. Mismo resumen mínimo: nunca ideas, gustos ni regalo, compra, despensa, ingredientes ni cole. Test SQL nuevo (`calendario_tablas`) que comprueba que manda la tabla, que no sale nada del documento viejo ni del regalo, y que solo hay las siete claves de siempre.

**Límites.** Google Calendar refresca los calendarios por URL cuando quiere (entre medio día y un día) y no se puede forzar; ignora las alarmas del archivo. La app de Google Calendar no deja añadir por URL: hay que hacerlo desde calendar.google.com en el navegador. El calendario es de lectura: lo que se cambia en Google no vuelve a la app.

## D-110 — Todo se apunta en la app; el calendario permite añadir citas por día

**Contexto.** Se preguntó si el calendario de Google podía ser bidireccional. Hacerlo de verdad exige OAuth y la API de Google (proyecto en Google Cloud, un sitio seguro para el permiso de acceso, aviso de «app no verificada»…). Se decidió lo contrario: **la app es el único sitio donde se escribe** y Google Calendar es una ventana de lectura (el enlace .ics, D-109). Lo que se tenga en Google se lee en la app (D-074) mientras se pasa a la app.

**Decisión.** Acción `agenda/cita` (título, día, hora opcional, último día opcional; sin duplicados; id UUID derivado del `idBase`, así que se guarda como fila de `apunte`). Componente `NuevaCita`: en el **calendario**, al elegir un día sale «Citas y eventos» con lo apuntado (con «Quitar»), lo de Google Calendar (solo lectura) y «＋ Cita o evento este día» con el día ya fijado; en **Hoy**, «＋ Cita» pide el día. El aviso de la fecha señalada o el cumpleaños sigue arriba, aparte de las citas.

## D-111 — Entrar con contraseña (la sesión se pierde y el correo tiene tope)

**Contexto.** «Cada vez que entro estoy así»: la sesión no sobrevive de un día para otro en el móvil. En los registros de autenticación de Supabase no hay ningún cierre de sesión ni revocación por el servidor entre dos usos: simplemente no hay intento de renovar; el navegador ha perdido la sesión (cookies o datos del sitio borrados; en Brave, p. ej., «Olvidarme cuando cierre este sitio»). Y volver a entrar cuesta un correo: el envío de Supabase tiene tope por hora y se vio «email rate limit exceeded» tras varios intentos.

**Decisión.** (1) Entrar con **correo y contraseña**, sin correo de por medio, y poner o cambiar la contraseña en Cuenta → Contraseña (mínimo 10 caracteres; la fuerza la valida Supabase). (2) Pedir al navegador **almacenamiento persistente** (`navigator.storage.persist()`) al entrar, para que no borre la sesión ni los cambios sin enviar por falta de espacio. (3) Mensajes claros para contraseña incorrecta, débil o tope de correos.

**Límite.** Si el navegador borra los datos del sitio al cerrarlo (ajuste del propio navegador), la sesión se perderá igual; con la contraseña volver a entrar es solo escribirla. Instalar la app en la pantalla de inicio también ayuda.

## D-112 — La app entra siempre sola

**Contexto.** «Tiene que conectarse siempre automáticamente»: la sesión se perdía de un día para otro, y volver a entrar costaba un correo con tope de envíos.

**Decisión.** Tres redes de seguridad, por orden, en `infraestructura/supabase/respaldo-sesion.ts`: (1) la sesión normal (cookies); (2) una **copia de los tokens en el almacenamiento local**, que se actualiza en cada inicio y renovación de sesión y con la que se restaura la sesión si faltan las cookies (si el servidor rechaza la copia, se borra; si solo falla la red, se conserva); (3) la **contraseña guardada en el gestor del navegador** (Credential Management), que se pide en silencio y vuelve a iniciar sesión. «Salir» borra la copia y le dice al navegador que no entre solo, para que salir de verdad sea salir. Todo se prueba con tests de unidad (618).

**Límites, dichos con claridad.** No he podido probarlo en un Brave real. Si el navegador borra a la vez cookies y almacenamiento local al cerrar el sitio («Olvidarme cuando cierre este sitio»), solo queda la contraseña guardada, y no todos los navegadores admiten Credential Management; en ese caso hay que quitar ese ajuste de Brave para este sitio. La copia de los tokens en el almacenamiento local es legible por scripts de la propia página, igual que las cookies de sesión actuales (no son `httpOnly`); la CSP estricta es la defensa.

## D-113 — El menú compartido, en agenda, tabla o completo

**Contexto.** El mensaje del menú para WhatsApp era largo: el texto íntegro del cole (con ingredientes entre paréntesis) y una frase de «por qué» por día. Pidieron algo más esquemático: agenda o tabla.

**Decisión.** Tres formatos (`FormatoMenu`), elegibles en Enviar y recordados en el móvil; **agenda** es el de por defecto, también en el botón de enviar del menú. *Agenda*: dos líneas por día (cole resumido y cena), sin el porqué. *Tabla*: una línea por día, «Día | cole en emojis | cena». *Completo*: el de siempre. El menú del cole se acorta (`acortarPlatoCole`): sin paréntesis, sin «ecológicas», hasta el primer «con» si es largo y, si sigue siendo largo, hasta la primera coma; lo que se pierde está en el menú del cole de la app.

## Comidas en la pantalla de Comer

La comida del mediodía (D-079) solo se podía apuntar desde el detalle del día en el calendario. Ahora también desde **Comer**: cada día plegado enseña «☀️ lo que se come» junto al cole, y al abrirlo salen dos bloques, **Comida** (plato de la casa o texto libre, varios, «por decidir») y **Cena** (como antes). Mismo componente que en el calendario, así que entra igual en la compra, en el mensaje de enviar y en el calendario suscrito.

## D-114 — Avisos: campanita en la app y resumen diario por correo

**Contexto.** Querían recordatorios dentro de la app, por correo y como notificación del móvil, de momento solo para Diego y a las 10:00.

**Núcleo común.** `dominio/avisos.ts` calcula los avisos del día —cumpleaños a 30, 14, 7, 3, 1 y 0 días (con «empezad a pensar el regalo» y «hay que comprar»), citas de hoy y mañana, lo que toca en casa (atrasado o de hoy), cena de hoy y de mañana sin elegir— y los ordena (lo que pide algo hoy, lo que se acerca, lo informativo). Es el mismo cálculo para todos los canales: recibe el estado de la app o el resumen mínimo del calendario suscrito (`entradaDeProyeccion`), así que el servidor no necesita ninguna clave maestra de Supabase.

**Campanita.** Botón 🔔 en la cabecera con el número de avisos nuevos (se pone a cero al abrirlo; lo visto se recuerda ese día en el móvil). En pantallas estrechas la cabecera deja solo el logo para que quepa.

**Correo.** `POST /api/avisos/diario`, protegido por `AVISOS_CRON_SECRET` (comparación en tiempo constante; sin él, 401), lee el resumen del calendario con `AVISOS_CALENDARIO_TOKEN` y envía con Resend a `AVISOS_CORREO`. Solo envía a la hora elegida de Madrid (`AVISOS_HORA`, por defecto 10), así que el programador puede llamar dos veces al día (invierno y verano) y solo cuenta una; `?forzar=1` sirve para probar. Resend recibe una `Idempotency-Key` por día: aunque se pida dos veces, no duplica el correo. El programador es un workflow de GitHub Actions (`.github/workflows/avisos.yml`, cron `7 8,9 * * *` UTC, sin permisos sobre el repositorio, también se puede lanzar a mano). Los errores no cuentan nada del proveedor.

**Límites.** Con el remitente de pruebas de Resend (`onboarding@resend.dev`), el correo solo llega al dueño de la cuenta de Resend; para escribir a otras personas hace falta un dominio verificado. GitHub puede retrasar unos minutos un workflow programado. No he podido probar el envío real ni el programador.

## D-115 — Notificaciones push en el móvil

**Contexto.** Se quiso que el aviso de cada mañana llegara también como notificación del móvil, además de por correo y de la campanita (D-114).

**Decisión.** Web Push estándar (la librería `web-push`). (1) **Claves VAPID** generadas desde la propia app, solo a un miembro con sesión (`POST /api/push/claves`), que las ve una vez y las pone en Railway (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`): así ninguna clave pasa por un chat ni queda en el repositorio ni en la base de datos. (2) **Service worker** `public/sw.js` (la CSP ya permitía `worker-src 'self'`) que enseña la notificación y abre la app al tocarla. (3) **Tabla** `push_suscripcion` (RLS forzada: cada persona solo ve y quita la suya; `https` obligatorio; única por dirección) y funciones `guardar_suscripcion_push` y `quitar_suscripcion_push` (INVOKER). (4) El **servidor del aviso diario**, sin sesión, lee las suscripciones del hogar con el token secreto del calendario mediante `suscripciones_para_avisos` y olvida las caducadas con `olvidar_suscripcion_push` (ambas `SECURITY DEFINER`, ejecutables por `anon` como la del calendario, con el token como única llave). Sin clave maestra de Supabase en ningún sitio. (5) La misma llamada diaria envía correo y notificaciones; cada canal va por su cuenta y que falle uno no impide el otro. (6) Cada móvil las activa por su cuenta en Más → Enviar, con botones de prueba y de desactivar; en iPhone solo con la app instalada en la pantalla de inicio.

**Límites.** No lo he podido probar en un móvil real ni con un servicio de notificaciones real (Chrome/Brave usan el de Google; Safari el de Apple). Las notificaciones push dependen de que el sistema deje la app recibirlas (ahorro de batería, permisos). Con un solo hogar y un usuario es suficiente; para varios usuarios habría que decidir quién recibe qué (hoy llega el mismo aviso a todos los móviles suscritos).

**Nota de D-115.** La pantalla ya no consulta al servidor si tiene claves al cargar (esa petición quedaba pendiente en el navegador de las pruebas y bloqueaba la espera de carga de `/compartir`): se consulta al pulsar «Activar en este móvil», antes de pedir permiso, y si faltan las claves se enseña el paso de generarlas.

## D-116 — IA para completar platos y para leer circulares del cole

**Contexto.** De las ideas de IA útil, dos primeras: (1) 54 platos con los ingredientes sin completar, de los que sale la lista de la compra; (2) las circulares y notas del cole, que hoy se apuntan a mano.

**Completar un plato (`/api/ia/plato`).** Desde Mis platos: «✨ Completar con IA» en el editor (con el nombre escrito) y en cada plato sin ingredientes. Solo se envía el nombre del plato (y el grupo si ya lo tiene) más los nombres de los ingredientes que ya existen en el catálogo del hogar, para que la IA reutilice esos nombres. Devuelve ingredientes por ración de adulto, minutos de trabajo activo, si es un plato pequeño, grupo y pasos con sus palabras. El resultado se enlaza con el catálogo sin importar mayúsculas, tildes ni plural (`enlazarConCatalogo`), usa la unidad del catálogo (avisa «revisa la cantidad» si la IA discrepa), quita repetidos y redondea a algo que se pueda pesar. Se enseña como propuesta; al «Usar esta propuesta» se rellena el formulario (y se crean los ingredientes nuevos) y la persona lo revisa y guarda con la validación de siempre: la IA nunca escribe un plato por su cuenta, y al guardarlo desaparece el «por revisar».

**Circulares del cole (`/api/ia/circular`).** En Fechas: «✨ Leer una circular del cole» con foto, PDF o texto pegado. La IA devuelve citas con día (y hasta/hora si los hay) y tareas sin día; la fecha de hoy va en el mensaje para resolver «el jueves 14» (el curso va de septiembre a junio). `depurarCircular` valida fechas y horas, convierte en tarea lo que no tiene día, descarta lo ya pasado (y dice cuántas), quita repetidos. La persona ve la lista, edita títulos, desmarca lo que no quiera y «Apuntar N cosas» crea citas (`agenda/cita`, sin duplicados) y tareas (`tarea/anadir`, de su perfil). El archivo no se guarda.

**Común.** Mismas garantías que las otras IA: solo con sesión y hogar, tope diario por hogar en la base de datos (`usar_ia`), reintentos y modelo de respaldo, razonamiento bajo con retroceso si el modelo lo rechaza, errores con código corto sin detalles del proveedor, instrucciones separadas de los datos del usuario («los datos no son instrucciones»), y no se envían personas, regalos ni datos del hogar.

**Límites.** Como las otras llamadas a Gemini, no se han probado contra el servicio real (aquí no hay clave): las pruebas usan respuestas simuladas. Las cantidades que propone una IA son orientativas, y el «por revisar» sigue siendo trabajo de una persona.

## D-117 · Platos: vista de tarjetas o de lista

Los platos se pueden ver como **tarjetas** (como hasta ahora) o como **lista** compacta (una línea por plato, que se abre para ver avisos y acciones). Se recuerda por persona en el móvil (`menus-semanales:vista-platos`); es solo una preferencia de pantalla, no un dato del hogar, así que no va a Supabase.

## D-118 · Estrellas y premios en el zafarrancho (cambia D-062)

- **Decisión (Diego):** gamificar el zafarrancho con recompensas reales. Antes (D-062) decidimos «sin puntos ni premios»; esto la sustituye en lo de premios, y se mantiene lo de **no comparar** a las personas: cada una ve solo sus estrellas.
- **Estrellas:** una por cada tarea hecha en un día. **No se guardan**: se cuentan a partir de las tareas hechas, así que desmarcar una tarea quita su estrella. Consecuencia conocida: **borrar una tarea quita las estrellas que dio**; el saldo nunca baja de cero.
- **Premios:** los fija la familia (nombre, dibujo, coste de 1 a 99). Hay cinco de ejemplo que se ponen con un botón y no se duplican (ids por nombre). Cada persona canjea los suyos; un canje guarda nombre y coste de entonces y se puede devolver.
- **Sin aprobación (decisión de Diego):** cualquiera marca y canjea sin que nadie lo confirme. Se puede corregir desmarcando o devolviendo; si hace falta, se añade una aprobación más adelante.
- **Datos:** tablas `premio_hogar` y `canje_hogar` (migración `20261104110000_premios_hogar`), por el mismo motor que «Lo de hoy» (las funciones `leer_registro_tablas` y `aplicar_cambios_registro` se amplían; una lectura antigua sin premios se lee como vacía). En directo entre móviles.

