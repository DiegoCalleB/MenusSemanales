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
