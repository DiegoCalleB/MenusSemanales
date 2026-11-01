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
