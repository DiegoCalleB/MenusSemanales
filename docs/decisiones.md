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
  - Proyecto `menus-semanales` en **eu-west-1 (Irlanda)**: datos en la UE (RGPD), baja latencia desde España. Vercel en región `dub1`.
  - Entornos: local (CLI/Docker o Postgres efímero en CI) + producción. Branching de Supabase cuando se pase a Pro.
  - El repositorio es la fuente de verdad del esquema (`supabase/migrations`); nunca cambios manuales en el panel.
  - Claves nuevas *publishable/secret*; la secreta solo en servidor, CI y scripts.
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
